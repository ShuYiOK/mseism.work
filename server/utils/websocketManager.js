/**
 * WebSocket 连接池管理 - 优化版
 * 支持房间机制、消息确认、消息压缩
 */

class WebSocketManager {
  constructor() {
    this.connections = new Map();
    this.io = null;
    this.maxConnections = 1000;
    this.connectionTimeout = 300000;
    this.cleanupInterval = 60000;
    this.messageQueue = new Map();
    
    // 房间管理
    this.rooms = new Map(); // roomId -> Set of socketIds
    this.socketRooms = new Map(); // socketId -> Set of roomIds
    
    // 消息确认
    this.pendingAcks = new Map(); // messageId -> { resolve, timeout }
    this.messageIdCounter = 0;
    this.ackTimeout = 10000; // 10秒超时
    
    // 消息压缩阈值
    this.compressThreshold = 1024; // 1KB以上压缩
    
    this.startCleanup();
  }

  setIO(io) {
    this.io = io;
    console.log('[WS Manager] Socket.io 实例已设置');
    
    // 配置 Socket.io 压缩
    // Socket.io 默认支持 perMessageDeflate，无需额外配置
  }

  addConnection(socket) {
    if (this.connections.size >= this.maxConnections) {
      socket.emit('error', { message: '连接数已达上限' });
      socket.disconnect(true);
      return;
    }

    const connectionInfo = {
      socket,
      id: socket.id,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      pendingMessages: [],
      rooms: new Set()
    };

    this.connections.set(socket.id, connectionInfo);
    this.socketRooms.set(socket.id, new Set());
    
    // 注册心跳
    socket.on('ping', () => {
      this.updateActivity(socket.id);
    });

    // 注册房间事件
    socket.on('join:group', (groupId) => {
      this.joinRoom(socket.id, `group:${groupId}`);
    });

    socket.on('leave:group', (groupId) => {
      this.leaveRoom(socket.id, `group:${groupId}`);
    });

    // 消息确认
    socket.on('message:ack', (messageId) => {
      this.handleAck(messageId);
    });

    socket.on('disconnect', () => {
      this.removeConnection(socket.id);
    });
    
    console.log(`[WS Manager] 新连接: ${socket.id}, 当前连接数: ${this.connections.size}`);
  }

  removeConnection(socketId) {
    const connection = this.connections.get(socketId);
    if (connection) {
      // 清理房间
      const rooms = this.socketRooms.get(socketId);
      if (rooms) {
        rooms.forEach(roomId => {
          const room = this.rooms.get(roomId);
          if (room) {
            room.delete(socketId);
            if (room.size === 0) {
              this.rooms.delete(roomId);
            }
          }
        });
      }
      
      this.socketRooms.delete(socketId);
    }
    
    this.connections.delete(socketId);
    this.messageQueue.delete(socketId);
    
    console.log(`[WS Manager] 连接断开: ${socketId}, 当前连接数: ${this.connections.size}`);
  }

  updateActivity(socketId) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  // 房间管理
  joinRoom(socketId, roomId) {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // 添加到房间
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(socketId);
    
    // 记录 socket 所属房间
    this.socketRooms.get(socketId).add(roomId);
    connection.rooms.add(roomId);
    
    // 使用 Socket.io 原生房间
    connection.socket.join(roomId);
    
    console.log(`[WS Manager] Socket ${socketId} 加入房间 ${roomId}`);
  }

  leaveRoom(socketId, roomId) {
    const connection = this.connections.get(socketId);
    if (!connection) return;

    // 从房间移除
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    
    // 移除 socket 所属房间记录
    this.socketRooms.get(socketId)?.delete(roomId);
    connection.rooms.delete(roomId);
    
    // 使用 Socket.io 原生房间
    connection.socket.leave(roomId);
    
    console.log(`[WS Manager] Socket ${socketId} 离开房间 ${roomId}`);
  }

  // 发送消息（支持确认机制）
  sendMessage(socketId, event, data, requireAck = false) {
    const connection = this.connections.get(socketId);
    if (connection) {
      try {
        const messageData = requireAck ? {
          ...data,
          _messageId: this.generateMessageId(),
          _requireAck: true
        } : data;
        
        connection.socket.emit(event, messageData);
        connection.lastActivity = Date.now();
        
        if (requireAck) {
          return this.waitForAck(messageData._messageId);
        }
        
        return Promise.resolve(true);
      } catch (error) {
        console.error('[WS Manager] 发送消息失败:', error);
        this.enqueueMessage(socketId, event, data);
        return Promise.reject(error);
      }
    } else {
      this.enqueueMessage(socketId, event, data);
      return Promise.reject(new Error('连接不存在'));
    }
  }

  // 广播到房间
  broadcastToRoom(roomId, event, data, excludeSocketId = null) {
    if (this.io) {
      const socketIds = this.rooms.get(roomId);
      if (socketIds && socketIds.size > 0) {
        console.log(`[WS Manager] 广播事件 ${event} 到房间 ${roomId}, ${socketIds.size} 个客户端`);
        
        socketIds.forEach(socketId => {
          if (socketId !== excludeSocketId) {
            this.sendMessage(socketId, event, data);
          }
        });
      }
    }
  }

  // 广播到所有客户端
  broadcastMessage(event, data, excludeSocketId = null) {
    if (this.io) {
      console.log(`[WS Manager] 广播事件 ${event} 到所有客户端, ${this.connections.size} 个连接`);
      this.io.emit(event, data);
    } else {
      console.warn('[WS Manager] io 实例未设置，使用备用广播');
      this.connections.forEach((connection, socketId) => {
        if (socketId !== excludeSocketId) {
          this.sendMessage(socketId, event, data);
        }
      });
    }
  }

  // 按需推送 - 只推送给相关客户端
  broadcastDeviceUpdate(deviceId, data, groupIds = []) {
    // 如果设备有分组，只推送给订阅了该分组的客户端
    if (groupIds && groupIds.length > 0) {
      groupIds.forEach(groupId => {
        this.broadcastToRoom(`group:${groupId}`, 'device:update', data);
      });
    } else {
      // 没有分组，广播给所有客户端
      this.broadcastMessage('device:update', data);
    }
  }

  // 消息确认机制
  generateMessageId() {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }

  waitForAck(messageId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAcks.delete(messageId);
        reject(new Error('消息确认超时'));
      }, this.ackTimeout);
      
      this.pendingAcks.set(messageId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        timeout
      });
    });
  }

  handleAck(messageId) {
    const pending = this.pendingAcks.get(messageId);
    if (pending) {
      pending.resolve(true);
      this.pendingAcks.delete(messageId);
    }
  }

  // 消息队列
  enqueueMessage(socketId, event, data) {
    if (!this.messageQueue.has(socketId)) {
      this.messageQueue.set(socketId, []);
    }
    
    const queue = this.messageQueue.get(socketId);
    queue.push({ event, data, timestamp: Date.now() });
    
    // 限制队列大小
    if (queue.length > 100) {
      queue.shift();
    }
  }

  processMessageQueue(socketId) {
    const queue = this.messageQueue.get(socketId);
    if (queue && queue.length > 0) {
      const connection = this.connections.get(socketId);
      if (connection) {
        queue.forEach(({ event, data }) => {
          try {
            connection.socket.emit(event, data);
          } catch (error) {
            console.error('[WS Manager] 处理队列消息失败:', error);
          }
        });
        this.messageQueue.delete(socketId);
      }
    }
  }

  // 清理超时连接
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      this.connections.forEach((connection, socketId) => {
        if (now - connection.lastActivity > this.connectionTimeout) {
          console.log(`[WS Manager] 清理超时连接: ${socketId}`);
          try {
            connection.socket.disconnect(true);
          } catch (error) {
            console.error('[WS Manager] 清理连接失败:', error);
          }
          this.removeConnection(socketId);
        }
      });
      
      // 清理过期的消息确认
      this.pendingAcks.forEach((pending, messageId) => {
        // 超时已在 waitForAck 中处理
      });
    }, this.cleanupInterval);
  }

  // 获取统计信息
  getStats() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.maxConnections,
      messageQueues: this.messageQueue.size,
      rooms: this.rooms.size,
      pendingAcks: this.pendingAcks.size,
      roomDetails: Object.fromEntries(
        [...this.rooms.entries()].map(([id, sockets]) => [id, sockets.size])
      )
    };
  }

  // 获取房间信息
  getRoomInfo(roomId) {
    const room = this.rooms.get(roomId);
    return {
      exists: !!room,
      memberCount: room ? room.size : 0,
      members: room ? [...room] : []
    };
  }
}

module.exports = new WebSocketManager();
