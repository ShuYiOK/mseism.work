<template>
  <div class="device-page">
    <!-- 标题栏和控制按钮 -->
    <div class="title-container">
      <h1 aria-label="设备列表页面">设备列表</h1>
      <div class="button-group" aria-label="控制按钮">
        <router-link to="/admin/auth" class="manage-btn" aria-label="管理后台" tabindex="0">⚙</router-link>
        <button 
          class="view-toggle-btn" 
          @click="viewMode = viewMode === 'card' ? 'table' : 'card'" 
          :aria-label="viewMode === 'card' ? '切换到表格视图' : '切换到卡片视图'"
        >
          {{ viewMode === 'card' ? '☰' : '☷' }}
        </button>
        <button 
          class="refresh-btn" 
          @click="fetchDevices"
          aria-label="刷新设备列表"
        >↻</button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row" aria-label="设备状态统计">
      <StatCard
        :value="stats.total"
        label="总数"
        :is-active="selectedGroup === 'all'"
        aria-label="查看所有设备"
        @click="selectGroup('all')"
      />
      <StatCard
        :value="stats.online"
        label="在线"
        color="var(--success-color)"
        :is-active="selectedGroup === 'online'"
        aria-label="查看在线设备"
        @click="selectGroup('online')"
      />
      <StatCard
        :value="stats.offline"
        label="离线"
        color="var(--danger-color)"
        :is-active="selectedGroup === 'offline'"
        aria-label="查看离线设备"
        @click="selectGroup('offline')"
      />
    </div>



    <!-- 分组标签页 -->
    <div v-if="groups.length > 0" class="groups-container" aria-label="设备分组">
      <div class="groups-header">
        <h3>设备分组</h3>
        <button 
          class="toggle-groups-btn" 
          @click="toggleGroups"
          aria-label="{{ groupsExpanded ? '收起分组' : '展开分组' }}"
        >
          {{ groupsExpanded ? '▼' : '▶' }}
        </button>
      </div>
      <div v-show="groupsExpanded" class="groups-tabs">
        <div
          v-for="group in groups"
          :key="group.id"
          class="group-tab"
          :class="{ active: selectedGroup === group.id }"
          :style="{ borderLeftColor: group.color }"
          @click="selectGroup(group.id)"
          @keydown.enter="selectGroup(group.id)"
          @keydown.space.prevent="selectGroup(group.id)"
          role="button"
          tabindex="0"
          :aria-pressed="selectedGroup === group.id"
          :aria-label="`查看${group.name}分组设备`"
        >
          <span class="group-tab-name">{{ group.name }}</span>
          <span class="group-tab-count">{{ getGroupDeviceCount(group.id) }}</span>
        </div>
      </div>
    </div>

    

    <!-- 骨架屏加载 -->
    <Skeleton 
      v-if="loading" 
      :type="viewMode === 'card' ? 'card' : 'table'" 
      :count="6"
      :columns="viewMode === 'card' ? undefined : 9"
    />

    <!-- 错误提示 -->
    <div v-else-if="error" class="error">{{ error }}</div>

    <!-- 设备列表 - 使用虚拟滚动 -->
    <template v-else>
      <!-- 卡片视图 - 使用虚拟滚动 -->
      <div v-if="viewMode === 'card'" class="device-grid-container">
        <VirtualGrid
          ref="virtualGridRef"
          :items="filteredDevices"
          :item-height="200"
          :item-width="300"
          :gap="20"
          container-height="600px"
          :buffer-size="3"
          item-key="id"
        >
          <template #item="{ item, index }">
            <div class="device-card-wrapper">
              <DeviceCard
                :device="item"
                :index="index"
                @dragstart="handleDragStart($event, item, index)"
                @dragend="handleDragEnd($event)"
                @drop="handleDrop($event, index)"
              />
            </div>
          </template>
        </VirtualGrid>
      </div>

      <!-- 表格视图 -->
      <div v-else class="device-table-container">
        <div class="device-table-wrapper">
          <!-- 表头 -->
          <div class="device-table-header">
            <div class="table-header-cell" role="columnheader" aria-label="设备ID">设备ID</div>
            <div class="table-header-cell table-cell-ip" role="columnheader" aria-label="IP地址">IP地址</div>
            <div class="table-header-cell" role="columnheader" aria-label="设备状态">设备状态</div>
            <div class="table-header-cell table-cell-voltage" role="columnheader" aria-label="电压值">电压</div>
            <div class="table-header-cell table-cell-storage" role="columnheader" aria-label="存储使用率">存储</div>
            <div class="table-header-cell table-cell-delay1" role="columnheader" aria-label="延迟时间">延迟1</div>
            <div class="table-header-cell table-cell-delay2" role="columnheader" aria-label="延迟时间2">延迟2</div>
            <div class="table-header-cell table-cell-uptime" role="columnheader" aria-label="上线时间">上线时间</div>
          </div>
          <!-- 表格内容 -->
          <div class="device-table-content">
            <VirtualList
              ref="virtualListRef"
              :items="filteredDevices"
              :item-height="52"
              container-height="448px"
              :buffer-size="10"
              item-key="id"
            >
              <template #item="{ item, index }">
              <div class="device-table-row" 
                role="row" 
                :aria-label="`设备 ${item.device} 行`"
                draggable="true"
                @dragstart="handleDragStart($event, item, index)"
                @dragend="handleDragEnd"
                @dragover.prevent
                @dragenter.prevent="$event.target.classList.add('drag-over')"
                @dragleave="$event.target.classList.remove('drag-over')"
                @drop="handleDrop($event, index)"
              >
                <div class="table-cell" role="cell" aria-label="设备ID">{{ item.device || item.id }}</div>
                <div class="table-cell table-cell-ip" role="cell" aria-label="IP地址">{{ item.ip_address || item.addr || '-' }}</div>
                <div class="table-cell" role="cell" aria-label="设备状态">
                  <span :class="item.online ? 'status-online-small' : 'status-offline-small'" :aria-label="item.online ? '设备在线' : '设备离线'">
                    {{ item.online ? '在线' : '离线' }}
                  </span>
                </div>
                <div class="table-cell table-cell-voltage" role="cell" aria-label="电压值">{{ item.raw?.volt || item.volt || 0 }}V</div>
                <div class="table-cell table-cell-storage" role="cell" aria-label="存储使用率">{{ item.storage_usage > 0 ? item.storage_usage + '%' : '无卡' }}</div>
                <div class="table-cell table-cell-delay1" role="cell" aria-label="延迟时间">{{ item.raw?.delay || item.delay || 0 }}ms</div>
                <div class="table-cell table-cell-delay2" role="cell" aria-label="延迟时间2">{{ item.raw?.delay2 || item.delay2 || 0 }}ms</div>
                <div class="table-cell table-cell-uptime" role="cell" aria-label="上线时间">{{ item.raw?.upTime || item.upTime || '-' }}</div>
              </div>
            </template>
            </VirtualList>
          </div>
        </div>
      </div>
    </template>

    <!-- 版权信息 -->
    <div class="copyright">
      © 2026 lsby1984 版权所有
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { deviceApi } from '../api'
import socketService from '../utils/socket'
import { useDeviceStore } from '../stores/devices'
import getDeviceWorker from '../utils/deviceWorkerManager'
import VirtualList from '../components/VirtualList.vue'
import VirtualGrid from '../components/VirtualGrid.vue'
import Skeleton from '../components/Skeleton.vue'
import DeviceCard from '../components/DeviceCard.vue'
import StatCard from '../components/StatCard.vue'

// 设备类型定义 - 匹配API返回的数据结构
export interface Device {
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
  }
}

// 分组类型定义
export interface Group {
  id: string
  name: string
  color: string
}

// 统计信息类型定义
export interface Stats {
  total: number
  online: number
  offline: number
}

/**
 * 设备列表页面组件
 * 功能：显示设备列表，支持卡片/表格视图切换，设备过滤、排序、分组
 * 通信：使用WebSocket进行实时数据更新，Web Worker进行数据处理
 */

// Store 实例
const deviceStore = useDeviceStore()

// 虚拟滚动引用
const virtualListRef = ref(null)
const virtualGridRef = ref(null)

// Web Worker 实例 - 用于处理数据密集型操作
const deviceWorker = getDeviceWorker()

// 初始化 Web Worker
deviceWorker.init()

// 状态管理
const loading = ref<boolean>(true) // 加载状态
const error = ref<string>('') // 错误信息
const stats = ref<Stats>({ total: 0, online: 0, offline: 0 }) // 设备统计信息
const viewMode = ref<'card' | 'table'>('card') // 视图模式：card 或 table
const selectedGroup = ref<string>('all') // 当前选中的分组
const groupsExpanded = ref<boolean>(true) // 分组标签是否展开
const draggedDevice = ref<Device | null>(null) // 正在拖拽的设备
const draggedIndex = ref<number>(-1) // 正在拖拽的设备索引

// 从 store 获取数据
const devices = computed(() => deviceStore.devices as Device[])
const groups = computed(() => deviceStore.groups as Group[])
const deviceGroupsMap = computed(() => deviceStore.deviceGroupsMap)

// 过滤后的设备列表
const filteredDevices = ref<Device[]>([])

/**
 * 过滤设备列表
 * 优先使用主线程处理，确保分组过滤正确
 */
const filterDevices = async () => {
  try {
    let result = devices.value
    
    // 按分组过滤
    if (selectedGroup.value !== 'all' && selectedGroup.value !== 'online' && selectedGroup.value !== 'offline') {
      const groupId = selectedGroup.value
      result = result.filter(d => deviceStore.isDeviceInGroup(d.id, groupId))
    } else if (selectedGroup.value === 'online') {
      result = result.filter(d => d.online)
    } else if (selectedGroup.value === 'offline') {
      result = result.filter(d => !d.online)
    }
    
    await sortDevices(result)
  } catch (error) {
    console.error('过滤设备失败:', error)
    // 降级到基本过滤
    let result = devices.value
    
    // 按分组过滤
    if (selectedGroup.value !== 'all' && selectedGroup.value !== 'online' && selectedGroup.value !== 'offline') {
      const groupId = selectedGroup.value
      result = result.filter(d => deviceStore.isDeviceInGroup(d.id, groupId))
    } else if (selectedGroup.value === 'online') {
      result = result.filter(d => d.online)
    } else if (selectedGroup.value === 'offline') {
      result = result.filter(d => !d.online)
    }
    
    await sortDevices(result)
  }
}

/**
 * 排序设备列表
 * 优先使用 Web Worker 处理，失败时降级到主线程
 * 排序规则：1. 在线状态优先 2. 设备ID顺序排列
 */
const sortDevices = async (devicesToSort = null) => {
  try {
    const devicesForSort = devicesToSort || filteredDevices.value
    // 直接在主线程排序，确保按在线状态优先，设备ID顺序排列
    const result = [...devicesForSort].sort((a, b) => {
      // 首先按在线状态排序，在线设备在前
      if (a.online !== b.online) {
        return a.online ? -1 : 1
      }
      // 在线状态相同，按设备ID排序
      const deviceA = a.device || a.id || ''
      const deviceB = b.device || b.id || ''
      return deviceA.localeCompare(deviceB)
    })
    filteredDevices.value = result
  } catch (error) {
    console.error('排序设备失败:', error)
    // 降级到主线程计算
    const devicesForSort = devicesToSort || filteredDevices.value
    const result = [...devicesForSort].sort((a, b) => {
      // 首先按在线状态排序，在线设备在前
      if (a.online !== b.online) {
        return a.online ? -1 : 1
      }
      // 在线状态相同，按设备ID排序
      const deviceA = a.device || a.id || ''
      const deviceB = b.device || b.id || ''
      return deviceA.localeCompare(deviceB)
    })
    filteredDevices.value = result
  }
}

/**
 * 更新设备统计信息
 * 优先使用 Web Worker 处理，失败时降级到主线程
 */
const updateStats = async () => {
  try {
    const result = await deviceWorker.calculateStats(devices.value)
    stats.value = result
  } catch (error) {
    console.error('计算统计信息失败:', error)
    // 降级到主线程计算
    const total = devices.value.length
    const online = devices.value.filter(d => d.online).length
    const offline = total - online
    stats.value = { total, online, offline }
  }
}



// 监听设备列表变化，更新统计和过滤
watch(devices, (newDevices) => {
  updateStats()
  filterDevices()
}, { immediate: true, deep: true })

// 监听设备分组映射变化，重新过滤
watch(deviceGroupsMap, (newMap) => {
  filterDevices()
}, { deep: true })

// 监听分组变化，重新过滤
watch(selectedGroup, (newGroup) => {
  filterDevices()
  // 重置虚拟滚动位置
  if (virtualListRef.value) {
    virtualListRef.value.scrollTo(0)
  }
  if (virtualGridRef.value) {
    virtualGridRef.value.scrollTo(0)
  }
})

/**
 * 获取设备数据
 */
const fetchDevices = async () => {
  try {
    loading.value = true
    error.value = ''
    
    await deviceStore.loadDevices()
    await updateStats()
    await filterDevices()
  } catch (err) {
    error.value = '获取设备数据失败：' + err.message
    if (window.toast) {
      window.toast.error('获取设备数据失败', {
        title: '加载失败'
      })
    }
  } finally {
    loading.value = false
  }
}

/**
 * 获取分组数据
 */
const fetchGroups = async () => {
  try {
    await deviceStore.loadGroups()
  } catch (err) {
    console.error('获取分组失败:', err)
  }
}

/**
 * 选择分组
 */
const selectGroup = (group) => {
  selectedGroup.value = group
}

/**
 * 切换分组展开/收起状态
 */
const toggleGroups = () => {
  groupsExpanded.value = !groupsExpanded.value
}

/**
 * 处理拖拽开始
 */
const handleDragStart = (event, device, index) => {
  draggedDevice.value = device
  draggedIndex.value = index
  event.target.classList.add('dragging')
}

/**
 * 处理拖拽结束
 */
const handleDragEnd = (event) => {
  event.target.classList.remove('dragging')
  draggedDevice.value = null
  draggedIndex.value = -1
}

/**
 * 处理拖拽放置
 */
const handleDrop = (event, dropIndex) => {
  event.preventDefault()
  
  if (draggedDevice.value && draggedIndex.value !== -1 && draggedIndex.value !== dropIndex) {
    const newDevices = [...filteredDevices.value]
    newDevices.splice(draggedIndex.value, 1)
    newDevices.splice(dropIndex, 0, draggedDevice.value)
    filteredDevices.value = newDevices
  }
  
  event.target.classList.remove('dragging')
  draggedDevice.value = null
  draggedIndex.value = -1
}



/**
 * 获取分组设备数量
 */
const getGroupDeviceCount = (groupId) => {
  return deviceStore.groupDeviceCount(groupId)
}

// Socket 事件处理

/**
 * 处理设备添加事件
 */
const handleDevicesAdded = (devicesData) => {
  devicesData.forEach(device => deviceStore.addDevice(device))
  updateStats()
}

/**
 * 处理设备更新事件
 */
const handleDevicesUpdated = (devicesData) => {
  // 添加更新动画效果
  devicesData.forEach(device => {
    // 检查设备状态是否发生变化
    const existingDevice = deviceStore.devices.find(d => d.id === device.id)
    if (existingDevice && existingDevice.online !== device.online) {
      // 设备状态发生变化，显示动态提示
      const statusText = device.online ? '上线' : '离线'
      const statusType = device.online ? 'success' : 'error'
      
      // 显示Toast提示
      if (window.toast) {
        window.toast[statusType](`设备 ${device.device} (${device.id}) 已${statusText}`, {
          title: '设备状态变化'
        })
      }
    }
  })
  deviceStore.updateDevices(devicesData)
  updateStats()
}

/**
 * 处理设备删除事件
 */
const handleDeviceDelete = (data) => {
  deviceStore.removeDevice(data.id)
  updateStats()
}

/**
 * 处理同步心跳事件
 */
const handleSyncHeartbeat = (data) => {
  // 同步心跳事件，无需处理
}

/**
 * 处理同步错误事件
 */
const handleSyncError = (error) => {
  // 同步错误事件，已在API拦截器中处理
}

/**
 * 处理分组更新事件
 */
const handleGroupUpdate = (group) => {
  deviceStore.updateGroup(group)
}

const handleGroupDelete = (data) => {
  deviceStore.removeGroup(data.id)
}

const handleGroupCreate = (group) => {
  deviceStore.updateGroup(group)
}

const handleDeviceAdded = (data) => {
  deviceStore.addDeviceToGroup(data.deviceId, data.groupId)
  if (data.group) {
    deviceStore.updateGroup(data.group)
  }
}

const handleDeviceRemoved = (data) => {
  deviceStore.removeDeviceFromGroup(data.deviceId, data.groupId)
  if (data.group) {
    deviceStore.updateGroup(data.group)
  }
}

onMounted(() => {
  socketService.connect()

  fetchDevices()
  fetchGroups()

  socketService.on('devices:added', handleDevicesAdded)
  socketService.on('devices:updated', handleDevicesUpdated)
  socketService.on('device:delete', handleDeviceDelete)
  socketService.on('sync:heartbeat', handleSyncHeartbeat)
  socketService.on('sync:error', handleSyncError)
  socketService.on('group:create', handleGroupCreate)
  socketService.on('group:update', handleGroupUpdate)
  socketService.on('group:delete', handleGroupDelete)
  socketService.on('group:device_added', handleDeviceAdded)
  socketService.on('group:device_removed', handleDeviceRemoved)
})

onUnmounted(() => {
  socketService.off('devices:added', handleDevicesAdded)
  socketService.off('devices:updated', handleDevicesUpdated)
  socketService.off('device:delete', handleDeviceDelete)
  socketService.off('sync:heartbeat', handleSyncHeartbeat)
  socketService.off('sync:error', handleSyncError)
  socketService.off('group:create', handleGroupCreate)
  socketService.off('group:update', handleGroupUpdate)
  socketService.off('group:delete', handleGroupDelete)
  socketService.off('group:device_added', handleDeviceAdded)
  socketService.off('group:device_removed', handleDeviceRemoved)
  
  deviceWorker.destroy()
})


</script>

<style scoped>
.device-page {
  padding: 20px;
  min-height: 100vh;
}

.title-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  padding: 0 20px;
}

h1 {
  color: white;
  text-align: center;
  font-size: 1.25em;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.manage-btn {
  padding: 12px;
  background: rgba(255, 255,255,0.95);
  color: var(--primary-color);
  text-decoration: none;
  border-radius: 30px;
  font-size: 1.2em;
  font-weight: bold;
  transition: all 0.3s ease;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  border: 3px solid transparent;
}

.manage-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stats-row {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}





.groups-container {
  margin-bottom: 30px;
  overflow-x: auto;
  padding-bottom: 10px;
}

.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 0 10px;
}

.groups-header h3 {
  color: white;
  font-size: 1em;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.toggle-groups-btn {
  background: rgba(255, 255, 255, 0.95);
  color: var(--primary-color);
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 1em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.toggle-groups-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.groups-tabs {
  display: flex;
  gap: 15px;
  min-width: max-content;
  padding: 0 10px;
  transition: all 0.3s ease;
}

.group-tab {
  background: rgba(255,255,255,0.95);
  padding: 12px 25px;
  border-radius: 20px;
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;
  border-left: 5px solid var(--primary-color);
  min-width: 120px;
  min-height: 44px;
  justify-content: space-between;
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

.group-tab:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(102, 126, 234, 0.1) 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.group-tab.active {
  background: #667eea;
}

.group-tab.active .group-tab-name,
.group-tab.active .group-tab-count {
  color: white;
}

.group-tab-name {
  color: #667eea;
  font-weight: bold;
  font-size: 1em;
}

.group-tab-count {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
}

.controls-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 30px;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.filter-sort-container {
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
  padding: 0 10px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  color: white;
  font-size: 0.9em;
  font-weight: 500;
  white-space: nowrap;
}

.filter-select {
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: 20px;
  padding: 8px 15px;
  font-size: 0.9em;
  color: var(--text-primary);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: all 0.3s ease;
}

.filter-select:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

.search-input {
  background: rgba(255, 255, 255, 0.95);
  border: none;
  border-radius: 20px;
  padding: 8px 15px;
  font-size: 0.9em;
  color: var(--text-primary);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
  min-width: 200px;
}

.search-input:focus {
  outline: none;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}

.view-toggle-btn, .refresh-btn, .performance-btn, .config-btn {
  padding: 12px 20px;
  background: rgba(255,255,255,0.95);
  color: var(--primary-color);
  border: 3px solid transparent;
  border-radius: 30px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-block;
  min-width: 60px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

.view-toggle-btn:hover, .refresh-btn:hover, .performance-btn:hover, .config-btn:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.view-toggle-btn {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

.refresh-btn {
  background: white;
}

.performance-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

/* 虚拟滚动容器 */
.device-grid-container {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 20px;
  box-sizing: border-box;
}

/* 设备卡片容器 */
.device-cards-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

/* 设备卡片包装器 */
.device-card-wrapper {
  width: 100%;
}

/* 拖拽样式 */
.device-table-row.dragging {
  opacity: 0.5;
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

/* 拖拽目标样式 */
.device-table-row.drag-over {
  border: 2px dashed var(--primary-color);
  background: rgba(90, 111, 216, 0.1);
}

.status-online-small {
  color: var(--accessible-success);
  font-weight: bold;
}

.status-offline-small {
  color: var(--accessible-danger);
  font-weight: bold;
}

/* 表格视图 */
.device-table-container {
  background: var(--card-bg);
  border-radius: 15px;
  padding: 20px;
  box-shadow: var(--shadow-lg);
  max-width: 1200px;
  margin: 0 auto;
  overflow-x: auto;
}

.device-table-wrapper {
  min-width: 800px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* 表头 */
.device-table-header {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 15px;
  padding: 15px;
  background: rgba(90, 111, 216, 0.1);
  border-bottom: 2px solid var(--primary-color);
  font-weight: bold;
  color: var(--text-primary);
  position: sticky;
  top: 0;
  z-index: 10;
  width: 100%;
  box-sizing: border-box;
}

.table-header-cell {
  padding: 8px 0;
  text-align: left;
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 表格内容 */
.device-table-content {
  flex: 1;
  overflow-y: auto;
}

.device-table-row {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 15px;
  padding: 15px;
  border-bottom: 1px solid var(--border-color);
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}

.device-table-row:last-child {
  border-bottom: none;
}

.table-cell {
  color: var(--text-primary);
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-online-small {
  color: var(--accessible-success);
  font-weight: bold;
}

.status-offline-small {
  color: var(--accessible-danger);
  font-weight: bold;
}

.loading, .error {
  text-align: center;
  color: white;
  font-size: 1.5em;
  padding: 50px;
}

.error {
  background: rgba(244, 67, 54, 0.9);
  border-radius: 15px;
}

.copyright {
  text-align: center;
  color: white;
  margin-top: 30px;
  font-size: 0.9em;
  opacity: 0.8;
}

/* 响应式布局 - 大屏幕 */
@media (min-width: 1200px) {
  .device-grid-container {
    max-width: 1600px;
  }

  .device-cards-wrapper {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 25px;
  }

  .device-info {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 响应式布局 - 中等屏幕 */
@media (max-width: 1199px) and (min-width: 769px) {
  .device-grid-container {
    max-width: 1200px;
  }

  .device-cards-wrapper {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
  }

  .device-info {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 响应式布局 - 小屏幕 */
@media (max-width: 768px) {
  .device-page {
    padding: 10px;
  }

  h1 {
    font-size: 1.1em;
  }

  .title-container {
    flex-direction: column;
    gap: 15px;
  }

  .manage-btn {
    padding: 10px 20px;
    font-size: 0.9em;
  }

  .stats-row {
    gap: 15px;
  }

  .stat-card {
    padding: 12px 25px;
    min-width: 90px;
  }

  .stat-card h3 {
    font-size: 1.3em;
  }

  .groups-tabs {
    gap: 12px;
  }

  .group-tab {
    padding: 12px 20px;
    min-width: 110px;
    font-size: 0.95em;
  }

  .button-group {
    flex-wrap: wrap;
    gap: 12px;
  }

  .view-toggle-btn, .refresh-btn, .manage-btn {
    min-width: 44px;
    padding: 12px;
  }

  .filter-sort-container {
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .filter-group {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }

  .search-input {
    min-width: 100%;
  }

  .device-cards-wrapper {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 15px;
  }

  .device-info {
    grid-template-columns: 1fr;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .device-table-header {
    gap: 10px;
    padding: 12px;
  }

  .device-table-row {
    font-size: 0.85em;
    gap: 10px;
    padding: 12px;
    width: 100%;
    box-sizing: border-box;
  }

  /* 小屏幕设备上隐藏部分列 */
  .table-cell-ip,
  .table-cell-storage,
  .table-cell-delay2,
  .table-header-cell:nth-child(2),
  .table-header-cell:nth-child(5),
  .table-header-cell:nth-child(7) {
    display: none;
  }
}

/* 响应式布局 - 超小屏幕 */
@media (max-width: 480px) {
  .device-page {
    padding: 8px;
  }

  h1 {
    font-size: 1em;
  }

  .title-container {
    flex-direction: column;
    gap: 10px;
  }

  .manage-btn {
    padding: 8px 16px;
    font-size: 0.85em;
  }

  .stats-row {
    gap: 10px;
  }

  .stat-card {
    padding: 8px 12px;
    min-width: 70px;
    border-radius: 20px;
  }

  .stat-card h3 {
    font-size: 1.1em;
  }

  .stat-card p {
    font-size: 0.8em;
  }

  .button-group {
    gap: 10px;
    flex-wrap: wrap;
  }

  .view-toggle-btn, .refresh-btn, .manage-btn {
    padding: 8px;
    font-size: 0.85em;
    border-radius: 20px;
    min-width: 44px;
  }

  .device-card {
    padding: 15px;
  }

  .device-id {
    font-size: 1.1em;
  }

  .device-info {
    font-size: 0.85em;
  }

  .device-cards-wrapper {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .device-table-container {
    padding: 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .device-table-header {
    padding: 10px;
  }

  .device-table-row {
    width: 100%;
    box-sizing: border-box;
  }

  /* 超小屏幕设备上进一步隐藏列 */
  .table-cell-uptime,
  .table-cell-voltage,
  .table-cell-delay1,
  .table-header-cell:nth-child(4),
  .table-header-cell:nth-child(6),
  .table-header-cell:nth-child(8) {
    display: none;
  }

  /* 移动端触摸优化 */
  .stat-card, .group-tab, .view-btn, .refresh-btn, .manage-btn, .device-card {
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* 触摸反馈效果 */
  .stat-card:active,
  .group-tab:active,
  .view-toggle-btn:active,
  .refresh-btn:active,
  .manage-btn:active,
  .device-card:active {
    transform: scale(0.95);
    transition: transform 0.1s ease;
    opacity: 0.8;
  }

  /* 增强触摸目标大小 */
  @media (max-width: 768px) {
    .stat-card,
    .group-tab,
    .view-toggle-btn,
    .refresh-btn,
    .manage-btn {
      min-height: 44px;
      min-width: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  /* 移动端滚动条优化 */
  .groups-container::-webkit-scrollbar,
  .device-table-container::-webkit-scrollbar {
    height: 6px;
  }

  .groups-container::-webkit-scrollbar-track,
  .device-table-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
  }

  .groups-container::-webkit-scrollbar-thumb,
  .device-table-container::-webkit-scrollbar-thumb {
    background: rgba(90, 111, 216, 0.5);
    border-radius: 10px;
  }

  .groups-container::-webkit-scrollbar-thumb:hover,
  .device-table-container::-webkit-scrollbar-thumb:hover {
    background: rgba(90, 111, 216, 0.8);
  }
}

/* 响应式布局 - 极小屏幕 */
@media (max-width: 360px) {
  .device-page {
    padding: 5px;
  }

  h1 {
    font-size: 0.9em;
  }

  .stat-card {
    padding: 6px 10px;
    min-width: 60px;
  }

  .stat-card h3 {
    font-size: 1em;
  }

  .group-tab {
    padding: 8px 12px;
    min-width: 90px;
    font-size: 0.85em;
  }

  .view-toggle-btn, .refresh-btn, .manage-btn {
    padding: 6px;
    font-size: 0.8em;
    min-width: 44px;
  }

  .device-card {
    padding: 12px;
  }

  .device-id {
    font-size: 1em;
  }

  .device-info {
    font-size: 0.8em;
  }
}
</style>
