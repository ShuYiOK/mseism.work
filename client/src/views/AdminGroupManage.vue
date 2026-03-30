<template>
  <div class="group-manage">
    <!-- 创建分组卡片 -->
    <div class="card create-group-card">
      <h2>➕ 创建新分组</h2>
      <div class="create-form">
        <input
          v-model="newGroup.name"
          type="text"
          placeholder="分组名称"
          class="input-field"
        />
        <input
          v-model="newGroup.description"
          type="text"
          placeholder="描述（可选）"
          class="input-field"
        />
        <input
          v-model="newGroup.color"
          type="color"
          class="color-input"
          title="选择颜色"
        />
        <button @click="createGroup" class="btn btn-primary">创建</button>
      </div>
    </div>

    <!-- 分组列表 -->
    <div v-if="loading" class="loading-state">
      <Skeleton type="card" :count="3" />
    </div>
    <div v-else-if="deviceStore.groups.length === 0" class="empty-state">
      <p>📁 暂无分组，请创建一个新分组</p>
    </div>
    <div v-else class="groups-container">
      <div
        v-for="group in deviceStore.groups"
        :key="group.id"
        class="card group-card"
        :style="{ borderLeftColor: group?.color }"
      >
        <!-- 分组头部 -->
        <div class="group-header">
          <div class="group-info">
            <h3>{{ group?.name || '未知分组' }}</h3>
            <p>{{ group?.description || '暂无描述' }}</p>
          </div>
          <div class="group-actions">
            <span class="device-count">
              📊 {{ group?.device_count || 0 }} 台设备
            </span>
            <button @click="editGroup(group)" class="btn btn-sm">✏️ 编辑</button>
            <button @click="deleteGroup(group?.id)" class="btn btn-sm btn-danger">
              🗑️ 删除
            </button>
          </div>
        </div>

        <!-- 分组设备列表 -->
        <div class="group-devices">
          <button @click="openDeviceSelectModal(group?.id)" class="btn btn-secondary">
            ➕ 批量添加设备
          </button>

          <div class="device-list">
            <div
              v-for="device in groupDevices[group?.id]"
              :key="device.id"
              class="device-item"
            >
              <span :class="device?.online ? 'status-online' : 'status-offline'">
                {{ device?.online ? '🟢' : '🔴' }}
              </span>
              <span class="device-name">{{ device?.name || device?.id || '未知设备' }}</span>
              <span class="device-ip">{{ device?.ip_address || '无 IP' }}</span>
              <button
                @click="removeDeviceFromGroup(group?.id, device?.id)"
                class="btn-icon"
                title="移除"
              >
                ✕
              </button>
            </div>
            <div v-if="!groupDevices[group?.id]?.length" class="no-devices">
              暂无设备
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑分组模态框 -->
    <div v-if="editingGroup" class="modal-overlay" @click="closeEditModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>✏️ 编辑分组</h2>
          <button @click="closeEditModal" class="btn-icon">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>分组名称</label>
            <input v-model="editForm.name" type="text" class="input-field" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <input v-model="editForm.description" type="text" class="input-field" />
          </div>
          <div class="form-group">
            <label>颜色</label>
            <input v-model="editForm.color" type="color" class="color-input" />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeEditModal" class="btn">取消</button>
          <button @click="saveEditGroup" class="btn btn-primary">保存</button>
        </div>
      </div>
    </div>

    <!-- 设备选择模态框 -->
    <div v-if="deviceSelectModal" class="modal-overlay" @click="closeDeviceSelectModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h2>➕ 批量添加设备</h2>
          <button @click="closeDeviceSelectModal" class="btn-icon">✕</button>
        </div>
        <div class="modal-body">
          <div class="selection-info">
            已选择 <strong>{{ selectedDevices.length }}</strong> 台设备
          </div>
          <div class="device-select-list">
            <div
              v-for="device in devices"
              :key="device.id"
              class="device-select-item"
            >
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :value="device?.id"
                  v-model="selectedDevices"
                />
                <span :class="device?.online ? 'status-online' : 'status-offline'">
                  {{ device?.online ? '🟢' : '🔴' }}
                </span>
                <span class="device-name">{{ device?.name || device?.id }}</span>
                <span class="device-ip">{{ device?.ip_address || '无 IP' }}</span>
              </label>
            </div>
            <div v-if="devices.length === 0" class="no-devices">暂无设备</div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeDeviceSelectModal" class="btn">取消</button>
          <button
            @click="confirmAddDevices"
            class="btn btn-primary"
            :disabled="selectedDevices.length === 0"
          >
            确认添加 ({{ selectedDevices.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { groupApi, deviceApi } from '../api'
import socketService from '../utils/socket'
import { useDeviceStore } from '../stores/devices'
import Skeleton from '../components/Skeleton.vue'

const deviceStore = useDeviceStore()

const loading = ref(true)
const newGroup = ref({ name: '', description: '', color: '#667eea' })
const editingGroup = ref(null)
const editForm = ref({ name: '', description: '', color: '' })

// 设备选择
const deviceSelectModal = ref(false)
const currentGroupId = ref(null)
const selectedDevices = ref([])
const devices = ref([])
const groupDevices = ref({})

// 加载数据
const loadData = async () => {
  try {
    await deviceStore.loadGroups()
    updateGroupDevices()

    const deviceRes = await deviceApi.getAll()
    if (deviceRes.data.success) {
      devices.value = deviceRes.data.data
    }
  } catch (err) {
    // API拦截器已处理错误
  } finally {
    loading.value = false
  }
}

// 更新分组设备列表
const updateGroupDevices = () => {
  const result = {}
  deviceStore.groups.forEach(group => {
    result[group.id] = deviceStore.getDevicesByGroup(group.id)
  })
  groupDevices.value = result
}

// 创建分组
const createGroup = async () => {
  if (!newGroup.value.name.trim()) {
    if (window.toast) window.toast.warning('请输入分组名称')
    return
  }

  try {
    const res = await groupApi.create(newGroup.value)
    if (res.data.success) {
      await deviceStore.loadGroups()
      updateGroupDevices()
      newGroup.value = { name: '', description: '', color: '#667eea' }
      if (window.toast) window.toast.success('分组创建成功')
    }
  } catch (err) {
    if (window.toast) window.toast.error('创建失败：' + err.message)
  }
}

// 编辑分组
const editGroup = (group) => {
  if (!group) return
  editingGroup.value = group
  editForm.value = {
    id: group.id,
    name: group.name || '',
    description: group.description || '',
    color: group.color || '#667eea'
  }
}

const closeEditModal = () => {
  editingGroup.value = null
}

const saveEditGroup = async () => {
  if (!editForm.value.name.trim()) {
    if (window.toast) window.toast.warning('请输入分组名称')
    return
  }

  try {
    const res = await groupApi.update(editForm.value.id, editForm.value)
    if (res.data.success) {
      await deviceStore.loadGroups()
      updateGroupDevices()
      closeEditModal()
      if (window.toast) window.toast.success('分组更新成功')
    }
  } catch (err) {
    if (window.toast) window.toast.error('更新失败：' + err.message)
  }
}

// 删除分组
const deleteGroup = async (id) => {
  if (!confirm('确定要删除该分组吗？此操作不可恢复。')) return

  try {
    await groupApi.delete(id)
    deviceStore.removeGroup(id)
    updateGroupDevices()
    if (window.toast) window.toast.success('分组删除成功')
  } catch (err) {
    if (window.toast) window.toast.error('删除失败：' + err.message)
  }
}

// 从分组移除设备
const removeDeviceFromGroup = async (groupId, deviceId) => {
  if (!confirm('确定要从该分组移除此设备吗？')) return

  try {
    await groupApi.removeDevice(groupId, deviceId)
    deviceStore.removeDeviceFromGroup(deviceId, groupId)
    await deviceStore.loadGroups()
    updateGroupDevices()
    if (window.toast) window.toast.success('设备移除成功')
  } catch (err) {
    if (window.toast) window.toast.error('移除失败：' + err.message)
  }
}

// 打开设备选择模态框
const openDeviceSelectModal = async (groupId) => {
  currentGroupId.value = groupId
  selectedDevices.value = []

  if (devices.value.length === 0) {
    try {
      const deviceRes = await deviceApi.getAll()
      if (deviceRes.data.success) {
        devices.value = deviceRes.data.data
      }
    } catch (err) {
      if (window.toast) window.toast.error('加载设备数据失败：' + err.message)
    }
  }

  deviceSelectModal.value = true
}

// 关闭设备选择模态框
const closeDeviceSelectModal = () => {
  deviceSelectModal.value = false
  currentGroupId.value = null
  selectedDevices.value = []
}

// 确认添加设备
const confirmAddDevices = async () => {
  if (!currentGroupId.value || selectedDevices.value.length === 0) return

  try {
    for (const deviceId of selectedDevices.value) {
      await groupApi.addDevice(currentGroupId.value, deviceId)
    }

    await deviceStore.loadGroupDevices(currentGroupId.value)
    await deviceStore.loadGroups()
    updateGroupDevices()
    closeDeviceSelectModal()

    if (window.toast) {
      window.toast.success(`成功添加 ${selectedDevices.value.length} 台设备`)
    }
  } catch (err) {
    if (window.toast) window.toast.error('添加失败：' + err.message)
  }
}

// Socket 事件处理
const handleGroupUpdate = (group) => {
  deviceStore.updateGroup(group)
}

const handleGroupDelete = (data) => {
  deviceStore.removeGroup(data.id)
}

const handleGroupCreate = (group) => {
  deviceStore.updateGroup(group)
}

onMounted(() => {
  socketService.connect()
  loadData()
  socketService.on('group:update', handleGroupUpdate)
  socketService.on('group:delete', handleGroupDelete)
  socketService.on('group:create', handleGroupCreate)
})

onUnmounted(() => {
  socketService.off('group:update', handleGroupUpdate)
  socketService.off('group:delete', handleGroupDelete)
  socketService.off('group:create', handleGroupCreate)
})
</script>

<style scoped>
.group-manage {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 卡片样式 */
.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card h2 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 1.2em;
}

/* 创建表单 */
.create-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.input-field {
  flex: 1;
  min-width: 200px;
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1em;
  transition: border-color 0.3s;
}

.input-field:focus {
  outline: none;
  border-color: #667eea;
}

.color-input {
  width: 50px;
  height: 42px;
  padding: 4px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
}

/* 按钮样式 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9em;
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
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #4caf50;
  color: white;
}

.btn-secondary:hover {
  background: #43a047;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #d32f2f;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.85em;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f5f5f5;
  color: #333;
}

/* 分组卡片 */
.group-card {
  border-left: 4px solid #667eea;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
}

.group-info h3 {
  margin: 0 0 4px 0;
  color: #333;
  font-size: 1.1em;
}

.group-info p {
  margin: 0;
  color: #666;
  font-size: 0.9em;
}

.group-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.device-count {
  color: #666;
  font-size: 0.9em;
  padding: 4px 12px;
  background: #f5f5f5;
  border-radius: 16px;
}

/* 设备列表 */
.group-devices {
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.group-devices > button {
  margin-bottom: 12px;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;
  transition: background 0.2s;
}

.device-item:hover {
  background: #f0f0f0;
}

.status-online {
  color: #4caf50;
}

.status-offline {
  color: #f44336;
}

.device-name {
  flex: 1;
  font-weight: 500;
}

.device-ip {
  color: #666;
  font-size: 0.85em;
}

.no-devices {
  text-align: center;
  color: #999;
  padding: 24px;
}

/* 空状态和加载状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.loading-state {
  padding: 20px 0;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s;
}

.modal-large {
  max-width: 600px;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2em;
  color: #333;
}

.modal-body {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

/* 表单 */
.form-group {
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 0.9em;
}

.form-group .input-field {
  width: 100%;
}

/* 设备选择列表 */
.selection-info {
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
  margin-bottom: 16px;
  color: #667eea;
  font-size: 0.9em;
}

.device-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.device-select-item {
  padding: 8px 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.checkbox-label:hover {
  background: #f9fafb;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* 响应式 */
@media (max-width: 768px) {
  .create-form {
    flex-direction: column;
    align-items: stretch;
  }

  .group-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .group-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .device-item {
    flex-wrap: wrap;
    padding: 8px;
  }

  .device-name {
    min-width: 100%;
    margin-bottom: 4px;
  }

  .modal {
    max-width: 95%;
  }
}

@media (max-width: 480px) {
  .card {
    padding: 16px;
  }

  .btn {
    width: 100%;
  }

  .btn-sm {
    width: auto;
  }
}
</style>
