<template>
  <div class="group-manage">
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

        <div class="group-devices">
          <button @click="openDeviceSelectModal(group?.id)" class="btn btn-secondary">
            ➕ 批量添加设备
          </button>

          <div class="device-grid">
            <div
              v-for="device in groupDevices[group?.id]"
              :key="device.id"
              class="device-card"
            >
              <span :class="device?.online ? 'status-online' : 'status-offline'">
                {{ device?.online ? '🟢' : '🔴' }}
              </span>
              <span class="device-name">{{ device?.id || '未知设备' }}</span>
              <button
                @click="removeDeviceFromGroup(group?.id, device?.id)"
                class="btn-remove"
                title="移除设备"
              >
                🗑️
              </button>
            </div>
            <div v-if="!groupDevices[group?.id]?.length" class="no-devices">
              暂无设备
            </div>
          </div>
        </div>
      </div>
    </div>

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

    <div v-if="deviceSelectModal" class="modal-overlay" @click="closeDeviceSelectModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h2>➕ 添加设备到「{{ currentGroupName }}」</h2>
          <button @click="closeDeviceSelectModal" class="btn-icon">✕</button>
        </div>
        <div class="modal-body">
          <div class="selection-info">
            <div class="selection-stats">
              <span>可选 <strong>{{ availableDeviceCount }}</strong> 台</span>
              <span class="text-muted">已选 <strong>{{ selectedDevices.length }}</strong> 台</span>
              <span class="text-muted">已在本组 <strong class="text-success">{{ alreadyInCurrentGroupCount }}</strong> 台</span>
            </div>
            <div v-if="assignedToOtherCount > 0" class="selection-warning">
              ⚠️ <strong>{{ assignedToOtherCount }}</strong> 台设备已归属其他分组，无法选择
            </div>
          </div>
          <div class="device-select-list">
            <div
              v-for="(device, index) in sortedModalDevices"
              :key="device.id"
            >
              <div v-if="index === 0 && availableDeviceCount > 0" class="device-section-label">
                <span class="section-label-dot section-dot-available"></span>
                可添加设备（{{ availableDeviceCount }} 台）
              </div>
              <div v-if="index === availableDeviceCount && (alreadyInCurrentGroupCount + assignedToOtherCount) > 0" class="device-section-label section-label-secondary">
                <span class="section-label-dot section-dot-other"></span>
                已分配设备（{{ alreadyInCurrentGroupCount + assignedToOtherCount }} 台）
              </div>
              <div
                class="device-select-item"
                :class="{
                  'device-already-in': isDeviceInCurrentGroup(device.id),
                  'device-assigned-other': isDeviceAssignedToOther(device.id)
                }"
              >
                <label
                  class="checkbox-label"
                  :class="{
                    'label-disabled': isDeviceInCurrentGroup(device.id) || isDeviceAssignedToOther(device.id)
                  }"
                >
                  <input
                    type="checkbox"
                    :value="device.id"
                    v-model="selectedDevices"
                    :disabled="isDeviceInCurrentGroup(device.id) || isDeviceAssignedToOther(device.id)"
                  />
                  <span :class="device?.online ? 'status-online' : 'status-offline'">
                    {{ device?.online ? '🟢' : '🔴' }}
                  </span>
                  <span class="device-name">{{ device?.name || device?.id }}</span>
                  <span class="device-ip">{{ device?.ip_address || '无 IP' }}</span>
                  <span v-if="isDeviceInCurrentGroup(device.id)" class="tag tag-current">当前分组</span>
                  <span v-else-if="getDeviceAssignedGroup(device.id)" class="tag tag-assigned" :style="{ background: getDeviceAssignedGroup(device.id)?.color || '#999' }">
                    {{ getDeviceAssignedGroup(device.id)?.name }}
                  </span>
                </label>
              </div>
            </div>
            <div v-if="modalDevices.length === 0" class="no-devices">暂无设备</div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeDeviceSelectModal" class="btn">取消</button>
          <button
            @click="confirmAddDevices"
            class="btn btn-primary"
            :disabled="newDevicesToAdd.length === 0 || isSubmitting"
          >
            {{ isSubmitting ? '添加中...' : `确认添加 (${newDevicesToAdd.length})` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { groupApi, deviceApi } from '../api'
import socketService from '../utils/socket'
import { useDeviceStore } from '../stores/devices'
import Skeleton from '../components/Skeleton.vue'

const deviceStore = useDeviceStore()

const loading = ref(true)
const newGroup = ref({ name: '', description: '', color: '#667eea' })
const editingGroup = ref(null)
const editForm = ref({ name: '', description: '', color: '' })

const deviceSelectModal = ref(false)
const currentGroupId = ref(null)
const selectedDevices = ref([])
const modalDevices = ref([])
const groupDevices = ref({})
const isSubmitting = ref(false)

const currentGroupName = computed(() => {
  const group = deviceStore.groups.find(g => g.id === currentGroupId.value)
  return group?.name || '未知分组'
})

const deviceAssignedGroupMap = computed(() => {
  const map = {}
  for (const device of modalDevices.value) {
    if (device.assignedGroup) {
      map[device.id] = device.assignedGroup
    }
  }
  return map
})

const availableDeviceCount = computed(() => {
  return modalDevices.value.filter(d => d.isAvailable && !isDeviceInCurrentGroup(d.id)).length
})

const alreadyInCurrentGroupCount = computed(() => {
  return modalDevices.value.filter(d => isDeviceInCurrentGroup(d.id)).length
})

const assignedToOtherCount = computed(() => {
  return modalDevices.value.filter(d => isDeviceAssignedToOther(d.id)).length
})

const newDevicesToAdd = computed(() => {
  return selectedDevices.value.filter(id => !isDeviceInCurrentGroup(id))
})

const sortedModalDevices = computed(() => {
  const devices = modalDevices.value
  if (!devices.length) return []
  return [...devices].sort((a, b) => {
    const aAvailable = a.isAvailable && !isDeviceInCurrentGroup(a.id)
    const bAvailable = b.isAvailable && !isDeviceInCurrentGroup(b.id)
    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1
    const aInGroup = isDeviceInCurrentGroup(a.id)
    const bInGroup = isDeviceInCurrentGroup(b.id)
    if (aInGroup !== bInGroup) return aInGroup ? -1 : 1
    return 0
  })
})

const isDeviceInCurrentGroup = (deviceId) => {
  const groupDevs = groupDevices.value[currentGroupId.value] || []
  return groupDevs.some(d => d.id === deviceId)
}

const isDeviceAssignedToOther = (deviceId) => {
  if (isDeviceInCurrentGroup(deviceId)) return false
  return !!deviceAssignedGroupMap.value[deviceId]
}

const getDeviceAssignedGroup = (deviceId) => {
  return deviceAssignedGroupMap.value[deviceId] || null
}

const loadData = async () => {
  try {
    await deviceStore.loadGroups()
    await deviceStore.loadDeviceGroupMappings()
    updateGroupDevices()

    const deviceRes = await deviceApi.getAll()
    if (deviceRes.data.success) {
      devices.value = deviceRes.data.data
    }
  } catch (err) {
    console.error('加载数据失败:', err)
  } finally {
    loading.value = false
  }
}

const devices = ref([])

const updateGroupDevices = () => {
  const result = {}
  deviceStore.groups.forEach(group => {
    result[group.id] = deviceStore.getDevicesByGroup(group.id)
  })
  groupDevices.value = result
}

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

const openDeviceSelectModal = async (groupId) => {
  currentGroupId.value = groupId
  selectedDevices.value = []

  await loadGroupDevicesForModal(groupId)

  try {
    const res = await groupApi.getAvailableDevices(groupId)
    if (res.data.success) {
      modalDevices.value = res.data.data
    }
  } catch (err) {
    if (window.toast) window.toast.error('加载设备数据失败：' + err.message)
  }

  deviceSelectModal.value = true
}

const loadGroupDevicesForModal = async (groupId) => {
  try {
    const res = await groupApi.getDevices(groupId)
    if (res.data.success) {
      groupDevices.value[groupId] = res.data.data
    }
  } catch (err) {
    console.error('加载分组设备失败:', err)
  }
}

const closeDeviceSelectModal = () => {
  deviceSelectModal.value = false
  currentGroupId.value = null
  selectedDevices.value = []
  modalDevices.value = []
}

const confirmAddDevices = async () => {
  if (!currentGroupId.value || newDevicesToAdd.value.length === 0) return

  isSubmitting.value = true
  let addedCount = 0
  let failedDevices = []

  try {
    for (const deviceId of newDevicesToAdd.value) {
      try {
        await groupApi.addDevice(currentGroupId.value, deviceId)
        addedCount++
      } catch (err) {
        const errData = err.response?.data
        if (errData?.code === 'DEVICE_ALREADY_GROUPED') {
          failedDevices.push({
            id: deviceId,
            reason: errData.error,
            existingGroup: errData.existingGroup
          })
        } else {
          failedDevices.push({
            id: deviceId,
            reason: errData?.error || err.message
          })
        }
      }
    }

    await deviceStore.loadGroupDevices(currentGroupId.value)
    await deviceStore.loadGroups()
    await deviceStore.loadDeviceGroupMappings()
    updateGroupDevices()

    if (addedCount > 0 && failedDevices.length === 0) {
      if (window.toast) {
        window.toast.success(`成功添加 ${addedCount} 台设备`)
      }
      closeDeviceSelectModal()
    } else if (addedCount > 0 && failedDevices.length > 0) {
      if (window.toast) {
        window.toast.warning(
          `成功添加 ${addedCount} 台设备，${failedDevices.length} 台因已归属其他分组被跳过`,
          { title: '部分成功' }
        )
      }
      closeDeviceSelectModal()
    } else if (failedDevices.length > 0) {
      const firstError = failedDevices[0]
      if (window.toast) {
        window.toast.error(firstError.reason, { title: '添加失败' })
      }
    }
  } catch (err) {
    if (window.toast) {
      window.toast.error(`操作失败：${err.message}`, { title: '错误' })
    }
  } finally {
    isSubmitting.value = false
  }
}

const handleGroupUpdate = (group) => {
  deviceStore.updateGroup(group)
}

const handleGroupDelete = (data) => {
  deviceStore.removeGroup(data.id)
}

const handleGroupCreate = (group) => {
  deviceStore.updateGroup(group)
  updateGroupDevices()
}

const handleDeviceAdded = (data) => {
  deviceStore.addDeviceToGroup(data.deviceId, data.groupId)
  if (data.group) {
    deviceStore.updateGroup(data.group)
  }
  updateGroupDevices()
}

const handleDeviceRemoved = (data) => {
  deviceStore.removeDeviceFromGroup(data.deviceId, data.groupId)
  if (data.group) {
    deviceStore.updateGroup(data.group)
  }
  updateGroupDevices()
}

onMounted(() => {
  socketService.connect()
  loadData()
  socketService.on('group:update', handleGroupUpdate)
  socketService.on('group:delete', handleGroupDelete)
  socketService.on('group:create', handleGroupCreate)
  socketService.on('group:device_added', handleDeviceAdded)
  socketService.on('group:device_removed', handleDeviceRemoved)
})

onUnmounted(() => {
  socketService.off('group:update', handleGroupUpdate)
  socketService.off('group:delete', handleGroupDelete)
  socketService.off('group:create', handleGroupCreate)
  socketService.off('group:device_added', handleDeviceAdded)
  socketService.off('group:device_removed', handleDeviceRemoved)
})
</script>

<style scoped>
.group-manage {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

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

.group-devices {
  border-top: 1px solid #e0e0e0;
  padding-top: 16px;
}

.group-devices > button {
  margin-bottom: 12px;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.device-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  padding-right: 44px;
  min-height: 48px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  transition: all 0.2s;
}

.device-card:hover {
  background: #f0f0f0;
  border-color: #d1d5db;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.status-online {
  color: #4caf50;
  flex-shrink: 0;
}

.status-offline {
  color: #f44336;
  flex-shrink: 0;
}

.device-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.85em;
  color: #374151;
  word-break: break-all;
  line-height: 1.4;
  padding-right: 4px;
}

.device-ip {
  display: none;
}

.btn-remove {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #6b7280;
  cursor: pointer;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 1;
  flex-shrink: 0;
}

.btn-remove:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.15);
}

.btn-remove:active {
  transform: translateY(-50%) scale(0.95);
}

.no-devices {
  text-align: center;
  color: #999;
  padding: 24px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.loading-state {
  padding: 20px 0;
}

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
  max-width: 640px;
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

.selection-info {
  padding: 12px;
  background: #f0f7ff;
  border-radius: 8px;
  margin-bottom: 16px;
  color: #667eea;
  font-size: 0.9em;
}

.selection-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.text-muted {
  color: #888;
}

.text-success {
  color: #4caf50;
}

.text-warning {
  color: #ff9800;
}

.selection-warning {
  margin-top: 8px;
  color: #e65100;
  font-size: 0.85em;
}

.device-select-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-select-item {
  padding: 4px 0;
}

.device-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 4px;
  font-size: 0.8em;
  font-weight: 600;
  color: #4caf50;
  letter-spacing: 0.02em;
}

.device-section-label.section-label-secondary {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed #e0e0e0;
  color: #999;
}

.section-label-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.section-dot-available {
  background: #4caf50;
}

.section-dot-other {
  background: #bbb;
}

.device-select-item.device-already-in {
  opacity: 0.7;
}

.device-select-item.device-assigned-other {
  opacity: 0.6;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.checkbox-label:hover {
  background: #f9fafb;
}

.checkbox-label.label-disabled {
  cursor: not-allowed;
  background: #f5f5f5;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.checkbox-label input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.tag {
  font-size: 0.7em;
  padding: 2px 8px;
  color: white;
  border-radius: 10px;
  font-weight: 600;
  margin-left: auto;
  white-space: nowrap;
  flex-shrink: 0;
}

.tag-current {
  background: #4caf50;
}

.tag-assigned {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

  .selection-stats {
    flex-direction: column;
    gap: 4px;
  }

  .checkbox-label {
    gap: 8px;
    padding: 8px;
  }

  .device-ip {
    display: none;
  }

  .tag {
    font-size: 0.65em;
    padding: 2px 6px;
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
