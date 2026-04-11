<template>
  <div 
    class="device-card" 
    role="article" 
    :aria-label="`设备 ${device.device} 信息`"
    draggable="true"
    @click="toggleOfflineDetails"
    @dragstart="$emit('dragstart', $event, device, index)"
    @dragend="$emit('dragend', $event)"
    @dragover.prevent
    @dragenter.prevent="$event.target.classList.add('drag-over')"
    @dragleave="$event.target.classList.remove('drag-over')"
    @drop="$emit('drop', $event, index)"
  >
    <div class="device-header">
      <span class="device-id" aria-label="设备ID">{{ device.device || device.id }}</span>
      <span class="status-badge" :class="device.online ? 'status-online' : 'status-offline'" :aria-label="device.online ? '设备在线' : '设备离线'">
        {{ device.online ? '在线' : '离线' }}
      </span>
    </div>
    
    <!-- 在线设备显示完整信息 -->
    <div v-if="device.online" class="device-info">
      <div class="info-grid">
          <div class="info-item">
            <span class="info-label">地址</span>
            <span class="info-value">{{ device.ip_address || device.addr || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">电压</span>
            <span class="info-value">{{ device.raw?.volt || device.volt || 0 }}V</span>
          </div>
          <div class="info-item">
            <span class="info-label">存储</span>
            <span class="info-value">{{ device.storage_usage > 0 ? device.storage_usage + '%' : '无卡' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">延迟1</span>
            <span class="info-value">{{ device.raw?.delay || device.delay || 0 }}ms</span>
          </div>
          <div class="info-item">
            <span class="info-label">延迟2</span>
            <span class="info-value">{{ device.raw?.delay2 || device.delay2 || 0 }}ms</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标X</span>
            <span class="info-value">{{ device.raw?.coodX || device.coodX || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标Y</span>
            <span class="info-value">{{ device.raw?.coodY || device.coodY || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标Z</span>
            <span class="info-value">{{ device.raw?.coodZ || device.coodZ || '-' }}</span>
          </div>
          <div v-if="device.raw?.upTime || device.upTime" class="info-item">
            <span class="info-label">上线时间</span>
            <span class="info-value">{{ device.raw?.upTime || device.upTime }}</span>
          </div>
        </div>
    </div>
    
    <!-- 离线设备 -->
    <div v-else>
      <!-- 离线设备默认状态 -->
      <div class="device-offline-info">
        <span class="offline-message">设备离线</span>
        <span class="expand-icon">{{ isOfflineExpanded ? '▼' : '▶' }}</span>
      </div>
      
      <!-- 离线设备展开状态 -->
      <div v-show="isOfflineExpanded" class="device-info offline-expanded">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">地址</span>
            <span class="info-value">{{ device.ip_address || device.addr || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">电压</span>
            <span class="info-value">{{ device.raw?.volt || device.volt || 0 }}V</span>
          </div>
          <div class="info-item">
            <span class="info-label">存储</span>
            <span class="info-value">{{ device.storage_usage > 0 ? device.storage_usage + '%' : '无卡' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">延迟1</span>
            <span class="info-value">{{ device.raw?.delay || device.delay || 0 }}ms</span>
          </div>
          <div class="info-item">
            <span class="info-label">延迟2</span>
            <span class="info-value">{{ device.raw?.delay2 || device.delay2 || 0 }}ms</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标X</span>
            <span class="info-value">{{ device.raw?.coodX || device.coodX || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标Y</span>
            <span class="info-value">{{ device.raw?.coodY || device.coodY || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标Z</span>
            <span class="info-value">{{ device.raw?.coodZ || device.coodZ || '-' }}</span>
          </div>
          <div v-if="device.raw?.upTime || device.upTime" class="info-item">
            <span class="info-label">上线时间</span>
            <span class="info-value">{{ device.raw?.upTime || device.upTime }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref } from 'vue'

// 设备类型定义 - 匹配API返回的数据结构
interface Device {
  id: string
  device: string // 设备ID
  addr: string // IP地址
  ip_address: string // IP地址
  volt: string // 电压
  state: string // 状态
  storage: string // 存储
  storage_usage: number // 存储使用率
  delay: string // 延迟1
  delay2: string // 延迟2
  cpu_usage: number // CPU使用率
  memory_usage: number // 内存使用率
  temperature: number // 温度
  coodX: string
  coodY: string
  coodZ: string
  online: boolean // 在线状态
  upTime: string // 上线时间
  last_heartbeat: number // 最后心跳时间
  raw?: {
    volt: string
    state: string
    coodX: string
    coodY: string
    coodZ: string
    upTime: string
    delay: string
    delay2: string
    storage: string
  }
}

const props = defineProps<{
  device: Device
  index: number
}>()

const emit = defineEmits<{
  (e: 'dragstart', event: DragEvent, device: Device, index: number): void
  (e: 'dragend', event: DragEvent): void
  (e: 'drop', event: DragEvent, index: number): void
}>()

// 离线设备展开状态
const isOfflineExpanded = ref(false)

// 切换离线设备详情展开/收起
const toggleOfflineDetails = () => {
  if (!props.device.online) {
    isOfflineExpanded.value = !isOfflineExpanded.value
  }
}
</script>

<style scoped>
.device-card {
  background: var(--card-bg);
  border-radius: 15px;
  padding: 15px;
  box-shadow: var(--shadow-lg);
  transition: all 0.3s ease;
  animation: fadeIn 0.5s ease-out;
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: 120px;
}

/* 设备卡片动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 设备卡片更新动画 */
.device-card.updating {
  animation: pulse 1s ease-in-out;
}

@keyframes pulse {
  0% {
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 8px 32px rgba(90, 111, 216, 0.6);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    transform: scale(1);
  }
}

.device-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 12px 24px rgba(0,0,0,0.15);
  background: linear-gradient(135deg, var(--card-bg) 0%, rgba(102, 126, 234, 0.05) 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 拖拽样式 */
.device-card.dragging {
  opacity: 0.5;
  transform: rotate(5deg);
  box-shadow: 0 10px 25px rgba(0,0,0,0.3);
}

/* 拖拽目标样式 */
.device-card.drag-over {
  border: 2px dashed var(--primary-color);
  background: rgba(90, 111, 216, 0.1);
}

.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border-color);
}

.device-id {
  font-size: 1.1em;
  font-weight: bold;
  color: var(--text-primary);
}

.status-badge {
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: bold;
  transition: all 0.3s ease;
}

.status-online,
.status-offline {
  transition: all 0.3s ease;
}

/* 状态变化动画 */
.status-badge {
  position: relative;
  overflow: hidden;
}

.status-badge::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.3);
  transition: left 0.3s ease;
}

.status-badge:hover::before,
.status-badge:active::before {
  left: 100%;
}

.status-online {
  background: var(--accessible-success);
  color: white;
}

.status-offline {
  background: var(--accessible-danger);
  color: white;
}

.device-info {
  margin-top: 10px;
}

/* 信息网格布局 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  font-size: 0.85em;
}

/* 离线设备信息 */
.device-offline-info {
  margin-top: 10px;
  padding: 10px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.device-offline-info:hover {
  background: rgba(244, 67, 54, 0.15);
}

.offline-message {
  color: var(--accessible-danger);
  font-size: 0.9em;
  font-weight: 500;
}

.expand-icon {
  color: var(--accessible-danger);
  font-size: 0.8em;
  transition: transform 0.3s ease;
}

/* 离线设备展开状态 */
.offline-expanded {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  padding: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.info-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.info-label {
  color: var(--text-secondary);
  font-size: 0.75em;
  margin-bottom: 2px;
}

.info-value {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.9em;
}

/* 响应式布局 */
@media (min-width: 1200px) {
  .info-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .device-card {
    padding: 12px;
  }
  
  .device-id {
    font-size: 1em;
  }
  
  .info-grid {
    grid-template-columns: 1fr 1fr;
    font-size: 0.8em;
  }
}

@media (max-width: 480px) {
  .device-card {
    padding: 10px;
  }
  
  .device-id {
    font-size: 0.9em;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
    font-size: 0.75em;
  }
  
  .status-badge {
    padding: 3px 10px;
    font-size: 0.75em;
  }
}
</style>