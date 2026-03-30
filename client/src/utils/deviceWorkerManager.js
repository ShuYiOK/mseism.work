/**
 * Web Worker 管理器
 * 提供统一的接口来调用 Worker 进行大数据计算
 */

class DeviceWorkerManager {
  constructor() {
    this.worker = null
    this.pendingRequests = new Map()
    this.requestId = 0
    this.initialized = false
  }

  // 初始化 Worker
  init() {
    if (this.initialized) {
      return
    }

    try {
      // 使用 Vite 的 Worker 导入方式
      this.worker = new Worker(
        new URL('./device-worker.js', import.meta.url),
        { type: 'module' }
      )

      this.worker.onmessage = this.handleMessage.bind(this)
      this.worker.onerror = this.handleError.bind(this)
      this.initialized = true
    } catch (error) {
      // 降级到主线程执行
      this.initialized = false
    }
  }

  // 处理 Worker 消息
  handleMessage(event) {
    const { type, result, error, success, requestId: reqId } = event.data
    
    const pending = this.pendingRequests.get(reqId)
    if (pending) {
      this.pendingRequests.delete(reqId)
      
      if (success) {
        pending.resolve(result)
      } else {
        pending.reject(new Error(error))
      }
    }
  }

  // 处理 Worker 错误
  handleError(error) {
    console.error('[DeviceWorker] Worker 错误:', error)
    
    // 拒绝所有待处理的请求
    for (const [reqId, pending] of this.pendingRequests.entries()) {
      this.pendingRequests.delete(reqId)
      pending.reject(error)
    }
  }

  // 发送请求到 Worker
  sendRequest(type, payload) {
    return new Promise((resolve, reject) => {
      // 如果 Worker 未初始化或不可用，降级到主线程执行
    if (!this.initialized || !this.worker) {
      this.executeOnMainThread(type, payload).then(resolve).catch(reject)
      return
    }

      const reqId = ++this.requestId
      this.pendingRequests.set(reqId, { resolve, reject, timestamp: Date.now() })

      try {
        // 尝试序列化payload，检查是否包含无法序列化的对象
        JSON.stringify(payload)
        this.worker.postMessage({ type, payload, requestId: reqId })
        
        // 设置超时
        setTimeout(() => {
          if (this.pendingRequests.has(reqId)) {
            this.pendingRequests.delete(reqId)
            reject(new Error('Worker 请求超时'))
          }
        }, 30000) // 30 秒超时
      } catch (error) {
        this.pendingRequests.delete(reqId)
        // 降级到主线程执行
        this.executeOnMainThread(type, payload).then(resolve).catch(reject)
      }
    })
  }

  // 在主线程执行（降级方案）
  async executeOnMainThread(type, payload) {
    // 模拟 Worker 的函数（从 worker 复制）
    const mainThreadFunctions = {
      calculateStats: (devices) => {
        const total = devices.length
        const online = devices.filter(d => d.online).length
        const offline = total - online
        return { total, online, offline }
      },
      filterDevices: (devices, filters) => {
        let result = [...devices]
        if (filters.status !== undefined) {
          result = result.filter(d => d.online === filters.status)
        }
        if (filters.groupId) {
          result = result.filter(d => d.groupId === filters.groupId)
        }
        if (filters.search) {
          const searchLower = filters.search.toLowerCase()
          result = result.filter(d => 
            d.id.toLowerCase().includes(searchLower) ||
            d.name.toLowerCase().includes(searchLower)
          )
        }
        return result
      },
      sortDevices: (devices, sortBy, order = 'asc') => {
        return [...devices].sort((a, b) => {
          let aVal = a[sortBy] || 0
          let bVal = b[sortBy] || 0
          if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase()
            bVal = bVal.toLowerCase()
          }
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          return order === 'asc' ? comparison : -comparison
        })
      },
      calculateHealthScore: (devices) => {
        return devices.map(d => {
          let score = 100
          if (!d.online) score -= 50
          if (d.temperature > 80) score -= 20
          else if (d.temperature > 60) score -= 10
          if (d.storage_usage > 90) score -= 20
          else if (d.storage_usage > 70) score -= 10
          if (d.cpu_usage > 500) score -= 15
          else if (d.cpu_usage > 200) score -= 5
          return {
            deviceId: d.id,
            score: Math.max(0, score),
            level: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical'
          }
        })
      },
      detectAnomalies: (devices) => {
        const anomalies = []
        devices.forEach(d => {
          const deviceAnomalies = []
          if (!d.online) deviceAnomalies.push({ type: 'offline', severity: 'critical' })
          if (d.temperature > 80) deviceAnomalies.push({ type: 'high_temperature', severity: 'critical' })
          if (d.storage_usage > 90) deviceAnomalies.push({ type: 'high_storage', severity: 'warning' })
          if (d.cpu_usage > 500) deviceAnomalies.push({ type: 'high_latency', severity: 'warning' })
          if (deviceAnomalies.length > 0) {
            anomalies.push({ deviceId: d.id, deviceName: d.name, anomalies: deviceAnomalies })
          }
        })
        return anomalies
      }
    }

    const fn = mainThreadFunctions[type]
    if (!fn) {
      throw new Error(`未知操作类型：${type}`)
    }
    
    // 使用 setTimeout 模拟异步
    return new Promise(resolve => {
      setTimeout(() => {
        // 确保payload是一个对象
        if (!payload || typeof payload !== 'object') {
          resolve([])
          return
        }
        
        // 根据不同类型提取正确的参数
        let result
        switch (type) {
          case 'calculateStats':
            result = fn(Array.isArray(payload.devices) ? payload.devices : [])
            break
          case 'filterDevices':
            result = fn(Array.isArray(payload.devices) ? payload.devices : [], payload.filters || {})
            break
          case 'sortDevices':
            result = fn(Array.isArray(payload.devices) ? payload.devices : [], payload.sortBy, payload.order)
            break
          case 'calculateHealthScore':
            result = fn(Array.isArray(payload.devices) ? payload.devices : [])
            break
          case 'detectAnomalies':
            result = fn(Array.isArray(payload.devices) ? payload.devices : [])
            break
          default:
            result = fn(payload)
        }
        resolve(result)
      }, 0)
    })
  }

  // 公开的方法

  // 计算统计信息
  async calculateStats(devices) {
    return this.sendRequest('calculateStats', { devices: devices || [] })
  }

  // 过滤设备
  async filterDevices(devices, filters) {
    return this.sendRequest('filterDevices', { devices: devices || [], filters: filters || {} })
  }

  // 排序设备
  async sortDevices(devices, sortBy, order = 'asc') {
    return this.sendRequest('sortDevices', { devices: devices || [], sortBy, order })
  }

  // 计算健康分数
  async calculateHealthScore(devices) {
    return this.sendRequest('calculateHealthScore', { devices: devices || [] })
  }

  // 检测异常
  async detectAnomalies(devices, thresholds) {
    return this.sendRequest('detectAnomalies', { devices: devices || [], thresholds: thresholds || {} })
  }

  // 销毁 Worker
  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
      this.initialized = false
      this.pendingRequests.clear()
    }
  }
}

// 单例模式
let instance = null

export function getDeviceWorker() {
  if (!instance) {
    instance = new DeviceWorkerManager()
  }
  return instance
}

export default getDeviceWorker
