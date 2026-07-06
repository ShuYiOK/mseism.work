<template>
  <div class="card anomaly-monitor-card">
    <div class="card-header">
      <div class="header-left">
        <span class="card-icon">⚠️</span>
        <h3>异常设备监控</h3>
      </div>
      <div class="header-right">
        <span class="anomaly-count" :class="{ 'has-anomalies': anomalousDevices.length > 0 }">
          {{ anomalousDevices.length }} 台异常
        </span>
        <button @click="refreshAnomalies" class="btn-icon" title="刷新" :disabled="isLoading">
          <span :class="{ spinning: isLoading }">🔄</span>
        </button>
      </div>
    </div>
    
    <div class="card-body">
      <div v-if="isLoading && anomalousDevices.length === 0" class="loading-state">
        <span>⏳ 加载中...</span>
      </div>
      
      <div v-else-if="anomalousDevices.length === 0" class="empty-state">
        <span class="empty-icon">✅</span>
        <p>暂无异常设备</p>
        <p class="empty-hint">24小时内上下线超过3次的设备将显示在这里</p>
      </div>
      
      <div v-else class="anomaly-list">
        <div
          v-for="device in anomalousDevices"
          :key="device.deviceId"
          class="anomaly-item"
        >
          <div class="anomaly-summary" @click="toggleExpand(device.deviceId)">
            <div class="device-info">
              <span :class="device.online ? 'status-online' : 'status-offline'">
                {{ device.online ? '🟢' : '🔴' }}
              </span>
              <span class="device-name">{{ device.deviceName || device.deviceId }}</span>
            </div>
            <div class="anomaly-meta">
              <span class="status-change-badge">
                {{ device.statusChangeCount }} 次状态变化
              </span>
              <span class="expand-icon">{{ expandedDevices[device.deviceId] ? '🔼' : '🔽' }}</span>
            </div>
          </div>
          
          <div v-if="expandedDevices[device.deviceId]" class="anomaly-details">
            <div class="detail-section">
              <h4>📊 基本信息</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">设备ID</span>
                  <span class="value">{{ device.deviceId }}</span>
                </div>
                <div class="info-item">
                  <span class="label">IP地址</span>
                  <span class="value">{{ device.ipAddress || '未知' }}</span>
                </div>
                <div class="info-item">
                  <span class="label">当前状态</span>
                  <span class="value" :class="device.online ? 'text-success' : 'text-danger'">
                    {{ device.online ? '在线' : '离线' }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="label">首次异常</span>
                  <span class="value">{{ formatTimestamp(device.firstOccurrence) }}</span>
                </div>
              </div>
            </div>
            
            <div v-if="deviceDetails[device.deviceId]" class="detail-section">
              <h4>📋 状态变化记录 (最近24小时)</h4>
              <div class="timeline">
                <div
                  v-for="(log, index) in deviceDetails[device.deviceId].statusHistory"
                  :key="index"
                  class="timeline-item"
                  :class="log.status"
                >
                  <div class="timeline-marker">
                    <span :class="log.status === 'online' ? 'online-dot' : 'offline-dot'"></span>
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <span class="status-label" :class="log.status">
                        {{ log.status === 'online' ? '⬆️ 上线' : '⬇️ 下线' }}
                      </span>
                      <span class="timestamp">{{ log.formattedTime }}</span>
                    </div>
                    <div v-if="log.ipAddress" class="timeline-meta">
                      IP: {{ log.ipAddress }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="deviceDetails[device.deviceId]?.coordinateHistory?.length > 0" class="detail-section">
              <h4>📍 坐标变化记录</h4>
              <div class="coordinate-list">
                <div
                  v-for="(coord, index) in deviceDetails[device.deviceId].coordinateHistory"
                  :key="index"
                  class="coordinate-item"
                  :class="{ 'significant-change': coord.changeType === 'coordinate_change' }"
                >
                  <span class="coord-time">{{ coord.formattedTime }}</span>
                  <span class="coord-values">
                    X: {{ coord.coordinates.x.toFixed(2) }},
                    Y: {{ coord.coordinates.y.toFixed(2) }},
                    Z: {{ coord.coordinates.z.toFixed(2) }}
                  </span>
                  <span v-if="coord.changeType === 'coordinate_change'" class="change-badge">
                    显著变化
                  </span>
                </div>
              </div>
            </div>
            
            <div v-else class="no-data">
              暂无坐标变化记录
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { anomalyApi } from '../api'

const anomalousDevices = ref([])
const expandedDevices = reactive({})
const deviceDetails = reactive({})
const isLoading = ref(false)
let refreshTimer = null

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '未知'
  return new Date(timestamp * 1000).toLocaleString('zh-CN')
}

// 加载异常设备列表
const loadAnomalousDevices = async () => {
  isLoading.value = true
  try {
    const res = await anomalyApi.getAnomalousDevices()
    if (res.data.success) {
      anomalousDevices.value = res.data.data
    }
  } catch (error) {
    console.error('加载异常设备失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 切换展开状态
const toggleExpand = async (deviceId) => {
  expandedDevices[deviceId] = !expandedDevices[deviceId]
  
  if (expandedDevices[deviceId] && !deviceDetails[deviceId]) {
    await loadDeviceDetails(deviceId)
  }
}

// 加载设备详情
const loadDeviceDetails = async (deviceId) => {
  try {
    const res = await anomalyApi.getDeviceAnomalyDetails(deviceId)
    if (res.data.success) {
      deviceDetails[deviceId] = res.data.data
    }
  } catch (error) {
    console.error('加载设备详情失败:', error)
  }
}

// 刷新异常设备列表
const refreshAnomalies = async () => {
  await loadAnomalousDevices()
  
  const ids = Object.keys(expandedDevices).filter(id => expandedDevices[id])
  await Promise.all(ids.map(id => loadDeviceDetails(id)))
}

const cleanupStaleData = () => {
  const currentIds = new Set(anomalousDevices.value.map(d => d.deviceId))
  for (const id of Object.keys(expandedDevices)) {
    if (!currentIds.has(id)) {
      delete expandedDevices[id]
      delete deviceDetails[id]
    }
  }
}

onMounted(() => {
  loadAnomalousDevices()
  refreshTimer = setInterval(() => {
    loadAnomalousDevices()
    cleanupStaleData()
  }, 60000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.anomaly-monitor-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-left h3 {
  margin: 0;
  font-size: 1.1em;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.anomaly-count {
  padding: 4px 12px;
  background: #f5f5f5;
  border-radius: 16px;
  font-size: 0.85em;
  color: #666;
}

.anomaly-count.has-anomalies {
  background: #fff3e0;
  color: #e65100;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-icon:hover:not(:disabled) {
  background: #f5f5f5;
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 0.85em;
  color: #bbb;
  margin-top: 8px;
}

.anomaly-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.anomaly-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.anomaly-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
  cursor: pointer;
  transition: background 0.2s;
}

.anomaly-summary:hover {
  background: #f0f0f0;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-online {
  color: #4caf50;
}

.status-offline {
  color: #f44336;
}

.device-name {
  font-weight: 500;
  color: #333;
}

.anomaly-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-change-badge {
  padding: 4px 10px;
  background: #fff3e0;
  color: #e65100;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: 500;
}

.expand-icon {
  font-size: 12px;
}

.anomaly-details {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  margin: 0 0 12px 0;
  font-size: 0.95em;
  color: #555;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  font-size: 0.8em;
  color: #999;
}

.info-item .value {
  font-size: 0.9em;
  color: #333;
  word-break: break-all;
}

.text-success {
  color: #4caf50;
}

.text-danger {
  color: #f44336;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f0f0;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-marker {
  flex-shrink: 0;
  padding-top: 4px;
}

.online-dot,
.offline-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.online-dot {
  background: #4caf50;
}

.offline-dot {
  background: #f44336;
}

.timeline-content {
  flex: 1;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.status-label {
  font-weight: 500;
  font-size: 0.9em;
}

.status-label.online {
  color: #4caf50;
}

.status-label.offline {
  color: #f44336;
}

.timestamp {
  font-size: 0.8em;
  color: #999;
}

.timeline-meta {
  font-size: 0.85em;
  color: #666;
}

.coordinate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.coordinate-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 0.85em;
}

.coordinate-item.significant-change {
  background: #fff3e0;
  border: 1px solid #ffcc80;
}

.coord-time {
  color: #666;
  flex-shrink: 0;
}

.coord-values {
  flex: 1;
  font-family: monospace;
  color: #333;
}

.change-badge {
  padding: 2px 8px;
  background: #ff9800;
  color: white;
  border-radius: 10px;
  font-size: 0.75em;
  flex-shrink: 0;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 0.9em;
}
</style>
