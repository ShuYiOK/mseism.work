/**
 * 性能监控工具
 */

// 性能数据存储
const performanceData = {
  apiRequests: [],
  websocket: {
    connectCount: 0,
    disconnectCount: 0,
    messageCount: 0,
    errorCount: 0,
    totalLatency: 0
  },
  alerts: [],
  startTime: Date.now()
}

/**
 * 性能监控对象
 */
const performanceMonitor = {
  /**
   * 记录API请求
   * @param {string} endpoint - API端点
   * @param {number} duration - 执行时间（毫秒）
   * @param {boolean} success - 是否成功
   */
  recordApiRequest(endpoint, duration, success) {
    performanceData.apiRequests.push({
      endpoint,
      duration,
      success,
      timestamp: Date.now()
    })
    
    // 限制存储数量
    if (performanceData.apiRequests.length > 1000) {
      performanceData.apiRequests.shift()
    }
  },
  
  /**
   * 记录WebSocket连接
   */
  recordWebSocketConnect() {
    performanceData.websocket.connectCount++
  },
  
  /**
   * 记录WebSocket断开
   */
  recordWebSocketDisconnect() {
    performanceData.websocket.disconnectCount++
  },
  
  /**
   * 记录WebSocket消息
   * @param {number} latency - 延迟时间（毫秒）
   * @param {boolean} success - 是否成功
   */
  recordWebSocketMessage(latency, success) {
    performanceData.websocket.messageCount++
    if (success && latency) {
      performanceData.websocket.totalLatency += latency
    } else if (!success) {
      performanceData.websocket.errorCount++
    }
  },
  
  /**
   * 添加告警
   * @param {string} type - 告警类型
   * @param {string} message - 告警消息
   * @param {string} level - 告警级别
   */
  addAlert(type, message, level) {
    performanceData.alerts.push({
      type,
      message,
      level,
      timestamp: Date.now()
    })
    
    // 限制存储数量
    if (performanceData.alerts.length > 100) {
      performanceData.alerts.shift()
    }
  },
  
  /**
   * 获取性能统计数据
   * @returns {Object} 性能统计数据
   */
  getStats() {
    const now = Date.now()
    const uptime = now - performanceData.startTime
    
    // 计算API请求统计
    const apiStats = performanceData.apiRequests.reduce((acc, req) => {
      acc.totalRequests++
      if (req.success) {
        acc.successCount++
        acc.totalDuration += req.duration
      } else {
        acc.errorCount++
      }
      return acc
    }, { totalRequests: 0, successCount: 0, errorCount: 0, totalDuration: 0 })
    
    const avgApiDuration = apiStats.totalRequests > 0 ? apiStats.totalDuration / apiStats.totalRequests : 0
    
    // 计算WebSocket统计
    const avgWsLatency = performanceData.websocket.messageCount > 0 
      ? performanceData.websocket.totalLatency / performanceData.websocket.messageCount 
      : 0
    
    return {
      uptime,
      api: {
        ...apiStats,
        averageDuration: avgApiDuration
      },
      websocket: {
        ...performanceData.websocket,
        averageLatency: avgWsLatency
      },
      alerts: performanceData.alerts
    }
  },
  
  /**
   * 重置性能监控
   */
  reset() {
    performanceData.apiRequests = []
    performanceData.websocket = {
      connectCount: 0,
      disconnectCount: 0,
      messageCount: 0,
      errorCount: 0,
      totalLatency: 0
    }
    performanceData.alerts = []
    performanceData.startTime = Date.now()
  }
}

/**
 * 防抖函数 - 延迟执行函数，直到用户停止触发事件一段时间后才执行
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} - 防抖处理后的函数
 */
export function debounce(func, delay = 100, immediate = false) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func.apply(this, args)
    }
    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, delay)
    if (callNow) func.apply(this, args)
  }
}

/**
 * 节流函数 - 限制函数的执行频率，确保一定时间内只执行一次
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} - 节流处理后的函数
 */
export function throttle(func, limit = 16) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 滚动事件的节流处理 - 特别优化的滚动事件处理
 * @param {Function} func - 滚动时要执行的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} - 节流处理后的滚动事件处理函数
 */
export function throttleScroll(func, limit = 16) {
  return throttle(func, limit)
}

/**
 * 输入事件的防抖处理 - 特别优化的输入事件处理
 * @param {Function} func - 输入时要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} - 防抖处理后的输入事件处理函数
 */
export function debounceInput(func, delay = 300) {
  return debounce(func, delay)
}

/**
 * 调整大小事件的防抖处理 - 特别优化的调整大小事件处理
 * @param {Function} func - 调整大小时要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} - 防抖处理后的调整大小事件处理函数
 */
export function debounceResize(func, delay = 200) {
  return debounce(func, delay)
}

// 导出默认的performanceMonitor对象
export default performanceMonitor