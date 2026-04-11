/**
 * WebSocket 集成模块
 * 自动将 WebSocket 事件路由到 Pinia store
 */
import { useDeviceStore } from '../stores/devices'

export function setupWebSocketIntegration(socketService) {
  const deviceStore = useDeviceStore()

  socketService.on('devices:added', (devices) => {
    console.log('[WebSocket] 设备添加:', devices.length)
    devices.forEach(device => deviceStore.addDevice(device))
  })

  socketService.on('devices:updated', (devices) => {
    console.log('[WebSocket] 设备更新:', devices.length)
    deviceStore.updateDevices(devices)
  })

  socketService.on('device:delete', (data) => {
    console.log('[WebSocket] 设备删除:', data.id)
    deviceStore.removeDevice(data.id)
  })

  socketService.on('group:create', (group) => {
    console.log('[WebSocket] 分组创建:', group.name)
    deviceStore.updateGroup(group)
  })

  socketService.on('group:update', (group) => {
    console.log('[WebSocket] 分组更新:', group.name)
    deviceStore.updateGroup(group)
  })

  socketService.on('group:delete', (data) => {
    console.log('[WebSocket] 分组删除:', data.id)
    deviceStore.removeGroup(data.id)
  })

  socketService.on('group:device_added', (data) => {
    console.log('[WebSocket] 设备添加到分组:', data.deviceId, '->', data.groupId)
    deviceStore.addDeviceToGroup(data.deviceId, data.groupId)
    if (data.group) {
      deviceStore.updateGroup(data.group)
    }
  })

  socketService.on('group:device_removed', (data) => {
    console.log('[WebSocket] 设备从分组移除:', data.deviceId, '<-', data.groupId)
    deviceStore.removeDeviceFromGroup(data.deviceId, data.groupId)
    if (data.group) {
      deviceStore.updateGroup(data.group)
    }
  })

  console.log('[WebSocket] 集成模块已设置')
}
