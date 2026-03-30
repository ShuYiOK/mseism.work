/**
 * WebSocket 连接池管理
 * 优化WebSocket连接管理，支持更多并发连接
 */

class WebSocketManager {
  constructor() {
    this.connections = new Map();
    this.maxConnections = 1000; // 最大连接数
    this.connectionTimeout = 300000; // 5分钟超时
    this.cleanupInterval = 60000; // 1分钟清理一次
    this.messageQueue = new Map(); // 消息队列
    
    // 启动定时清理
    this.startCleanup();
  }

  /**
   * 添加连接
   * @param {Object} socket Socket实例
   */
  addConnection(socket) {
    // 检查连接数是否超过限制
    if (this.connections.size >= this.maxConnections) {
      socket.emit('error', { message: '连接数已达上限' });
      socket.disconnect(true);
      return;
    }

    const connectionInfo = {
      socket,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      pendingMessages: []
    };

    this.connections.set(socket.id, connectionInfo);
    
    // 监听活动
    socket.on('ping', () => {
      this.updateActivity(socket.id);
    });

    socket.on('disconnect', () => {
      this.removeConnection(socket.id);
    });
  }

  /**
   * 移除连接
   * @param {string} socketId Socket ID
   */
  removeConnection(socketId) {
    this.connections.delete(socketId);
    this.messageQueue.delete(socketId);
  }

  /**
   * 更新活动时间
   * @param {string} socketId Socket ID
   */
  updateActivity(socketId) {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /**
   * 发送消息
   * @param {string} socketId Socket ID
   * @param {string} event 事件名
   * @param {Object} data 数据
   */
  sendMessage(socketId, event, data) {
    const connection = this.connections.get(socketId);
    if (connection) {
      try {
        connection.socket.emit(event, data);
        connection.lastActivity = Date.now();
      } catch (error) {
        console.error('发送消息失败:', error);
        // 将消息加入队列
        this.enqueueMessage(socketId, event, data);
      }
    } else {
      // 连接不存在，将消息加入队列
      this.enqueueMessage(socketId, event, data);
    }
  }

  /**
   * 广播消息
   * @param {string} event 事件名
   * @param {Object} data 数据
   * @param {string} excludeSocketId 排除的Socket ID
   */
  broadcastMessage(event, data, excludeSocketId = null) {
    this.connections.forEach((connection, socketId) => {
      if (socketId !== excludeSocketId) {
        this.sendMessage(socketId, event, data);
      }
    });
  }

  /**
   * 将消息加入队列
   * @param {string} socketId Socket ID
   * @param {string} event 事件名
   * @param {Object} data 数据
   */
  enqueueMessage(socketId, event, data) {
    if (!this.messageQueue.has(socketId)) {
      this.messageQueue.set(socketId, []);
    }
    
    const queue = this.messageQueue.get(socketId);
    queue.push({ event, data, timestamp: Date.now() });
    
    // 限制队列大小
    if (queue.length > 100) {
      queue.shift(); // 移除最旧的消息
    }
  }

  /**
   * 处理队列中的消息
   * @param {string} socketId Socket ID
   */
  processMessageQueue(socketId) {
    const queue = this.messageQueue.get(socketId);
    if (queue && queue.length > 0) {
      const connection = this.connections.get(socketId);
      if (connection) {
        queue.forEach(({ event, data }) => {
          try {
            connection.socket.emit(event, data);
          } catch (error) {
            console.error('处理队列消息失败:', error);
          }
        });
        this.messageQueue.delete(socketId);
      }
    }
  }

  /**
   * 启动定时清理
   */
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      this.connections.forEach((connection, socketId) => {
        if (now - connection.lastActivity > this.connectionTimeout) {
          console.log(`清理超时连接: ${socketId}`);
          try {
            connection.socket.disconnect(true);
          } catch (error) {
            console.error('清理连接失败:', error);
          }
          this.removeConnection(socketId);
        }
      });
    }, this.cleanupInterval);
  }

  /**
   * 获取连接统计
   * @returns {Object} 连接统计信息
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      maxConnections: this.maxConnections,
      messageQueues: this.messageQueue.size
    };
  }
}

// 导出单例
module.exports = new WebSocketManager();
