/**
 * 同步管理器 - 多设备数据同步核心模块
 * 支持：
 * 1. 基于 timestamp 的冲突解决 (Last-Write-Wins)
 * 2. 增量同步机制
 * 3. 离线队列支持
 * 4. 房间精准推送
 */

import { ref, computed } from 'vue'

class SyncManager {
  constructor() {
    // 同步状态
    this.isOnline = ref(navigator.onLine)
    this.lastSyncTime = ref(0)
    this.isSyncing = ref(false)

    // 离线队列
    this.offlineQueue = ref([])

    // 增量同步状态
    this.syncVersion = ref(0)
    this.pendingChanges = ref(new Map()) // deviceId -> { groupId, action, timestamp }

    // 房间订阅
    this.subscribedRooms = ref(new Set())

    // 冲突记录
    this.conflictLog = ref([])

    // 监听网络状态
    this.setupNetworkListener()

    // 加载离线队列
    this.loadOfflineQueue()
  }

  /**
   * 设置网络状态监听
   */
  setupNetworkListener() {
    window.addEventListener('online', () => {
      this.isOnline.value = true
      this.processOfflineQueue()
    })

    window.addEventListener('offline', () => {
      this.isOnline.value = false
    })
  }

  /**
   * 从 localStorage 加载离线队列
   */
  loadOfflineQueue() {
    try {
      const saved = localStorage.getItem('mseism_offline_queue')
      if (saved) {
        this.offlineQueue.value = JSON.parse(saved)
        console.log('[SyncManager] 加载离线队列:', this.offlineQueue.value.length, '项')
      }
    } catch (error) {
      console.error('[SyncManager] 加载离线队列失败:', error)
    }
  }

  /**
   * 保存离线队列到 localStorage
   */
  saveOfflineQueue() {
    try {
      localStorage.setItem('mseism_offline_queue', JSON.stringify(this.offlineQueue.value))
    } catch (error) {
      console.error('[SyncManager] 保存离线队列失败:', error)
    }
  }

  /**
   * 添加操作到离线队列
   * @param {Object} operation - 操作对象
   */
  addToOfflineQueue(operation) {
    const queueItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: 'pending',
      ...operation
    }

    this.offlineQueue.value.push(queueItem)
    this.saveOfflineQueue()
    console.log('[SyncManager] 添加到离线队列:', queueItem)

    return queueItem
  }

  /**
   * 处理离线队列
   */
  async processOfflineQueue() {
    if (!this.isOnline.value || this.isSyncing.value) {
      return
    }

    if (this.offlineQueue.value.length === 0) {
      return
    }

    console.log('[SyncManager] 开始处理离线队列:', this.offlineQueue.value.length, '项')

    this.isSyncing.value = true
    const failedItems = []

    for (const item of this.offlineQueue.value) {
      try {
        await this.executeOfflineOperation(item)
        console.log('[SyncManager] 离线操作执行成功:', item.id)
      } catch (error) {
        console.error('[SyncManager] 离线操作执行失败:', item.id, error)
        failedItems.push(item)
      }
    }

    this.offlineQueue.value = failedItems
    this.saveOfflineQueue()
    this.isSyncing.value = false

    if (failedItems.length > 0) {
      console.warn('[SyncManager] 有', failedItems.length, '项离线操作失败')
    }
  }

  /**
   * 执行离线操作（需要根据操作类型调用不同的API）
   */
  async executeOfflineOperation(operation) {
    // 这里需要根据 operation.type 调用不同的 API
    // 实际实现时由调用方注入
    console.log('[SyncManager] 执行离线操作:', operation)
    return Promise.resolve()
  }

  /**
   * 记录冲突
   */
  logConflict(localData, remoteData, resolution) {
    const conflict = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      localData,
      remoteData,
      resolution,
      resolvedAt: Date.now()
    }

    this.conflictLog.value.push(conflict)

    // 只保留最近100条冲突记录
    if (this.conflictLog.value.length > 100) {
      this.conflictLog.value = this.conflictLog.value.slice(-100)
    }

    console.log('[SyncManager] 记录冲突:', conflict)
    return conflict
  }

  /**
   * 基于 Timestamp 的冲突解决 (Last-Write-Wins)
   * @param {Object} localData - 本地数据
   * @param {Object} remoteData - 远程数据
   * @param {number} localTimestamp - 本地时间戳
   * @param {number} remoteTimestamp - 远程时间戳
   * @returns {Object} 解决后的数据
   */
  resolveConflict(localData, remoteData, localTimestamp, remoteTimestamp) {
    // Last-Write-Wins: 使用时间戳较新的数据
    if (remoteTimestamp > localTimestamp) {
      this.logConflict(localData, remoteData, 'REMOTE_WINS')
      return { data: remoteData, source: 'remote' }
    } else {
      this.logConflict(localData, remoteData, 'LOCAL_WINS')
      return { data: localData, source: 'local' }
    }
  }

  /**
   * 增量同步：记录变更
   * @param {string} deviceId - 设备ID
   * @param {string} groupId - 分组ID
   * @param {string} action - 操作类型 (add/remove)
   */
  recordChange(deviceId, groupId, action) {
    const key = `${deviceId}_${groupId}`
    this.pendingChanges.value.set(key, {
      deviceId,
      groupId,
      action,
      timestamp: Date.now(),
      version: ++this.syncVersion.value
    })
    console.log('[SyncManager] 记录变更:', key, action)
  }

  /**
   * 获取增量变更
   */
  getIncrementalChanges() {
    return Array.from(this.pendingChanges.value.values())
  }

  /**
   * 清除已同步的变更
   * @param {Array} syncedKeys - 已同步的 key 数组
   */
  clearSyncedChanges(syncedKeys) {
    syncedKeys.forEach(key => {
      this.pendingChanges.value.delete(key)
    })
  }

  /**
   * 加入分组房间
   * @param {string} socket - Socket 实例
   * @param {string} groupId - 分组ID
   */
  joinRoom(socket, groupId) {
    if (!this.subscribedRooms.value.has(groupId)) {
      socket.emit('join:group', groupId)
      this.subscribedRooms.value.add(groupId)
      console.log('[SyncManager] 加入房间:', groupId)
    }
  }

  /**
   * 离开分组房间
   * @param {string} socket - Socket 实例
   * @param {string} groupId - 分组ID
   */
  leaveRoom(socket, groupId) {
    if (this.subscribedRooms.value.has(groupId)) {
      socket.emit('leave:group', groupId)
      this.subscribedRooms.value.delete(groupId)
      console.log('[SyncManager] 离开房间:', groupId)
    }
  }

  /**
   * 获取订阅状态
   */
  getSubscribedRooms() {
    return Array.from(this.subscribedRooms.value)
  }

  /**
   * 更新最后同步时间
   */
  updateLastSyncTime() {
    this.lastSyncTime.value = Date.now()
    localStorage.setItem('mseism_last_sync', this.lastSyncTime.value)
  }

  /**
   * 获取同步统计
   */
  getSyncStats() {
    return {
      isOnline: this.isOnline.value,
      lastSyncTime: this.lastSyncTime.value,
      isSyncing: this.isSyncing.value,
      offlineQueueLength: this.offlineQueue.value.length,
      pendingChangesCount: this.pendingChanges.value.size,
      subscribedRoomsCount: this.subscribedRooms.value.size,
      conflictCount: this.conflictLog.value.length
    }
  }
}

// 单例模式
let instance = null

export function useSyncManager() {
  if (!instance) {
    instance = new SyncManager()
  }
  return instance
}

export default useSyncManager
