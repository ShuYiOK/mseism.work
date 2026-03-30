/**
 * WebSocket 集成模块
 * 自动将 WebSocket 事件路由到 Pinia store
 */
import { useDeviceStore } from '../stores/devices'

export function setupWebSocketIntegration(socketService) {
  const deviceStore = useDeviceStore()

  // 监听设备添加事件
  socketService.on('devices:added', (devices) => {
    console.log('[WebSocket] 设备添加:', devices.length)
    devices.forEach(device => deviceStore.addDevice(device))
  })

  // 监听设备更新事件
  socketService.on('devices:updated', (devices) => {
    console.log('[WebSocket] 设备更新:', devices.length)
    deviceStore.updateDevices(devices)
  })

  // 监听设备删除事件
  socketService.on('device:delete', (data) => {
    console.log('[WebSocket] 设备删除:', data.id)
    deviceStore.removeDevice(data.id)
  })

  // 监听分组创建事件
  socketService.on('group:create', (group) => {
    console.log('[WebSocket] 分组创建:', group.name)
    deviceStore.updateGroup(group)
  })

  // 监听分组更新事件
  socketService.on('group:update', (group) => {
    console.log('[WebSocket] 分组更新:', group.name)
    deviceStore.updateGroup(group)
    // 分组更新时重新加载分组设备映射
    deviceStore.loadGroupDevices(group.id)
  })

  // 监听分组删除事件
  socketService.on('group:delete', (data) => {
    console.log('[WebSocket] 分组删除:', data.id)
    deviceStore.removeGroup(data.id)
  })

  console.log('[WebSocket] 集成模块已设置')
}
