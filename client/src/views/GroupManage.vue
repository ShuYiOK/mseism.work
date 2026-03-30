<template>
  <div class="group-page">
    <div class="header">
      <h1>分组管理</h1>
      <router-link to="/" class="back-btn">← 返回</router-link>
    </div>

    <!-- 创建分组 -->
    <div class="create-group-form">
      <input v-model="newGroup.name" type="text" placeholder="分组名称" class="input-field" />
      <input v-model="newGroup.description" type="text" placeholder="描述" class="input-field" />
      <input v-model="newGroup.color" type="color" class="color-input" />
      <button @click="createGroup" class="create-btn">创建分组</button>
    </div>

    <!-- 分组列表 -->
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="groups-container">
      <div v-for="group in groups" :key="group.id" class="group-card" :style="{ borderLeftColor: group.color }">
        <div class="group-header">
          <div class="group-info">
            <h3>{{ group.name }}</h3>
            <p>{{ group.description || '暂无描述' }}</p>
          </div>
          <div class="group-actions">
            <span class="device-count">{{ group.device_count }} 台设备</span>
            <button @click="deleteGroup(group.id)" class="delete-btn">删除</button>
          </div>
        </div>

        <!-- 分组设备列表 -->
        <div class="group-devices">
          <div class="device-selector">
            <select v-model="selectedDevice[group.id]" class="device-select">
              <option value="">添加设备...</option>
              <option v-for="device in availableDevices" :key="device.id" :value="device.id">
                {{ device.id }} - {{ device.name }}
              </option>
            </select>
            <button @click="addDeviceToGroup(group.id)" class="add-btn">添加</button>
          </div>

          <div class="device-list">
            <div v-for="device in groupDevices[group.id]" :key="device.id" class="device-item">
              <span :class="device.online ? 'device-online' : 'device-offline'">
                ● {{ device.id }} - {{ device.name }}
              </span>
              <button @click="removeDeviceFromGroup(group.id, device.id)" class="remove-btn">×</button>
            </div>
            <div v-if="!groupDevices[group.id]?.length" class="no-devices">暂无设备</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!groups.length && !loading" class="empty-state">
      <p>暂无分组，请创建一个新分组</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { deviceApi, groupApi } from '../api'
import socketService from '../utils/socket'

const loading = ref(true)
const groups = ref([])
const devices = ref([])
const newGroup = ref({ name: '', description: '', color: '#667eea' })
const selectedDevice = ref({})
const groupDevices = ref({})

// 可用设备（未被当前分组包含的设备）
const availableDevices = computed(() => {
  return devices.value.filter(d => d.online !== undefined)
})

// 加载数据
const loadData = async () => {
  try {
    const [groupsRes, devicesRes] = await Promise.all([
      groupApi.getAll(),
      deviceApi.getAll()
    ])
    
    if (groupsRes.data.success) {
      groups.value = groupsRes.data.data
    }
    if (devicesRes.data.success) {
      devices.value = devicesRes.data.data
    }

    // 加载每个分组的设备
    for (const group of groups.value) {
      await loadGroupDevices(group.id)
    }
  } catch (err) {
    console.error('加载数据失败:', err)
  } finally {
    loading.value = false
  }
}

const loadGroupDevices = async (groupId) => {
  try {
    const res = await groupApi.getDevices(groupId)
    if (res.data.success) {
      groupDevices.value[groupId] = res.data.data
    }
  } catch (err) {
    console.error('加载分组设备失败:', err)
  }
}

// 创建分组
const createGroup = async () => {
  if (!newGroup.value.name.trim()) {
    alert('请输入分组名称')
    return
  }

  try {
    const res = await groupApi.create(newGroup.value)
    if (res.data.success) {
      groups.value.push(res.data.data)
      groupDevices.value[res.data.data.id] = []
      newGroup.value = { name: '', description: '', color: '#667eea' }
    }
  } catch (err) {
    alert('创建失败：' + err.response?.data?.error || err.message)
  }
}

// 删除分组
const deleteGroup = async (id) => {
  if (!confirm('确定要删除该分组吗？')) return

  try {
    await groupApi.delete(id)
    groups.value = groups.value.filter(g => g.id !== id)
    delete groupDevices.value[id]
  } catch (err) {
    alert('删除失败：' + err.message)
  }
}

// 添加设备到分组
const addDeviceToGroup = async (groupId) => {
  const deviceId = selectedDevice.value[groupId]
  if (!deviceId) return

  try {
    await groupApi.addDevice(groupId, deviceId)
    await loadGroupDevices(groupId)
    // 更新分组设备数量
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      group.device_count = (group.device_count || 0) + 1
    }
    selectedDevice.value[groupId] = ''
  } catch (err) {
    alert('添加失败：' + err.response?.data?.error || err.message)
  }
}

// 从分组移除设备
const removeDeviceFromGroup = async (groupId, deviceId) => {
  try {
    await groupApi.removeDevice(groupId, deviceId)
    await loadGroupDevices(groupId)
    // 更新分组设备数量
    const group = groups.value.find(g => g.id === groupId)
    if (group) {
      group.device_count = Math.max(0, (group.device_count || 0) - 1)
    }
  } catch (err) {
    alert('移除失败：' + err.message)
  }
}

// Socket 事件处理
const handleGroupUpdate = (group) => {
  const index = groups.value.findIndex(g => g.id === group.id)
  if (index >= 0) {
    groups.value[index] = { ...groups.value[index], ...group }
  }
}

const handleGroupDelete = (data) => {
  groups.value = groups.value.filter(g => g.id !== data.id)
  delete groupDevices.value[data.id]
}

onMounted(() => {
  loadData()
  socketService.on('group:update', handleGroupUpdate)
  socketService.on('group:delete', handleGroupDelete)
})

onUnmounted(() => {
  socketService.off('group:update', handleGroupUpdate)
  socketService.off('group:delete', handleGroupDelete)
})
</script>

<style scoped>
.group-page {
  padding: 20px;
  min-height: 100vh;
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h1 {
  color: white;
  font-size: 1.5em;
}

.back-btn {
  padding: 10px 20px;
  background: rgba(255,255,255,0.95);
  color: #667eea;
  text-decoration: none;
  border-radius: 20px;
  font-weight: bold;
  transition: all 0.3s ease;
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.create-group-form {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  flex-wrap: wrap;
  background: rgba(255,255,255,0.95);
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.input-field {
  flex: 1;
  min-width: 150px;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1em;
}

.color-input {
  width: 50px;
  height: 45px;
  padding: 5px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
}

.create-btn {
  padding: 12px 30px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.create-btn:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.groups-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.group-card {
  background: var(--card-bg);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  border-left: 5px solid #667eea;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.group-info h3 {
  color: var(--text-primary);
  margin: 0 0 5px 0;
  font-size: 1.2em;
}

.group-info p {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.9em;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.device-count {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.delete-btn {
  padding: 8px 15px;
  background: var(--danger-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85em;
  transition: all 0.3s ease;
}

.delete-btn:hover {
  background: #d32f2f;
}

.group-devices {
  border-top: 1px solid var(--border-color);
  padding-top: 15px;
}

.device-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.device-select {
  flex: 1;
  padding: 10px 15px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  font-size: 1em;
  background: var(--card-bg);
  color: var(--text-primary);
}

.add-btn {
  padding: 10px 20px;
  background: var(--success-color);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.add-btn:hover {
  background: #43a047;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 8px;
}

.device-online {
  color: var(--success-color);
  font-weight: bold;
}

.device-offline {
  color: var(--danger-color);
  font-weight: bold;
}

.remove-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--danger-color);
  color: white;
  cursor: pointer;
  font-size: 1.2em;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.remove-btn:hover {
  background: #d32f2f;
  transform: scale(1.1);
}

.no-devices {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
}

.loading {
  text-align: center;
  color: white;
  font-size: 1.5em;
  padding: 50px;
}

.empty-state {
  text-align: center;
  color: white;
  padding: 50px;
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
}

@media (max-width: 768px) {
  .group-page {
    padding: 10px;
  }

  .create-group-form {
    flex-direction: column;
  }

  .input-field {
    width: 100%;
  }

  .group-header {
    flex-direction: column;
    gap: 15px;
  }

  .device-selector {
    flex-direction: column;
  }
}
</style>
