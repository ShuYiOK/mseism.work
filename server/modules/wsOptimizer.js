/**
 * WebSocket性能优化模块
 * 提供连接管理优化、消息批量推送等功能
 */

class WebSocketOptimizer {
  constructor() {
    this.pendingMessages = new Map();
    this.batchInterval = 50;
    this.flushTimer = null;
    this.messageQueue = new Map();
    this.compressionThreshold = 1024;
  }
  
  // 添加消息到批量队列
  addToBatch(socketId, event, data) {
    if (!this.pendingMessages.has(socketId)) {
      this.pendingMessages.set(socketId, []);
    }
    
    this.pendingMessages.get(socketId).push({ event, data });
    
    // 启动批量发送定时器
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushAll(), this.batchInterval);
    }
  }
  
  // 刷新所有待发送消息
  flushAll() {
    this.flushTimer = null;
    
    for (const [socketId, messages] of this.pendingMessages) {
      if (messages.length === 0) continue;
      
      const socket = this.getSocket(socketId);
      if (!socket || !socket.connected) continue;
      
      // 合并消息
      if (messages.length === 1) {
        socket.emit(messages[0].event, messages[0].data);
      } else {
        // 批量发送
        const batched = messages.length > 5 ? this.compressMessages(messages) : messages;
        socket.emit('batch', {
          messages: batched.map(m => ({
            event: m.event,
            data: this.compressMessage(m.data)
          })),
          count: messages.length
        });
      }
    }
    
    this.pendingMessages.clear();
  }
  
  // 压缩单个消息
  compressMessage(data) {
    const str = JSON.stringify(data);
    if (str.length > this.compressionThreshold) {
      return {
        _compressed: true,
        data: Buffer.from(str).toString('base64')
      };
    }
    return data;
  }
  
  // 压缩多条消息
  compressMessages(messages) {
    const compressed = [];
    for (const msg of messages) {
      compressed.push({
        event: msg.event,
        data: this.compressMessage(msg.data)
      });
    }
    return compressed;
  }
  
  getSocket(socketId) {
    // 获取 socket 实例的逻辑
    const wsManager = global.wsManager;
    if (wsManager && wsManager.io) {
      return wsManager.io.sockets.sockets.get(socketId);
    }
    return null;
  }
  
  // 清空队列
  clearQueue(socketId) {
    if (socketId) {
      this.pendingMessages.delete(socketId);
    } else {
      this.pendingMessages.clear();
    }
  }
}

// 消息合并策略
class MessageAggregator {
  constructor(windowMs = 100) {
    this.windowMs = windowMs;
    this.windows = new Map();
  }
  
  // 添加消息到聚合窗口
  add(deviceId, event, data) {
    const key = `${deviceId}:${event}`;
    
    if (!this.windows.has(key)) {
      this.windows.set(key, {
        messages: [],
        timer: null,
        flushed: false
      });
      
      // 设置窗口定时器
      this.windows.get(key).timer = setTimeout(() => {
        this.flush(key);
      }, this.windowMs);
    }
    
    this.windows.get(key).messages.push(data);
    
    // 限制单个窗口的消息数量
    if (this.windows.get(key).messages.length > 100) {
      this.flush(key);
    }
  }
  
  // 刷新窗口
  flush(key) {
    const window = this.windows.get(key);
    if (!window || window.flushed) return;
    
    window.flushed = true;
    
    if (window.timer) {
      clearTimeout(window.timer);
    }
    
    const [deviceId, event] = key.split(':');
    
    // 返回聚合后的消息
    return {
      deviceId,
      event,
      messages: window.messages,
      count: window.messages.length
    };
  }
  
  // 清空所有窗口
  clear() {
    for (const [key, window] of this.windows) {
      if (window.timer) {
        clearTimeout(window.timer);
      }
    }
    this.windows.clear();
  }
}

// 心跳管理
class HeartbeatManager {
  constructor(options = {}) {
    this.pingInterval = options.pingInterval || 25000;
    this.pingTimeout = options.pingTimeout || 60000;
    this.checkInterval = options.checkInterval || 30000;
    this.connections = new Map();
    this.checkTimer = null;
  }
  
  start() {
    this.checkTimer = setInterval(() => {
      this.checkAllConnections();
    }, this.checkInterval);
  }
  
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
  
  addConnection(socketId, socket) {
    this.connections.set(socketId, {
      socket,
      lastPing: Date.now(),
      missedPings: 0,
      connectedAt: Date.now()
    });
  }
  
  removeConnection(socketId) {
    this.connections.delete(socketId);
  }
  
  handlePong(socketId) {
    const conn = this.connections.get(socketId);
    if (conn) {
      conn.lastPing = Date.now();
      conn.missedPings = 0;
    }
  }
  
  checkAllConnections() {
    const now = Date.now();
    
    for (const [socketId, conn] of this.connections) {
      const idleTime = now - conn.lastPing;
      
      if (idleTime > this.pingTimeout) {
        console.log(`[心跳] 连接 ${socketId} 心跳超时，断开连接`);
        conn.socket.disconnect(true);
        this.removeConnection(socketId);
      } else if (idleTime > this.pingInterval) {
        // 发送心跳
        conn.socket.emit('ping', { timestamp: now });
      }
    }
  }
  
  getStats() {
    return {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(([id, c]) => ({
        id,
        idleTime: Date.now() - c.lastPing,
        connectedAt: c.connectedAt
      }))
    };
  }
}

// 创建单例实例
const wsOptimizer = new WebSocketOptimizer();
const messageAggregator = new MessageAggregator();
const heartbeatManager = new HeartbeatManager();

module.exports = {
  wsOptimizer,
  messageAggregator,
  heartbeatManager,
  WebSocketOptimizer,
  MessageAggregator,
  HeartbeatManager
};
