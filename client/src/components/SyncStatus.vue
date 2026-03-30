<template>
  <div class="sync-status" :class="{ expanded: isExpanded }">
    <div class="sync-status-header" @click="toggleExpand">
      <span class="status-indicator" :class="statusClass"></span>
      <span class="status-text">{{ statusText }}</span>
      <span class="sync-interval">{{ formatInterval(currentInterval) }}</span>
      <span class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
    </div>

    <div v-if="isExpanded" class="sync-status-details">
      <!-- 设备统计 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">总数</span>
          <span class="stat-value">{{ deviceStats.total }}</span>
        </div>
        <div class="stat-item online">
          <span class="stat-label">在线</span>
          <span class="stat-value">{{ deviceStats.online }}</span>
        </div>
        <div class="stat-item offline">
          <span class="stat-label">离线</span>
          <span class="stat-value">{{ deviceStats.offline }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">离线比例</span>
          <span class="stat-value">{{ (deviceStats.offlineRatio * 100).toFixed(1) }}%</span>
        </div>
      </div>

      <!-- 网络状态 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">网络延迟</span>
          <span class="stat-value" :class="latencyClass">{{ networkLatency }}ms</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">页面状态</span>
          <span class="stat-value">{{ isPageVisible ? '可见' : '隐藏' }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">平均间隔</span>
          <span class="stat-value">{{ formatInterval(averageInterval) }}</span>
        </div>
      </div>

      <!-- 同步统计 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">同步次数</span>
          <span class="stat-value">{{ syncCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">调整次数</span>
          <span class="stat-value">{{ adjustmentCount }}</span>
        </div>
      </div>

      <!-- 调整历史 -->
      <div v-if="adjustments.length > 0" class="adjustments-section">
        <div class="section-title">
          <span>同步调整历史</span>
          <button @click="clearAdjustments" class="clear-btn">清空</button>
        </div>
        <div class="adjustments-list">
          <div v-for="(adj, index) in recentAdjustments" :key="index" class="adjustment-item">
            <div class="adjustment-time">{{ formatTime(adj.time) }}</div>
            <div class="adjustment-details">
              <span class="interval-change">
                {{ formatInterval(adj.previousInterval) }} → {{ formatInterval(adj.newInterval) }}
              </span>
              <span class="adjustment-reason">{{ adj.reason }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="control-buttons">
        <button @click="forceSync" class="btn btn-primary" :disabled="!isRunning">
          立即同步
        </button>
        <button @click="togglePause" class="btn btn-secondary" :disabled="!isRunning">
          {{ isPaused ? '恢复' : '暂停' }}
        </button>
        <button @click="resetMetrics" class="btn btn-warning">
          重置统计
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSyncManager } from '../utils/dynamicSyncManager'

const props = defineProps({
  // 是否默认展开
  defaultExpanded: {
    type: Boolean,
    default: false
  }
})

const syncManager = getSyncManager()

// 状态
const isExpanded = ref(props.defaultExpanded)
const isRunning = ref(false)
const isPaused = ref(false)
const currentInterval = ref(5000)
const deviceStats = ref({ total: 0, online: 0, offline: 0, offlineRatio: 0 })
const networkLatency = ref(0)
const isPageVisible = ref(true)
const syncCount = ref(0)
const adjustmentCount = ref(0)
const averageInterval = ref(0)
const adjustments = ref([])

// 计算属性
const statusClass = computed(() => {
  if (!isRunning.value) return 'stopped'
  if (isPaused.value) return 'paused'
  if (!isPageVisible.value) return 'hidden'
  if (currentInterval.value <= 2000) return 'fast'
  if (currentInterval.value <= 5000) return 'normal'
  return 'slow'
})

const statusText = computed(() => {
  if (!isRunning.value) return '未启动'
  if (isPaused.value) return '已暂停'
  if (!isPageVisible.value) return '页面隐藏'
  if (currentInterval.value <= 2000) return '高频同步'
  if (currentInterval.value <= 5000) return '正常同步'
  return '低频同步'
})

const latencyClass = computed(() => {
  if (networkLatency.value <= 100) return 'good'
  if (networkLatency.value <= 300) return 'moderate'
  return 'poor'
})

const recentAdjustments = computed(() => {
  return adjustments.value.slice(-5).reverse()
})

// 方法
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const formatInterval = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const forceSync = () => {
  syncManager.forceSync()
}

const togglePause = () => {
  if (isPaused.value) {
    syncManager.resume()
    isPaused.value = false
  } else {
    syncManager.pause()
    isPaused.value = true
  }
}

const resetMetrics = () => {
  syncManager.resetMetrics()
  syncCount.value = 0
  adjustmentCount.value = 0
  adjustments.value = []
}

const clearAdjustments = () => {
  adjustments.value = []
}

// 事件处理
const handleSyncStart = (data) => {
  isRunning.value = true
  currentInterval.value = data.interval
}

const handleSyncStop = () => {
  isRunning.value = false
}

const handleSyncAdjust = (data) => {
  currentInterval.value = data.newInterval
  adjustmentCount.value++
  adjustments.value.push({
    time: Date.now(),
    previousInterval: data.previousInterval,
    newInterval: data.newInterval,
    reason: data.reason
  })
  // 保留最近 20 条调整记录
  if (adjustments.value.length > 20) {
    adjustments.value.shift()
  }
}

const handleStatsUpdate = (stats) => {
  deviceStats.value = stats
}

const handleLatencyUpdate = (data) => {
  networkLatency.value = data.latency
}

const handleVisibilityChange = (data) => {
  isPageVisible.value = data.isPageVisible
}

const handleSync = (data) => {
  syncCount.value = data.isForced ? syncCount.value : syncCount.value
}

const handlePause = () => {
  isPaused.value = true
}

const handleResume = () => {
  isPaused.value = false
}

// 生命周期
onMounted(() => {
  // 注册事件监听
  syncManager.on('start', handleSyncStart)
  syncManager.on('stop', handleSyncStop)
  syncManager.on('adjust', handleSyncAdjust)
  syncManager.on('statsUpdate', handleStatsUpdate)
  syncManager.on('latencyUpdate', handleLatencyUpdate)
  syncManager.on('visibilityChange', handleVisibilityChange)
  syncManager.on('sync', handleSync)
  syncManager.on('pause', handlePause)
  syncManager.on('resume', handleResume)

  // 初始化状态
  const state = syncManager.getState()
  isRunning.value = state.isRunning
  currentInterval.value = state.currentInterval
  deviceStats.value = state.deviceStats
  networkLatency.value = state.networkLatency
  isPageVisible.value = state.isPageVisible
  syncCount.value = state.syncCount
  adjustmentCount.value = state.adjustmentCount
  averageInterval.value = state.averageInterval

  // 加载调整历史
  const metrics = syncManager.getMetrics()
  adjustments.value = metrics.adjustments
})

onUnmounted(() => {
  // 移除事件监听
  syncManager.off('start', handleSyncStart)
  syncManager.off('stop', handleSyncStop)
  syncManager.off('adjust', handleSyncAdjust)
  syncManager.off('statsUpdate', handleStatsUpdate)
  syncManager.off('latencyUpdate', handleLatencyUpdate)
  syncManager.off('visibilityChange', handleVisibilityChange)
  syncManager.off('sync', handleSync)
  syncManager.off('pause', handlePause)
  syncManager.off('resume', handleResume)
})

// 暴露方法给父组件
defineExpose({
  expand: () => { isExpanded.value = true },
  collapse: () => { isExpanded.value = false }
})
</script>

<style scoped>
.sync-status {
  background: var(--card-bg);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: all 0.3s ease;
  max-width: 400px;
  margin: 0 auto;
}

.sync-status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(102, 126, 234, 0.1);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.sync-status-header:hover {
  background: rgba(102, 126, 234, 0.15);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.stopped {
  background: #999;
}

.status-indicator.paused {
  background: #ff9800;
}

.status-indicator.hidden {
  background: #666;
}

.status-indicator.fast {
  background: #4caf50;
  animation-duration: 0.5s;
}

.status-indicator.normal {
  background: #8bc34a;
  animation-duration: 1s;
}

.status-indicator.slow {
  background: #ffc107;
  animation-duration: 2s;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.95em;
}

.sync-interval {
  color: var(--primary-color);
  font-weight: bold;
  font-size: 0.9em;
  min-width: 60px;
  text-align: right;
}

.expand-icon {
  color: var(--text-secondary);
  font-size: 0.8em;
}

.sync-status-details {
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
}

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stat-item {
  flex: 1;
  min-width: 70px;
  background: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  border-radius: 8px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 0.75em;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 1.1em;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-item.online .stat-value {
  color: var(--success-color);
}

.stat-item.offline .stat-value {
  color: var(--danger-color);
}

.stat-value.good {
  color: var(--success-color);
}

.stat-value.moderate {
  color: var(--warning-color);
}

.stat-value.poor {
  color: var(--danger-color);
}

.adjustments-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9em;
}

.clear-btn {
  padding: 4px 10px;
  font-size: 0.8em;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn:hover {
  background: var(--danger-color);
  color: white;
  border-color: var(--danger-color);
}

.adjustments-list {
  max-height: 200px;
  overflow-y: auto;
}

.adjustment-item {
  display: flex;
  gap: 10px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 0.85em;
}

.adjustment-time {
  color: var(--text-secondary);
  font-family: monospace;
  min-width: 70px;
}

.adjustment-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.interval-change {
  font-weight: 600;
  color: var(--primary-color);
}

.adjustment-reason {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.2);
}

.btn-warning {
  background: var(--warning-color);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #f57c00;
}

/* 滚动条样式 */
.adjustments-list::-webkit-scrollbar {
  width: 6px;
}

.adjustments-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.adjustments-list::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 3px;
}

.adjustments-list::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

/* 响应式 */
@media (max-width: 480px) {
  .sync-status {
    max-width: 100%;
  }

  .stats-row {
    gap: 8px;
  }

  .stat-item {
    min-width: 60px;
    padding: 6px 8px;
  }

  .stat-value {
    font-size: 0.95em;
  }

  .control-buttons {
    flex-direction: column;
  }
}
</style>
