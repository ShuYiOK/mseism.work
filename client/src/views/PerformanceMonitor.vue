<template>
  <div class="performance-monitor">
    <!-- 控制栏 -->
    <div class="control-bar">
      <div class="auto-refresh">
        <label class="switch">
          <input type="checkbox" v-model="autoRefresh" @change="toggleAutoRefresh" />
          <span class="slider"></span>
        </label>
        <span class="refresh-label">自动刷新 (30s)</span>
      </div>
      <button @click="refreshData" class="btn btn-primary" :disabled="isRefreshing">
        <span class="icon">{{ isRefreshing ? '⏳' : '🔄' }}</span>
        {{ isRefreshing ? '刷新中...' : '立即刷新' }}
      </button>
    </div>

    <!-- 监控卡片网格 -->
    <div class="monitoring-grid">
      <!-- 服务器状态卡片 -->
      <div class="card monitoring-card">
        <div class="card-header status-header">
          <div class="header-left">
            <span class="card-icon">🖥️</span>
            <h3>服务器状态</h3>
          </div>
          <span class="status-badge" :class="serverStatus.status">
            {{ serverStatus.status === 'online' ? '在线' : '离线' }}
          </span>
        </div>
        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">CPU 使用率</span>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: serverStatus.cpuUsage + '%' }"
                  :class="getUsageClass(serverStatus.cpuUsage)"
                ></div>
              </div>
              <span class="percentage">{{ serverStatus.cpuUsage }}%</span>
            </div>
          </div>
          <div class="metric-row">
            <span class="metric-label">内存使用率</span>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: serverStatus.memoryUsage + '%' }"
                  :class="getUsageClass(serverStatus.memoryUsage)"
                ></div>
              </div>
              <span class="percentage">{{ serverStatus.memoryUsage }}%</span>
            </div>
          </div>
          <div class="metric-row">
            <span class="metric-label">磁盘使用率</span>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: serverStatus.diskUsage + '%' }"
                  :class="getUsageClass(serverStatus.diskUsage)"
                ></div>
              </div>
              <span class="percentage">{{ serverStatus.diskUsage }}%</span>
            </div>
          </div>
          <div class="metric-row">
            <span class="metric-label">运行时间</span>
            <span class="metric-value text">{{ serverStatus.uptime }}</span>
          </div>
        </div>
      </div>

      <!-- 数据库状态卡片 -->
      <div class="card monitoring-card">
        <div class="card-header status-header">
          <div class="header-left">
            <span class="card-icon">🗄️</span>
            <h3>数据库状态</h3>
          </div>
          <span class="status-badge" :class="databaseStatus.status">
            {{ databaseStatus.status === 'online' ? '在线' : '离线' }}
          </span>
        </div>
        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">连接数</span>
            <span class="metric-value text">{{ databaseStatus.connections }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">查询次数</span>
            <span class="metric-value text">{{ databaseStatus.queries }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">响应时间</span>
            <span class="metric-value text">{{ databaseStatus.responseTime }}ms</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">数据库类型</span>
            <span class="metric-value text">{{ databaseStatus.type }}</span>
          </div>
        </div>
      </div>

      <!-- 设备状态卡片 -->
      <div class="card monitoring-card">
        <div class="card-header status-header">
          <div class="header-left">
            <span class="card-icon">📊</span>
            <h3>设备状态</h3>
          </div>
          <span class="status-badge" :class="deviceStatus.status">
            {{ deviceStatus.status === 'normal' ? '正常' : '异常' }}
          </span>
        </div>
        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">总设备数</span>
            <span class="metric-value text">{{ deviceStatus.total }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">在线设备</span>
            <span class="metric-value text text-success">{{ deviceStatus.online }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">离线设备</span>
            <span class="metric-value text text-danger">{{ deviceStatus.offline }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">在线率</span>
            <div class="metric-value">
              <div class="progress-bar">
                <div
                  class="progress-fill success"
                  :style="{ width: deviceStatus.onlineRate + '%' }"
                ></div>
              </div>
              <span class="percentage">{{ deviceStatus.onlineRate }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 系统状态卡片 -->
      <div class="card monitoring-card">
        <div class="card-header status-header">
          <div class="header-left">
            <span class="card-icon">⚙️</span>
            <h3>系统状态</h3>
          </div>
          <span class="status-badge" :class="systemStatus.status">
            {{ systemStatus.status === 'normal' ? '正常' : '异常' }}
          </span>
        </div>
        <div class="card-body">
          <div class="metric-row">
            <span class="metric-label">启动时间</span>
            <span class="metric-value text">{{ systemStatus.startTime }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">运行时长</span>
            <span class="metric-value text">{{ systemStatus.runTime }}</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">API 响应时间</span>
            <span class="metric-value text">{{ systemStatus.apiResponseTime }}ms</span>
          </div>
          <div class="metric-row">
            <span class="metric-label">WebSocket 连接</span>
            <span class="metric-value text">{{ systemStatus.wsConnections }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近活动 -->
    <div class="card activity-section">
      <div class="section-header">
        <h3>📋 最近活动</h3>
        <span class="activity-count">{{ recentActivities.length }} 条记录</span>
      </div>
      <div class="activity-list">
        <div
          v-for="(activity, index) in recentActivities"
          :key="index"
          class="activity-item"
        >
          <span class="activity-time">{{ activity.time }}</span>
          <span class="activity-message">{{ activity.message }}</span>
          <span class="activity-badge" :class="activity.type">
            {{ getActivityLabel(activity.type) }}
          </span>
        </div>
        <div v-if="recentActivities.length === 0" class="empty-state">
          暂无活动记录
        </div>
      </div>
    </div>

    <!-- 异常设备监控 -->
    <AnomalyMonitor />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useDeviceStore } from '../stores/devices'
import socketService from '../utils/socket'
import AnomalyMonitor from '../components/AnomalyMonitor.vue'

const deviceStore = useDeviceStore()

// 自动刷新
const autoRefresh = ref(true)
let refreshInterval = null

// 刷新状态
const isRefreshing = ref(false)

// 服务器状态
const serverStatus = ref({
  status: 'online',
  cpuUsage: 25,
  memoryUsage: 45,
  diskUsage: 60,
  uptime: '2天 14小时'
})

// 数据库状态
const databaseStatus = ref({
  status: 'online',
  connections: 12,
  queries: '1,245',
  responseTime: 15,
  type: 'MySQL'
})

// 设备状态
const deviceStatus = ref({
  status: 'normal',
  total: 0,
  online: 0,
  offline: 0,
  onlineRate: 0
})

// 系统状态
const systemStatus = ref({
  status: 'normal',
  startTime: '2024-01-15 10:30:00',
  runTime: '2天 14小时',
  apiResponseTime: 8,
  wsConnections: 5
})

// 最近活动
const recentActivities = ref([])

// 获取使用率等级类名
const getUsageClass = (value) => {
  if (value >= 80) return 'danger'
  if (value >= 60) return 'warning'
  return 'success'
}

// 获取活动类型标签
const getActivityLabel = (type) => {
  const labels = {
    info: '信息',
    success: '成功',
    warning: '警告',
    error: '错误'
  }
  return labels[type] || type
}

// 加载设备数据
const loadDeviceData = async () => {
  try {
    if (deviceStore.devices.length === 0) {
      await deviceStore.loadDevices()
    }

    const devices = deviceStore.devices
    const total = devices.length
    const online = devices.filter(d => d.online).length
    const offline = total - online
    const onlineRate = total > 0 ? Math.round((online / total) * 100) : 0

    deviceStatus.value = {
      status: total > 0 && onlineRate >= 80 ? 'normal' : 'warning',
      total,
      online,
      offline,
      onlineRate
    }
  } catch (error) {
    console.error('加载设备数据失败:', error)
    if (window.toast) {
      window.toast.error('加载设备数据失败')
    }
  }
}

// 刷新数据
const refreshData = async () => {
  isRefreshing.value = true

  try {
    // 模拟 API 调用
    await new Promise(resolve => setTimeout(resolve, 800))

    // 更新服务器状态
    serverStatus.value = {
      status: 'online',
      cpuUsage: Math.floor(Math.random() * 60) + 10,
      memoryUsage: Math.floor(Math.random() * 50) + 20,
      diskUsage: Math.floor(Math.random() * 40) + 40,
      uptime: '2天 14小时'
    }

    // 更新数据库状态
    databaseStatus.value = {
      status: 'online',
      connections: Math.floor(Math.random() * 30) + 5,
      queries: (Math.floor(Math.random() * 2000) + 500).toLocaleString(),
      responseTime: Math.floor(Math.random() * 30) + 5,
      type: 'MySQL'
    }

    // 更新系统状态
    systemStatus.value = {
      status: 'normal',
      startTime: '2024-01-15 10:30:00',
      runTime: '2天 14小时',
      apiResponseTime: Math.floor(Math.random() * 20) + 2,
      wsConnections: Math.floor(Math.random() * 10) + 1
    }

    // 加载设备数据
    await loadDeviceData()

    // 添加活动记录
    recentActivities.value.unshift({
      time: new Date().toLocaleString('zh-CN'),
      message: '数据刷新成功',
      type: 'success'
    })

    // 限制记录数量
    if (recentActivities.value.length > 20) {
      recentActivities.value = recentActivities.value.slice(0, 20)
    }

    if (window.toast) {
      window.toast.success('数据刷新成功')
    }
  } catch (error) {
    recentActivities.value.unshift({
      time: new Date().toLocaleString('zh-CN'),
      message: '数据刷新失败: ' + error.message,
      type: 'error'
    })

    if (window.toast) {
      window.toast.error('数据刷新失败')
    }
  } finally {
    isRefreshing.value = false
  }
}

// 切换自动刷新
const toggleAutoRefresh = () => {
  if (autoRefresh.value) {
    refreshInterval = setInterval(refreshData, 30000)
  } else {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
}

// WebSocket 事件处理
const handleDeviceUpdate = (device) => {
  deviceStore.updateDevice(device)
  loadDeviceData()

  recentActivities.value.unshift({
    time: new Date().toLocaleString('zh-CN'),
    message: `设备 ${device.name || device.id} 状态更新`,
    type: device.online ? 'success' : 'warning'
  })
}

onMounted(async () => {
  // 加载初始数据
  await loadDeviceData()
  await refreshData()

  // 启动自动刷新
  if (autoRefresh.value) {
    refreshInterval = setInterval(refreshData, 30000)
  }

  // 监听 WebSocket 事件
  socketService.connect()
  socketService.on('device:update', handleDeviceUpdate)
})

onUnmounted(() => {
  // 清理定时器
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }

  // 清理 WebSocket 监听
  socketService.off('device:update', handleDeviceUpdate)
})
</script>

<style scoped>
.performance-monitor {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 控制栏 */
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.auto-refresh {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 26px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.refresh-label {
  color: #666;
  font-size: 0.9em;
}

/* 按钮 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn .icon {
  font-size: 1.1em;
}

/* 卡片通用样式 */
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

/* 监控网格 */
.monitoring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.monitoring-card {
  transition: all 0.3s ease;
}

.monitoring-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

/* 卡片头部 */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.status-header .header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-icon {
  font-size: 1.3em;
}

.card-header h3 {
  margin: 0;
  font-size: 1.05em;
  font-weight: 600;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
}

.status-badge.online,
.status-badge.normal {
  background: rgba(76, 175, 80, 0.2);
}

.status-badge.offline,
.status-badge.warning {
  background: rgba(255, 152, 0, 0.2);
}

.status-badge.error {
  background: rgba(244, 67, 54, 0.2);
}

/* 卡片内容 */
.card-body {
  padding: 20px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.metric-row:last-child {
  border-bottom: none;
}

.metric-label {
  color: #666;
  font-size: 0.9em;
  flex-shrink: 0;
}

.metric-value {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
}

.metric-value.text {
  color: #333;
  font-weight: 600;
}

.metric-value.text-success {
  color: #4caf50;
}

.metric-value.text-danger {
  color: #f44336;
}

.percentage {
  font-weight: 600;
  font-size: 0.9em;
  min-width: 45px;
  text-align: right;
}

/* 进度条 */
.progress-bar {
  width: 100px;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.progress-fill {
  height: 100%;
  transition: width 0.5s ease;
  border-radius: 4px;
}

.progress-fill.success {
  background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
}

.progress-fill.warning {
  background: linear-gradient(90deg, #ff9800 0%, #ffb74d 100%);
}

.progress-fill.danger {
  background: linear-gradient(90deg, #f44336 0%, #e57373 100%);
}

/* 活动部分 */
.activity-section {
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.1em;
}

.activity-count {
  color: #999;
  font-size: 0.85em;
  padding: 4px 12px;
  background: #f5f5f5;
  border-radius: 12px;
}

.activity-list {
  max-height: 350px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.2s;
}

.activity-item:hover {
  background: #f9fafb;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-time {
  flex: 1;
  font-size: 0.85em;
  color: #999;
  min-width: 150px;
}

.activity-message {
  flex: 3;
  font-size: 0.9em;
  color: #333;
}

.activity-badge {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 600;
  white-space: nowrap;
}

.activity-badge.info {
  background: rgba(33, 150, 243, 0.1);
  color: #2196f3;
}

.activity-badge.success {
  background: rgba(76, 175, 80, 0.1);
  color: #4caf50;
}

.activity-badge.warning {
  background: rgba(255, 152, 0, 0.1);
  color: #ff9800;
}

.activity-badge.error {
  background: rgba(244, 67, 54, 0.1);
  color: #f44336;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

/* 滚动条样式 */
.activity-list::-webkit-scrollbar {
  width: 6px;
}

.activity-list::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 3px;
}

.activity-list::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 3px;
}

.activity-list::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

/* 响应式 */
@media (max-width: 768px) {
  .control-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .auto-refresh {
    justify-content: center;
  }

  .monitoring-grid {
    grid-template-columns: 1fr;
  }

  .metric-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .metric-label {
    flex-basis: 100%;
  }

  .metric-value {
    justify-content: flex-start;
  }

  .progress-bar {
    width: 80px;
  }

  .activity-item {
    flex-wrap: wrap;
    gap: 8px;
  }

  .activity-time {
    flex-basis: 100%;
    order: 2;
    font-size: 0.75em;
  }

  .activity-message {
    flex-basis: 100%;
    order: 1;
  }

  .activity-badge {
    order: 3;
  }
}

@media (max-width: 480px) {
  .card-header {
    padding: 12px 16px;
  }

  .card-body {
    padding: 16px;
  }
}
</style>
