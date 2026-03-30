/**
 * 动态同步频率管理器
 * 根据设备在线/离线状态动态调整数据同步频率
 * 
 * 策略：
 * - 在线设备多：提高同步频率（更快响应）
 * - 离线设备多：降低同步频率（节省资源）
 * - 网络状况差：降低同步频率
 * - 页面不可见：暂停或极低频率同步
 */

class DynamicSyncManager {
  constructor() {
    // 同步间隔配置（毫秒）
    this.config = {
      // 基础同步间隔
      baseInterval: 5000,
      // 最小同步间隔（最快）
      minInterval: 1000,
      // 最大同步间隔（最慢）
      maxInterval: 30000,
      // 在线设备阈值
      onlineThreshold: {
        high: 50,    // 在线设备 > 50，高频同步
        medium: 20,  // 在线设备 20-50，中频同步
        low: 5       // 在线设备 < 5，低频同步
      },
      // 离线设备比例阈值
      offlineRatioThreshold: {
        high: 0.5,   // 离线比例 > 50%，降低频率
        critical: 0.8 // 离线比例 > 80%，极低频率
      },
      // 网络延迟阈值（毫秒）
      latencyThreshold: {
        good: 100,
        moderate: 300,
        poor: 500
      },
      // 页面可见时是否启用
      enableWhenVisible: true,
      // 页面隐藏时的同步间隔
      hiddenInterval: 60000,
      // 暂停同步时的间隔
      pausedInterval: 300000
    }

    // 当前状态
    this.state = {
      isRunning: false,
      currentInterval: this.config.baseInterval,
      deviceStats: {
        total: 0,
        online: 0,
        offline: 0,
        offlineRatio: 0
      },
      networkLatency: 0,
      isPageVisible: true,
      lastSyncTime: 0,
      syncCount: 0,
      adjustmentCount: 0
    }

    // 定时器
    this.syncTimer = null
    
    // 回调函数
    this.onSyncCallback = null
    this.onAdjustCallback = null
    
    // 事件监听器
    this.listeners = new Map()
    
    // 性能指标
    this.metrics = {
      adjustments: [],
      syncHistory: [],
      averageInterval: 0
    }
  }

  /**
   * 启动动态同步
   */
  start(onSync) {
    if (this.state.isRunning) {
      console.log('[DynamicSync] 已在运行中')
      return
    }

    this.state.isRunning = true
    this.onSyncCallback = onSync

    // 监听页面可见性变化
    this.setupVisibilityListener()
    
    // 监听网络状态变化
    this.setupNetworkListener()

    // 开始同步循环
    this.startSyncLoop()

    this.emit('start', { interval: this.state.currentInterval })
    console.log('[DynamicSync] 已启动，初始间隔:', this.state.currentInterval, 'ms')
  }

  /**
   * 停止动态同步
   */
  stop() {
    this.state.isRunning = false
    
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }

    this.removeVisibilityListener()
    this.removeNetworkListener()

    this.emit('stop')
    console.log('[DynamicSync] 已停止')
  }

  /**
   * 开始同步循环
   */
  startSyncLoop() {
    if (!this.state.isRunning) return

    const executeSync = () => {
      if (!this.state.isRunning) return

      const now = Date.now()
      this.state.lastSyncTime = now
      this.state.syncCount++

      // 记录同步历史
      this.metrics.syncHistory.push({
        time: now,
        interval: this.state.currentInterval,
        deviceStats: { ...this.state.deviceStats }
      })
      
      // 保留最近 100 次同步记录
      if (this.metrics.syncHistory.length > 100) {
        this.metrics.syncHistory.shift()
      }

      // 执行同步回调
      if (typeof this.onSyncCallback === 'function') {
        try {
          this.onSyncCallback({
            interval: this.state.currentInterval,
            deviceStats: this.state.deviceStats,
            networkLatency: this.state.networkLatency,
            isPageVisible: this.state.isPageVisible
          })
        } catch (error) {
          console.error('[DynamicSync] 同步回调错误:', error)
        }
      }

      // 计算下次同步间隔
      this.adjustInterval()

      // 设置下次同步
      this.syncTimer = setTimeout(executeSync, this.state.currentInterval)
    }

    // 立即执行第一次同步
    executeSync()
  }

  /**
   * 根据设备状态和网络状况调整同步间隔
   */
  adjustInterval() {
    const { deviceStats, networkLatency, isPageVisible } = this.state
    let newInterval = this.config.baseInterval
    let reason = []

    // 页面不可见时使用特殊间隔
    if (!isPageVisible) {
      newInterval = this.config.hiddenInterval
      reason.push('页面隐藏')
    } else {
      // 根据在线设备数量调整
      const onlineFactor = this.getOnlineFactor(deviceStats.online)
      if (onlineFactor !== 1) {
        newInterval *= onlineFactor
        reason.push(`在线设备：${deviceStats.online}`)
      }

      // 根据离线比例调整
      const offlineRatioFactor = this.getOfflineRatioFactor(deviceStats.offlineRatio)
      if (offlineRatioFactor !== 1) {
        newInterval *= offlineRatioFactor
        reason.push(`离线比例：${(deviceStats.offlineRatio * 100).toFixed(1)}%`)
      }

      // 根据网络延迟调整
      const latencyFactor = this.getLatencyFactor(networkLatency)
      if (latencyFactor !== 1) {
        newInterval *= latencyFactor
        reason.push(`网络延迟：${networkLatency}ms`)
      }
    }

    // 限制在最小和最大间隔之间
    newInterval = Math.max(this.config.minInterval, Math.min(this.config.maxInterval, newInterval))
    newInterval = Math.round(newInterval / 1000) * 1000 // 取整到秒

    // 记录调整
    const adjusted = newInterval !== this.state.currentInterval
    if (adjusted) {
      const previousInterval = this.state.currentInterval
      this.state.currentInterval = newInterval
      this.state.adjustmentCount++

      this.metrics.adjustments.push({
        time: Date.now(),
        previousInterval,
        newInterval,
        reason: reason.join(', '),
        deviceStats: { ...deviceStats },
        networkLatency
      })

      // 保留最近 50 次调整记录
      if (this.metrics.adjustments.length > 50) {
        this.metrics.adjustments.shift()
      }

      // 计算平均间隔
      this.updateAverageInterval()

      this.emit('adjust', {
        previousInterval,
        newInterval,
        reason: reason.join(', '),
        deviceStats,
        networkLatency
      })

      console.log('[DynamicSync] 调整间隔:', previousInterval, '->', newInterval, 'ms |', reason.join(', '))
    }

    return newInterval
  }

  /**
   * 根据在线设备数量获取调整因子
   */
  getOnlineFactor(onlineCount) {
    const { high, medium, low } = this.config.onlineThreshold

    if (onlineCount >= high) {
      // 在线设备多，提高频率（减小间隔）
      return 0.5
    } else if (onlineCount >= medium) {
      // 中等数量
      return 0.75
    } else if (onlineCount >= low) {
      // 较少设备
      return 1
    } else {
      // 很少设备，降低频率
      return 1.5
    }
  }

  /**
   * 根据离线比例获取调整因子
   */
  getOfflineRatioFactor(offlineRatio) {
    const { high, critical } = this.config.offlineRatioThreshold

    if (offlineRatio >= critical) {
      // 离线比例极高，大幅降低频率
      return 2
    } else if (offlineRatio >= high) {
      // 离线比例高，降低频率
      return 1.5
    }
    
    return 1
  }

  /**
   * 根据网络延迟获取调整因子
   */
  getLatencyFactor(latency) {
    const { good, moderate, poor } = this.config.latencyThreshold

    if (latency <= good) {
      // 网络状况好
      return 1
    } else if (latency <= moderate) {
      // 网络状况一般
      return 1.2
    } else if (latency <= poor) {
      // 网络状况较差
      return 1.5
    } else {
      // 网络状况差，大幅降低频率
      return 2
    }
  }

  /**
   * 更新设备统计信息
   */
  updateDeviceStats(devices) {
    const total = devices.length
    const online = devices.filter(d => d.online).length
    const offline = total - online
    const offlineRatio = total > 0 ? offline / total : 0

    const changed = (
      this.state.deviceStats.total !== total ||
      this.state.deviceStats.online !== online ||
      this.state.deviceStats.offline !== offline
    )

    this.state.deviceStats = {
      total,
      online,
      offline,
      offlineRatio
    }

    if (changed && this.state.isRunning) {
      this.emit('statsUpdate', this.state.deviceStats)
    }

    return this.state.deviceStats
  }

  /**
   * 更新网络延迟
   */
  updateNetworkLatency(latency) {
    const changed = this.state.networkLatency !== latency
    this.state.networkLatency = latency

    if (changed && this.state.isRunning) {
      this.emit('latencyUpdate', { latency })
    }

    return latency
  }

  /**
   * 设置页面可见性监听
   */
  setupVisibilityListener() {
    this.handleVisibilityChange = () => {
      const wasVisible = this.state.isPageVisible
      this.state.isPageVisible = !document.hidden

      if (wasVisible !== this.state.isPageVisible) {
        console.log('[DynamicSync] 页面可见性变化:', this.state.isPageVisible ? '可见' : '隐藏')
        this.emit('visibilityChange', { isPageVisible: this.state.isPageVisible })
        
        // 页面从隐藏变为可见时，立即调整间隔
        if (this.state.isPageVisible && this.state.isRunning) {
          this.adjustInterval()
        }
      }
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  /**
   * 移除页面可见性监听
   */
  removeVisibilityListener() {
    if (this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    }
  }

  /**
   * 设置网络状态监听
   */
  setupNetworkListener() {
    this.handleOnline = () => {
      console.log('[DynamicSync] 网络恢复连接')
      this.emit('networkOnline')
      if (this.state.isRunning) {
        this.adjustInterval()
      }
    }

    this.handleOffline = () => {
      console.log('[DynamicSync] 网络连接断开')
      this.emit('networkOffline')
    }

    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  /**
   * 移除网络状态监听
   */
  removeNetworkListener() {
    if (this.handleOnline) {
      window.removeEventListener('online', this.handleOnline)
    }
    if (this.handleOffline) {
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  /**
   * 更新平均间隔
   */
  updateAverageInterval() {
    if (this.metrics.adjustments.length > 0) {
      const total = this.metrics.adjustments.reduce((sum, adj) => sum + adj.newInterval, 0)
      this.metrics.averageInterval = Math.round(total / this.metrics.adjustments.length)
    }
  }

  /**
   * 事件监听
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)

    return () => this.off(event, callback)
  }

  off(event, callback) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  emit(event, data) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.forEach(cb => cb(data))
    }
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      isRunning: this.state.isRunning,
      currentInterval: this.state.currentInterval,
      deviceStats: this.state.deviceStats,
      networkLatency: this.state.networkLatency,
      isPageVisible: this.state.isPageVisible,
      lastSyncTime: this.state.lastSyncTime,
      syncCount: this.state.syncCount,
      adjustmentCount: this.state.adjustmentCount,
      averageInterval: this.metrics.averageInterval
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics() {
    return {
      adjustments: this.metrics.adjustments,
      syncHistory: this.metrics.syncHistory.slice(-20), // 最近 20 次
      averageInterval: this.metrics.averageInterval,
      totalAdjustments: this.metrics.adjustments.length,
      totalSyncs: this.metrics.syncHistory.length
    }
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics.adjustments = []
    this.metrics.syncHistory = []
    this.metrics.averageInterval = 0
    this.state.adjustmentCount = 0
    this.state.syncCount = 0
  }

  /**
   * 手动触发同步
   */
  forceSync() {
    if (typeof this.onSyncCallback === 'function') {
      this.onSyncCallback({
        interval: this.state.currentInterval,
        deviceStats: this.state.deviceStats,
        networkLatency: this.state.networkLatency,
        isPageVisible: this.state.isPageVisible,
        isForced: true
      })
      this.state.syncCount++
      console.log('[DynamicSync] 手动触发同步')
    }
  }

  /**
   * 暂停同步
   */
  pause() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
      this.syncTimer = null
    }
    this.state.isRunning = false
    this.emit('pause')
    console.log('[DynamicSync] 已暂停')
  }

  /**
   * 恢复同步
   */
  resume() {
    if (!this.state.isRunning) {
      this.state.isRunning = true
      this.startSyncLoop()
      this.emit('resume')
      console.log('[DynamicSync] 已恢复')
    }
  }
}

// 单例
let instance = null

export function getSyncManager() {
  if (!instance) {
    instance = new DynamicSyncManager()
  }
  return instance
}

export default getSyncManager
