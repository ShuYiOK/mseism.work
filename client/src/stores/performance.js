/**
 * 性能监控 Store
 * 管理前后端性能数据
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import performanceMonitor from '../utils/performance'

export const usePerformanceStore = defineStore('performance', () => {
  // 状态
  const stats = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // 获取前端性能统计
  const getClientStats = () => {
    return performanceMonitor.getStats()
  }

  // 获取后端性能统计
  const fetchServerStats = async () => {
    try {
      loading.value = true
      const response = await fetch('/api/performance/stats')
      const result = await response.json()
      
      if (result.success) {
        stats.value = result.data
      }
      return result
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 重置前端监控
  const resetClientMonitor = () => {
    performanceMonitor.reset()
  }

  // 重置后端监控
  const resetServerMonitor = async () => {
    try {
      const response = await fetch('/api/performance/stats', {
        method: 'POST'
      })
      const result = await response.json()
      return result
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  // 获取告警信息
  const getAlerts = () => {
    const clientStats = getClientStats()
    const alerts = []
    
    // 前端告警
    if (clientStats.alerts) {
      alerts.push(...clientStats.alerts.map(a => ({
        ...a,
        source: 'client'
      })))
    }
    
    // 后端告警
    if (stats.value && stats.value.alerts) {
      alerts.push(...stats.value.alerts.map(a => ({
        ...a,
        source: 'server'
      })))
    }
    
    // 按时间排序
    return alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20)
  }

  return {
    // 状态
    stats,
    loading,
    error,
    // 方法
    getClientStats,
    fetchServerStats,
    resetClientMonitor,
    resetServerMonitor,
    getAlerts
  }
})
