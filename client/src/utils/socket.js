/**
 * WebSocket 连接模块
 */
import { io } from 'socket.io-client'
import performanceMonitor from './performance'

const SOCKET_URL = window.location.origin

class SocketService {
  constructor() {
    this.socket = null
    this.listeners = new Map()
    this.pingTimestamps = new Map()
    this.reconnectCount = 0
    this.isConnecting = false
    this.heartbeatInterval = null
    this.lastActivityTime = Date.now()
    this.maxInactiveTime = 5 * 60 * 1000 // 5分钟无活动自动断开
    this.messageQueue = []
    this.isConnected = false
  }

  connect() {
    // 如果正在连接中，返回现有的socket
    if (this.isConnecting) {
      return this.socket
    }

    // 如果已连接，直接返回
    if (this.socket?.connected) {
      return this.socket
    }

    // 如果有旧的连接，先断开
    if (this.socket) {
      this.cleanup()
    }

    // 标记为正在连接
    this.isConnecting = true

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // 优先使用WebSocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      compress: true, // 启用数据压缩
      autoConnect: true
    })

    this.socket.on('connect', () => {
      this.reconnectCount = 0
      this.isConnecting = false
      this.isConnected = true
      this.lastActivityTime = Date.now()
      performanceMonitor.recordWebSocketConnect()
      this.emit('connected')
      
      // 启动心跳机制
      this.startHeartbeat()
      
      // 处理消息队列
      this.processMessageQueue()
    })

    this.socket.on('disconnect', (reason) => {
      this.reconnectCount++
      this.isConnecting = false
      this.isConnected = false
      performanceMonitor.recordWebSocketDisconnect()
      this.emit('disconnected', reason)
      
      // 清理心跳
      this.stopHeartbeat()
    })

    this.socket.on('connect_error', (error) => {
      this.reconnectCount++
      this.isConnecting = false
      this.isConnected = false
      this.emit('error', error)
    })

    // 设备更新事件
    this.socket.on('device:update', (data) => {
      this.lastActivityTime = Date.now()
      // 如果消息需要确认，发送 ack
      if (data._requireAck && data._messageId) {
        this.socket.emit('message:ack', data._messageId)
      }
      this.emit('device:update', data)
    })

    this.socket.on('devices:batch', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('devices:batch', data)
    })

    this.socket.on('devices:added', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('devices:added', data)
    })

    this.socket.on('devices:updated', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('devices:updated', data)
    })

    this.socket.on('device:delete', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('device:delete', data)
    })

    // 同步状态事件
    this.socket.on('sync:heartbeat', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('sync:heartbeat', data)
    })

    this.socket.on('sync:error', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('sync:error', data)
    })

    // Pong响应 - 计算延迟
    this.socket.on('pong', (data) => {
      this.lastActivityTime = Date.now()
      const pingTime = this.pingTimestamps.get('ping')
      if (pingTime) {
        const latency = Date.now() - pingTime
        performanceMonitor.recordWebSocketMessage(latency, true)
        this.pingTimestamps.delete('ping')
      }
      this.emit('pong', data)
    })

    // 分组更新事件
    this.socket.on('group:create', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('group:create', data)
    })

    this.socket.on('group:update', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('group:update', data)
    })

    this.socket.on('group:delete', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('group:delete', data)
    })

    this.socket.on('group:device_added', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('group:device_added', data)
    })

    this.socket.on('group:device_removed', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('group:device_removed', data)
    })

    // 统一的分组同步事件（方案B）
    this.socket.on('group:sync', (data) => {
      this.lastActivityTime = Date.now()
      this.emit('group:sync', data)
    })

    return this.socket
  }

  // 加入分组房间（便捷方法）
  joinGroup(groupId) {
    if (this.socket) {
      this.socket.emit('join:group', groupId)
    }
  }

  // 离开分组房间（便捷方法）
  leaveGroup(groupId) {
    if (this.socket) {
      this.socket.emit('leave:group', groupId)
    }
  }

  // 发送心跳
  ping() {
    this.pingTimestamps.set('ping', Date.now())
    this.socket?.emit('ping')
  }

  // 事件监听
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)

    // 如果是 socket 事件，注册到 socket
    if (this.socket && ['device:update', 'devices:batch', 'devices:added', 'devices:updated', 'device:delete', 'group:sync', 'group:create', 'group:update', 'group:delete', 'group:device_added', 'group:device_removed', 'sync:heartbeat', 'sync:error'].includes(event)) {
      this.socket.on(event, callback)
    }

    return () => this.off(event, callback)
  }

  off(event, callback) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }

    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  // 启动心跳机制
  startHeartbeat() {
    // 每30秒发送一次心跳
    this.heartbeatInterval = setInterval(() => {
      // 检查是否超过最大无活动时间
      if (Date.now() - this.lastActivityTime > this.maxInactiveTime) {
        this.disconnect()
        return
      }
      
      // 发送心跳
      this.ping()
    }, 30000)
  }

  // 停止心跳机制
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  // 清理连接
  cleanup() {
    this.stopHeartbeat()
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // 处理消息队列
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const { event, data, callback } = this.messageQueue.shift()
      this.socket.emit(event, data, callback)
    }
  }

  // 优化发送消息，支持消息队列
  emit(event, data, callback) {
    // 触发本地监听器
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(cb => cb(data))
    }

    // 如果是socket事件且已连接，直接发送
    if (this.socket?.connected && ['join:group', 'leave:group', 'ping'].includes(event)) {
      this.socket.emit(event, data, callback)
    } else if (['join:group', 'leave:group', 'ping'].includes(event)) {
      // 如果未连接，加入消息队列
      this.messageQueue.push({ event, data, callback })
    }
  }

  // 断开连接
  disconnect() {
    this.cleanup()
    this.isConnected = false
    this.isConnecting = false
  }

  // 获取原生 socket 实例（用于房间管理）
  getSocket() {
    return this.socket
  }

  // 加入分组房间（便捷方法）获取连接状态
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectCount: this.reconnectCount,
      lastActivity: this.lastActivityTime
    }
  }
}

// 单例
export const socketService = new SocketService()
export default socketService
