/**
 * 性能监控模块 - 客户端
 * 监控API响应时间、页面性能、资源加载等
 */

class ClientPerformanceMonitor {
  constructor() {
    this.metrics = {
      api: {
        requests: {},
        total: 0,
        errors: 0
      },
      navigation: {
        pageLoads: [],
        routeChanges: []
      },
      resources: {
        images: [],
        scripts: [],
        stylesheets: []
      },
      websocket: {
        connects: 0,
        disconnects: 0,
        messages: 0,
        errors: 0,
        latency: []
      }
    }
    
    this.alerts = []
    this.alertThresholds = {
      apiSlowResponse: 2000, // 2秒
      pageLoadSlow: 3000, // 3秒
      websocketLatencyHigh: 500, // 500ms
      apiErrorRate: 0.05 // 5%
    }
    
    this.init()
  }

  init() {
    // 监听页面加载
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        this.recordPageLoad()
      })
      
      // 监听资源加载性能
      if (window.performance && window.performance.getEntriesByType) {
        this.recordResourceTiming()
      }
    }
  }

  // 记录API请求
  recordApiRequest(url, method, duration, success = true, statusCode = 200) {
    const key = `${method.toLowerCase()} ${url}`
    
    if (!this.metrics.api.requests[key]) {
      this.metrics.api.requests[key] = {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        errors: 0,
        statusCodes: {}
      }
    }
    
    const apiMetrics = this.metrics.api.requests[key]
    apiMetrics.count++
    apiMetrics.totalDuration += duration
    apiMetrics.minDuration = Math.min(apiMetrics.minDuration, duration)
    apiMetrics.maxDuration = Math.max(apiMetrics.maxDuration, duration)
    
    // 记录状态码
    if (!apiMetrics.statusCodes[statusCode]) {
      apiMetrics.statusCodes[statusCode] = 0
    }
    apiMetrics.statusCodes[statusCode]++
    
    if (!success || statusCode >= 400) {
      apiMetrics.errors++
      this.metrics.api.errors++
    }
    
    this.metrics.api.total++
    
    // 检查告警
    if (duration > this.alertThresholds.apiSlowResponse) {
      this.addAlert('api', `API响应慢: ${key} (${duration}ms)`, 'warning')
    }
    
    if (!success || statusCode >= 500) {
      this.addAlert('api', `API失败: ${key} (${statusCode})`, 'error')
    }
  }

  // 记录页面加载
  recordPageLoad() {
    if (!window.performance || !window.performance.timing) return
    
    const timing = window.performance.timing
    const pageLoad = {
      timestamp: Date.now(),
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      request: timing.responseStart - timing.requestStart,
      response: timing.responseEnd - timing.responseStart,
      dom: timing.domComplete - timing.domLoading,
      load: timing.loadEventEnd - timing.loadEventStart,
      total: timing.loadEventEnd - timing.navigationStart
    }
    
    this.metrics.navigation.pageLoads.push(pageLoad)
    
    // 只保留最近50次页面加载记录
    if (this.metrics.navigation.pageLoads.length > 50) {
      this.metrics.navigation.pageLoads.shift()
    }
    
    // 检查告警
    if (pageLoad.total > this.alertThresholds.pageLoadSlow) {
      this.addAlert('navigation', `页面加载慢: ${pageLoad.total}ms`, 'warning')
    }
  }

  // 记录资源加载
  recordResourceTiming() {
    const resources = window.performance.getEntriesByType('resource')
    
    resources.forEach(resource => {
      const resourceData = {
        name: resource.name,
        type: this.getResourceType(resource.name),
        duration: resource.duration,
        size: resource.transferSize,
        timestamp: resource.startTime
      }
      
      if (resourceData.type === 'image') {
        this.metrics.resources.images.push(resourceData)
      } else if (resourceData.type === 'script') {
        this.metrics.resources.scripts.push(resourceData)
      } else if (resourceData.type === 'stylesheet') {
        this.metrics.resources.stylesheets.push(resourceData)
      }
    })
    
    // 只保留最近的资源记录
    const maxRecords = 100
    if (this.metrics.resources.images.length > maxRecords) {
      this.metrics.resources.images = this.metrics.resources.images.slice(-maxRecords)
    }
    if (this.metrics.resources.scripts.length > maxRecords) {
      this.metrics.resources.scripts = this.metrics.resources.scripts.slice(-maxRecords)
    }
    if (this.metrics.resources.stylesheets.length > maxRecords) {
      this.metrics.resources.stylesheets = this.metrics.resources.stylesheets.slice(-maxRecords)
    }
  }

  // 获取资源类型
  getResourceType(url) {
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
      return 'image'
    } else if (url.match(/\.js$/i)) {
      return 'script'
    } else if (url.match(/\.css$/i)) {
      return 'stylesheet'
    } else if (url.match(/\.(woff|woff2|ttf|eot)$/i)) {
      return 'font'
    } else {
      return 'other'
    }
  }

  // 记录WebSocket连接
  recordWebSocketConnect() {
    this.metrics.websocket.connects++
  }

  recordWebSocketDisconnect() {
    this.metrics.websocket.disconnects++
  }

  recordWebSocketMessage(duration, success = true) {
    this.metrics.websocket.messages++
    
    if (duration) {
      this.metrics.websocket.latency.push({
        duration,
        timestamp: Date.now()
      })
      
      // 只保留最近100条延迟记录
      if (this.metrics.websocket.latency.length > 100) {
        this.metrics.websocket.latency.shift()
      }
      
      // 检查告警
      if (duration > this.alertThresholds.websocketLatencyHigh) {
        this.addAlert('websocket', `WebSocket延迟高: ${duration}ms`, 'warning')
      }
    }
    
    if (!success) {
      this.metrics.websocket.errors++
      this.addAlert('websocket', 'WebSocket消息失败', 'error')
    }
  }

  // 添加告警
  addAlert(type, message, level = 'info') {
    const alert = {
      id: Date.now() + Math.random(),
      type,
      message,
      level,
      timestamp: Date.now()
    }
    
    this.alerts.unshift(alert)
    
    // 只保留最近50条告警
    if (this.alerts.length > 50) {
      this.alerts.pop()
    }
    
    console.log(`[性能监控] [${level.toUpperCase()}] ${message}`)
  }

  // 获取性能统计
  getStats() {
    return {
      api: this.getApiStats(),
      navigation: this.getNavigationStats(),
      resources: this.getResourceStats(),
      websocket: this.getWebSocketStats(),
      alerts: this.alerts.slice(0, 10) // 最近10条告警
    }
  }

  // 获取API统计
  getApiStats() {
    const stats = {
      total: this.metrics.api.total,
      errors: this.metrics.api.errors,
      errorRate: this.metrics.api.total > 0 ? this.metrics.api.errors / this.metrics.api.total : 0,
      endpoints: {}
    }
    
    Object.entries(this.metrics.api.requests).forEach(([endpoint, data]) => {
      stats.endpoints[endpoint] = {
        count: data.count,
        avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
        minDuration: data.minDuration === Infinity ? 0 : data.minDuration,
        maxDuration: data.maxDuration,
        errors: data.errors,
        errorRate: data.count > 0 ? data.errors / data.count : 0,
        statusCodes: data.statusCodes
      }
    })
    
    return stats
  }

  // 获取导航统计
  getNavigationStats() {
    const pageLoads = this.metrics.navigation.pageLoads
    
    if (pageLoads.length === 0) {
      return { avgLoadTime: 0, recentLoads: [] }
    }
    
    const sortedLoads = [...pageLoads].sort((a, b) => a.total - b.total)
    
    return {
      avgLoadTime: pageLoads.reduce((sum, load) => sum + load.total, 0) / pageLoads.length,
      minLoadTime: sortedLoads[0].total,
      maxLoadTime: sortedLoads[sortedLoads.length - 1].total,
      p95LoadTime: sortedLoads[Math.floor(pageLoads.length * 0.95)].total,
      recentLoads: pageLoads.slice(-5)
    }
  }

  // 获取资源统计
  getResourceStats() {
    const calculateStats = (resources) => {
      if (resources.length === 0) {
        return { count: 0, avgDuration: 0, avgSize: 0 }
      }
      
      return {
        count: resources.length,
        avgDuration: resources.reduce((sum, r) => sum + r.duration, 0) / resources.length,
        avgSize: resources.reduce((sum, r) => sum + (r.size || 0), 0) / resources.length
      }
    }
    
    return {
      images: calculateStats(this.metrics.resources.images),
      scripts: calculateStats(this.metrics.resources.scripts),
      stylesheets: calculateStats(this.metrics.resources.stylesheets)
    }
  }

  // 获取WebSocket统计
  getWebSocketStats() {
    const latency = this.metrics.websocket.latency
    const sortedLatency = [...latency].sort((a, b) => a.duration - b.duration)
    
    return {
      connects: this.metrics.websocket.connects,
      disconnects: this.metrics.websocket.disconnects,
      connections: this.metrics.websocket.connects - this.metrics.websocket.disconnects,
      messages: this.metrics.websocket.messages,
      errors: this.metrics.websocket.errors,
      errorRate: this.metrics.websocket.messages > 0 ? this.metrics.websocket.errors / this.metrics.websocket.messages : 0,
      avgLatency: latency.length > 0 ? latency.reduce((sum, l) => sum + l.duration, 0) / latency.length : 0,
      minLatency: latency.length > 0 ? sortedLatency[0].duration : 0,
      maxLatency: latency.length > 0 ? sortedLatency[sortedLatency.length - 1].duration : 0,
      p95Latency: latency.length > 0 ? sortedLatency[Math.floor(latency.length * 0.95)].duration : 0
    }
  }

  // 清除旧数据
  clearOldData() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    
    // 清除告警
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneHourAgo)
    
    // 清除WebSocket延迟记录
    this.metrics.websocket.latency = this.metrics.websocket.latency.filter(
      l => l.timestamp > oneHourAgo
    )
    
    console.log('[性能监控] 已清除旧数据')
  }

  // 重置监控
  reset() {
    this.metrics = {
      api: {
        requests: {},
        total: 0,
        errors: 0
      },
      navigation: {
        pageLoads: [],
        routeChanges: []
      },
      resources: {
        images: [],
        scripts: [],
        stylesheets: []
      },
      websocket: {
        connects: 0,
        disconnects: 0,
        messages: 0,
        errors: 0,
        latency: []
      }
    }
    this.alerts = []
    
    console.log('[性能监控] 已重置')
  }
}

// 创建单例
const clientPerformanceMonitor = new ClientPerformanceMonitor()

// 定期清除旧数据
if (typeof window !== 'undefined') {
  setInterval(() => {
    clientPerformanceMonitor.clearOldData()
  }, 30 * 60 * 1000) // 每30分钟
}

export default clientPerformanceMonitor
