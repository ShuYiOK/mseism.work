/**
 * 设备数据 Store - 优化版
 * 管理设备列表、分组列表和设备分组映射
 * 支持数据持久化，页面刷新后自动恢复
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { deviceApi, groupApi, batchApi } from '../api'

export const useDeviceStore = defineStore('devices', () => {
  // 状态
  const devices = ref([])
  const groups = ref([])
  const deviceGroupsMap = ref({}) // 设备 ID -> 分组 ID 数组
  const groupDevicesMap = ref({}) // 分组 ID -> 设备 ID 数组
  const loading = ref(false)

  // 计算属性
  const deviceCount = computed(() => devices.value.length)

  const onlineDevices = computed(() =>
    devices.value.filter(d => d.online)
  )

  const offlineDevices = computed(() =>
    devices.value.filter(d => !d.online)
  )

  const onlineCount = computed(() => onlineDevices.value.length)

  const offlineCount = computed(() => offlineDevices.value.length)

  // 缓存：分组ID -> 设备数量
  const groupDeviceCountCache = computed(() => {
    const cache = {}
    const countMap = {}
    
    for (const deviceGroups of Object.values(deviceGroupsMap.value)) {
      for (const groupId of deviceGroups) {
        countMap[groupId] = (countMap[groupId] || 0) + 1
      }
    }
    
    for (const group of groups.value) {
      cache[group.id] = countMap[group.id] || 0
    }
    
    return cache
  })

  // 缓存：分组ID -> 设备列表
  const groupDevicesCache = computed(() => {
    const cache = {}
    const deviceMap = new Map(devices.value.map(d => [d.id, d]))
    
    for (const group of groups.value) {
      const deviceIds = groupDevicesMap.value[group.id] || []
      cache[group.id] = deviceIds
        .map(id => deviceMap.get(id))
        .filter(Boolean)
    }
    
    return cache
  })

  // 缓存：分组统计信息
  const groupStatsCache = computed(() => {
    const stats = {}
    
    for (const group of groups.value) {
      const groupDevices = groupDevicesCache.value[group.id] || []
      stats[group.id] = {
        total: groupDevices.length,
        online: groupDevices.filter(d => d.online).length,
        offline: groupDevices.filter(d => !d.online).length
      }
    }
    
    return stats
  })

  // 优化版：获取分组设备数量（使用缓存）
  const groupDeviceCount = (groupId) => {
    return groupDeviceCountCache.value[groupId] || 0
  }

  // 获取设备所属的所有分组
  const getDeviceGroups = (deviceId) => {
    return deviceGroupsMap.value[deviceId] || []
  }

  // 判断设备是否属于某个分组
  const isDeviceInGroup = (deviceId, groupId) => {
    const groups = getDeviceGroups(deviceId)
    return groups.includes(groupId)
  }

  // 优化版：获取分组设备（使用缓存）
  const getDevicesByGroup = (groupId) => {
    return groupDevicesCache.value[groupId] || []
  }

  // 获取分组统计信息（使用缓存）
  const getGroupStats = (groupId) => {
    return groupStatsCache.value[groupId] || { total: 0, online: 0, offline: 0 }
  }

  // 加载所有设备
  const loadDevices = async () => {
    try {
      loading.value = true
      const res = await deviceApi.getAll()
      if (res.data.success) {
        devices.value = res.data.data
      }
      return res.data
    } catch (error) {
      console.error('加载设备失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 加载所有分组
  const loadGroups = async () => {
    try {
      const res = await groupApi.getAll()
      if (res.data.success) {
        groups.value = res.data.data
      }
      return res.data
    } catch (error) {
      console.error('加载分组失败:', error)
      throw error
    }
  }

  // 同时加载设备和分组（优化版）
  const loadDevicesAndGroupsOptimized = async () => {
    try {
      loading.value = true
      const [devicesRes, groupsRes] = await Promise.all([
        deviceApi.getAll(),
        groupApi.getAll()
      ])

      if (devicesRes.data.success) {
        devices.value = devicesRes.data.data
      }

      if (groupsRes.data.success) {
        groups.value = groupsRes.data.data
      }

      return {
        devices: devicesRes.data,
        groups: groupsRes.data
      }
    } catch (error) {
      console.error('同时加载设备和分组失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 加载分组的设备
  const loadGroupDevices = async (groupId) => {
    try {
      const res = await groupApi.getDevices(groupId)
      if (res.data.success) {
        // 建立新的映射关系
        res.data.data.forEach(device => {
          if (!deviceGroupsMap.value[device.id]) {
            deviceGroupsMap.value[device.id] = []
          }
          if (!deviceGroupsMap.value[device.id].includes(groupId)) {
            deviceGroupsMap.value[device.id].push(groupId)
          }
        })
      }
      return res.data
    } catch (error) {
      console.error('加载分组设备失败:', error)
      throw error
    }
  }

  // 加载所有设备-分组映射关系
  const loadDeviceGroupMappings = async () => {
    try {
      const res = await batchApi.getDeviceGroupMappings()
      if (res.data.success) {
        const mappings = res.data.data
        // 重置映射
        deviceGroupsMap.value = {}
        groupDevicesMap.value = {}

        // 服务器返回格式: {deviceId: [{id, name, color}]}
        // 需要转换为: deviceGroupsMap[deviceId] = [groupId, ...]
        //           groupDevicesMap[groupId] = [deviceId, ...]
        Object.entries(mappings).forEach(([deviceId, groups]) => {
          if (!deviceGroupsMap.value[deviceId]) {
            deviceGroupsMap.value[deviceId] = []
          }

          groups.forEach(group => {
            const groupId = group.id

            // 设备 -> 分组映射
            if (!deviceGroupsMap.value[deviceId].includes(groupId)) {
              deviceGroupsMap.value[deviceId].push(groupId)
            }

            // 分组 -> 设备映射
            if (!groupDevicesMap.value[groupId]) {
              groupDevicesMap.value[groupId] = []
            }
            if (!groupDevicesMap.value[groupId].includes(deviceId)) {
              groupDevicesMap.value[groupId].push(deviceId)
            }
          })
        })
        console.log('[Store] 已加载设备-分组映射:', Object.keys(deviceGroupsMap.value).length, '个设备')
      }
      return res.data
    } catch (error) {
      console.error('加载设备-分组映射失败:', error)
      throw error
    }
  }

  /**
   * 同步设备-分组映射（方案B - 携带完整数据）
   * 用于多设备数据同步，接收服务器推送的完整映射数据
   * @param {Object} mappings - 服务器推送的映射数据 {deviceId: [{id, name, color}]}
   * @param {Object} options - 同步选项
   * @param {number} options.timestamp - 服务器时间戳，用于冲突解决
   * @param {boolean} options.merge - 是否合并模式（true）或替换模式（false）
   */
  const syncMappings = (mappings, options = {}) => {
    const {
      timestamp = Date.now(),
      merge = false // 默认使用替换模式
    } = options

    console.log('[Store] 同步设备-分组映射:', {
      timestamp,
      merge,
      mappingDevices: Object.keys(mappings).length
    })

    if (merge) {
      // 合并模式：保留本地数据，添加服务器新数据
      Object.entries(mappings).forEach(([deviceId, groups]) => {
        if (!deviceGroupsMap.value[deviceId]) {
          deviceGroupsMap.value[deviceId] = []
        }

        groups.forEach(group => {
          const groupId = group.id
          if (!deviceGroupsMap.value[deviceId].includes(groupId)) {
            deviceGroupsMap.value[deviceId].push(groupId)
          }

          if (!groupDevicesMap.value[groupId]) {
            groupDevicesMap.value[groupId] = []
          }
          if (!groupDevicesMap.value[groupId].includes(deviceId)) {
            groupDevicesMap.value[groupId].push(deviceId)
          }
        })
      })
    } else {
      // 替换模式：用服务器数据完全替换本地数据
      deviceGroupsMap.value = {}
      groupDevicesMap.value = {}

      Object.entries(mappings).forEach(([deviceId, groups]) => {
        if (!deviceGroupsMap.value[deviceId]) {
          deviceGroupsMap.value[deviceId] = []
        }

        groups.forEach(group => {
          const groupId = group.id

          if (!deviceGroupsMap.value[deviceId].includes(groupId)) {
            deviceGroupsMap.value[deviceId].push(groupId)
          }

          if (!groupDevicesMap.value[groupId]) {
            groupDevicesMap.value[groupId] = []
          }
          if (!groupDevicesMap.value[groupId].includes(deviceId)) {
            groupDevicesMap.value[groupId].push(deviceId)
          }
        })
      })
    }

    console.log('[Store] 同步完成，当前状态:', {
      deviceMappings: Object.keys(deviceGroupsMap.value).length,
      groupMappings: Object.keys(groupDevicesMap.value).length
    })
  }

  /**
   * 同步分组数据（方案B）
   * 用于多设备数据同步，更新分组信息
   * @param {Object} group - 分组数据
   * @param {string} eventType - 事件类型
   */
  const syncGroup = (group, eventType) => {
    console.log('[Store] 同步分组数据:', eventType, group?.name || group?.id)

    switch (eventType) {
      case 'group:create':
        if (group && !groups.value.find(g => g.id === group.id)) {
          groups.value.push(group)
          console.log('[Store] 添加分组:', group.name)
        }
        break

      case 'group:update':
        if (group) {
          const index = groups.value.findIndex(g => g.id === group.id)
          if (index !== -1) {
            groups.value[index] = { ...groups.value[index], ...group }
            console.log('[Store] 更新分组:', group.name)
          }
        }
        break

      case 'group:delete':
        if (group) {
          const groupId = typeof group === 'string' ? group : group.id
          groups.value = groups.value.filter(g => g.id !== groupId)
          delete groupDevicesMap.value[groupId]
          console.log('[Store] 删除分组:', groupId)
        }
        break

      default:
        console.warn('[Store] 未知的分组事件类型:', eventType)
    }
  }

  /**
   * 完整数据同步（方案B - 主入口）
   * 处理服务器推送的完整同步数据
   * @param {Object} data - 同步数据 { eventType, timestamp, mappings, group, deviceId, groupId }
   */
  const fullSync = (data) => {
    const { eventType, timestamp, mappings, group, deviceId, groupId } = data

    console.log('[Store] 执行完整数据同步:', {
      eventType,
      timestamp,
      hasMappings: !!mappings,
      hasGroup: !!group
    })

    // 1. 先同步分组数据（如果包含）
    if (group) {
      syncGroup(group, eventType)
    }

    // 2. 同步设备-分组映射
    if (mappings) {
      syncMappings(mappings, { timestamp, merge: false })
    }

    console.log('[Store] 完整数据同步完成')
  }

  // 更新设备列表
  const updateDevices = (newDevices) => {
    const deviceMap = new Map(devices.value.map((d, index) => [d.id, index]))

    newDevices.forEach(newDevice => {
      const index = deviceMap.get(newDevice.id)
      if (index !== undefined) {
        // 更新现有设备（替换整个对象以触发响应式更新）
        devices.value[index] = { ...newDevice }
      } else {
        // 添加新设备
        devices.value.push(newDevice)
      }
    })
  }

  // 添加单个设备
  const addDevice = (device) => {
    const index = devices.value.findIndex(d => d.id === device.id)
    if (index >= 0) {
      // 更新现有设备（替换整个对象以触发响应式更新）
      devices.value[index] = { ...device }
    } else {
      // 添加新设备
      devices.value.push(device)
    }
  }

  // 删除设备
  const removeDevice = (deviceId) => {
    devices.value = devices.value.filter(d => d.id !== deviceId)
    // 同时删除设备分组映射
    delete deviceGroupsMap.value[deviceId]
  }

  // 更新分组
  const updateGroup = (group) => {
    const index = groups.value.findIndex(g => g.id === group.id)
    if (index >= 0) {
      groups.value[index] = { ...groups.value[index], ...group }
    } else {
      groups.value.push(group)
    }
  }

  // 删除分组
  const removeGroup = (groupId) => {
    groups.value = groups.value.filter(g => g.id !== groupId)
    // 清理该分组的所有设备映射
    Object.keys(deviceGroupsMap.value).forEach(deviceId => {
      const index = deviceGroupsMap.value[deviceId].indexOf(groupId)
      if (index !== -1) {
        deviceGroupsMap.value[deviceId].splice(index, 1)
        if (deviceGroupsMap.value[deviceId].length === 0) {
          delete deviceGroupsMap.value[deviceId]
        }
      }
    })
  }

  // 添加设备到分组
  const addDeviceToGroup = (deviceId, groupId) => {
    // 更新分组设备映射
    if (!groupDevicesMap.value[groupId]) {
      groupDevicesMap.value[groupId] = []
    }
    if (!groupDevicesMap.value[groupId].includes(deviceId)) {
      groupDevicesMap.value[groupId].push(deviceId)
    }
    if (!deviceGroupsMap.value[deviceId]) {
      deviceGroupsMap.value[deviceId] = []
    }
    if (!deviceGroupsMap.value[deviceId].includes(groupId)) {
      deviceGroupsMap.value[deviceId].push(groupId)
    }
  }

  // 从分组移除设备
  const removeDeviceFromGroup = (deviceId, groupId) => {
    // 更新分组设备映射
    if (groupDevicesMap.value[groupId]) {
      const idx = groupDevicesMap.value[groupId].indexOf(deviceId)
      if (idx !== -1) {
        groupDevicesMap.value[groupId].splice(idx, 1)
        if (groupDevicesMap.value[groupId].length === 0) {
          delete groupDevicesMap.value[groupId]
        }
      }
    }
    const groups = deviceGroupsMap.value[deviceId]
    if (groups) {
      const index = groups.indexOf(groupId)
      if (index !== -1) {
        groups.splice(index, 1)
        if (groups.length === 0) {
          delete deviceGroupsMap.value[deviceId]
        }
      }
    }
  }

  // 重置所有数据
  const reset = () => {
    devices.value = []
    groups.value = []
    deviceGroupsMap.value = {}
    loading.value = false
  }

  // 获取在线设备（优化查询）
  const fetchOnlineDevices = async (limit = null) => {
    try {
      const res = await batchApi.getOnlineDevices(limit)
      if (res.data.success) {
        return res.data.data
      }
      return []
    } catch (error) {
      console.error('获取在线设备失败:', error)
      throw error
    }
  }

  // 获取离线设备（优化查询）
  const fetchOfflineDevices = async (limit = null) => {
    try {
      const res = await batchApi.getOfflineDevices(limit)
      if (res.data.success) {
        return res.data.data
      }
      return []
    } catch (error) {
      console.error('获取离线设备失败:', error)
      throw error
    }
  }

  // 获取分组设备统计
  const fetchGroupDeviceStats = async () => {
    try {
      const res = await batchApi.getStats()
      if (res.data.success) {
        return res.data.data
      }
      return []
    } catch (error) {
      console.error('获取分组设备统计失败:', error)
      throw error
    }
  }

  return {
    // 状态
    devices,
    groups,
    deviceGroupsMap,
    groupDevicesMap,
    loading,
    // 计算属性
    deviceCount,
    onlineDevices,
    offlineDevices,
    onlineCount,
    offlineCount,
    groupDeviceCountCache,
    groupDevicesCache,
    groupStatsCache,
    // 方法
    groupDeviceCount,
    getDeviceGroups,
    isDeviceInGroup,
    getDevicesByGroup,
    getGroupStats,
    loadDevices,
    loadGroups,
    loadDevicesAndGroupsOptimized,
    loadGroupDevices,
    updateDevices,
    addDevice,
    removeDevice,
    updateGroup,
    removeGroup,
    addDeviceToGroup,
    removeDeviceFromGroup,
    reset,
    fetchOnlineDevices,
    fetchOfflineDevices,
    fetchGroupDeviceStats,
    loadDeviceGroupMappings,
    syncMappings,
    syncGroup,
    fullSync
  }
}, {
  persist: {
    key: 'mseism-device-store',
    storage: localStorage,
    paths: [],
    beforeRestore: (ctx) => {
      console.log('[Store] 恢复上下文（数据将从服务器实时获取）')
    },
    afterRestore: (ctx) => {
      console.log('[Store] 恢复完成，将从服务器获取最新数据')
      ctx.store.devices = []
      ctx.store.groups = []
      ctx.store.deviceGroupsMap = {}
      ctx.store.groupDevicesMap = {}
    }
  }
})
