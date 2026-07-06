/**
 * API 请求模块 - 带重试机制和认证
 */
import axios from 'axios'
import performanceMonitor from '../utils/performance'

// 错误类型枚举
const ErrorType = {
  NETWORK: 'NETWORK',
  TIMEOUT: 'TIMEOUT',
  AUTH: 'AUTH',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN'
}

// 统一错误类
class ApiError extends Error {
  constructor(message, type, status, originalError = null) {
    super(message)
    this.name = 'ApiError'
    this.type = type
    this.status = status
    this.originalError = originalError
  }
}

// 默认配置
const DEFAULT_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  retryCondition: (error) => {
    if (error.config?._retry) return false
    if (!error.response) return true
    if (error.response.status >= 500) return true
    if (error.response.status === 429) return true
    return false
  }
}

// 错误类型判断辅助函数
function getErrorType(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return ErrorType.TIMEOUT
    }
    if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
      return ErrorType.NETWORK
    }
    return ErrorType.UNKNOWN
  }

  switch (error.response.status) {
    case 401: return ErrorType.AUTH
    case 403: return ErrorType.FORBIDDEN
    case 404: return ErrorType.NOT_FOUND
    case 429: return ErrorType.RATE_LIMIT
    default:
      if (error.response.status >= 500) return ErrorType.SERVER
      return ErrorType.UNKNOWN
  }
}

// 获取友好的错误消息
function getFriendlyErrorMessage(error) {
  const type = getErrorType(error)
  const messages = {
    [ErrorType.NETWORK]: { title: '网络错误', message: '网络连接失败，请检查网络设置' },
    [ErrorType.TIMEOUT]: { title: '请求超时', message: '请求超时，请稍后重试' },
    [ErrorType.AUTH]: { title: '认证失败', message: '登录已过期，请重新登录' },
    [ErrorType.FORBIDDEN]: { title: '权限不足', message: '您没有权限执行此操作' },
    [ErrorType.NOT_FOUND]: { title: '未找到', message: '请求的资源不存在' },
    [ErrorType.RATE_LIMIT]: { title: '请求受限', message: '请求过于频繁，请稍后再试' },
    [ErrorType.SERVER]: { title: '服务器错误', message: '服务器处理失败，请稍后重试' },
    [ErrorType.UNKNOWN]: { title: '请求失败', message: error.response?.data?.error || error.message || '未知错误' }
  }
  return messages[type] || messages[ErrorType.UNKNOWN]
}

class ApiClient {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.instance = this.createInstance()
    this.setupInterceptors()
  }

  createInstance() {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout
    })
  }

  setupInterceptors() {
    // 请求拦截器 - 添加认证 token
    this.instance.interceptors.request.use(
      (config) => {
        config.metadata = {
          startTime: Date.now(),
          retryCount: 0
        }

        // 添加认证 token（如果存在）
        const token = localStorage.getItem('accessToken')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime

        // 记录性能
        performanceMonitor.recordApiRequest(
          response.config.url,
          response.config.method,
          duration,
          true,
          response.status
        )

        return response
      },
      async (error) => {
        const config = error.config

        if (!config || !config.metadata) {
          return Promise.reject(error)
        }

        // 记录性能
        const duration = Date.now() - config.metadata.startTime
        performanceMonitor.recordApiRequest(
          config.url,
          config.method,
          duration,
          false,
          error.response?.status || 500
        )

        // 401 未授权错误处理
        if (error.response?.status === 401) {
          // 清除过期的认证信息
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')

          // 触发 401 错误事件
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))

          // 直接返回错误，不重试
          return Promise.reject(error)
        }

        // 标记为已重试，防止无限重试
        config._retry = true

        // 检查是否需要重试
        const shouldRetry = config.metadata.retryCount < this.config.retries &&
                           this.config.retryCondition(error)

        if (shouldRetry) {
          config.metadata.retryCount++

          const delay = this.config.retryDelay * Math.pow(2, config.metadata.retryCount - 1)
          console.log(`[API] 请求失败，将在 ${delay}ms 后重试 (${config.metadata.retryCount}/${this.config.retries})`)

          await new Promise(resolve => setTimeout(resolve, delay))

          return this.instance(config)
        }

        // 达到最大重试次数或不满足重试条件，抛出统一错误
        if (!error.config?.skipErrorNotification) {
          const errorInfo = getFriendlyErrorMessage(error)
          const apiError = new ApiError(
            errorInfo.message,
            getErrorType(error),
            error.response?.status,
            error
          )

          if (window.toast?.error) {
            window.toast.error(errorInfo.message, { title: errorInfo.title })
          }

          return Promise.reject(apiError)
        }

        return Promise.reject(error)
      }
    )
  }

  // 基础请求方法
  async request(config) {
    return this.instance(config)
  }

  async get(url, config) {
    return this.instance.get(url, config)
  }

  async post(url, data, config) {
    return this.instance.post(url, data, config)
  }

  async put(url, data, config) {
    return this.instance.put(url, data, config)
  }

  async delete(url, config) {
    return this.instance.delete(url, config)
  }

  // 跳过错误通知的请求
  async requestSilent(config) {
    return this.instance({ ...config, skipErrorNotification: true })
  }
}

// 创建默认 API 客户端
const api = new ApiClient()

// 设备相关 API
export const deviceApi = {
  getAll: (config) => api.get('/devices', config),
  getById: (id, config) => api.get(`/devices/${id}`, config),
  getStats: (config) => api.get('/devices/stats', config),
  report: (data, config) => api.post('/devices/report', data, config),
  batchReport: (devices, config) => api.post('/devices/batch', devices, config),
  delete: (id, config) => api.delete(`/devices/${id}`, config),
  getGroups: (id, config) => api.get(`/devices/${id}/groups`, config)
}

// 分组相关 API
export const groupApi = {
  getAll: (config) => api.get('/groups', config),
  getById: (id, config) => api.get(`/groups/${id}`, config),
  getDevices: (id, config) => api.get(`/groups/${id}/devices`, config),
  create: (data, config) => api.post('/groups', data, config),
  update: (id, data, config) => api.put(`/groups/${id}`, data, config),
  delete: (id, config) => api.delete(`/groups/${id}`, config),
  addDevice: (groupId, deviceId, config) =>
    api.post(`/groups/${groupId}/devices`, { deviceId }, config),
  removeDevice: (groupId, deviceId, config) =>
    api.delete(`/groups/${groupId}/devices/${deviceId}`, config),
  getAvailableDevices: (groupId, config) =>
    api.get(`/groups/${groupId}/available-devices`, config),

  // 批量查询
  getGroupsByIds: (groupIds, config) =>
    api.post('/groups/batch', { groupIds }, config),
  getAllWithDevices: (config) =>
    api.get('/groups/with-devices', config),
  getStats: (config) =>
    api.get('/groups/stats', config)
}

// 批量查询相关 API
export const batchApi = {
  getDevicesByIds: (deviceIds, config) =>
    api.post('/devices/batch', { deviceIds }, config),
  getGroupsByIds: (groupIds, config) =>
    api.post('/groups/batch', { groupIds }, config),
  getAllGroupsWithDevices: (config) =>
    api.get('/groups/with-devices', config),
  getAllDevicesWithGroups: (config) =>
    api.get('/devices/with-groups', config),
  getDeviceGroupMappings: (config) =>
    api.get('/groups/mappings', config),
  getOnlineDevices: (limit, config) =>
    api.get(`/devices/online${limit ? '?limit=' + limit : ''}`, config),
  getOfflineDevices: (limit, config) =>
    api.get(`/devices/offline${limit ? '?limit=' + limit : ''}`, config),
  getDevicesByStatus: (status, limit, config) =>
    api.get(`/devices/status/${status}${limit ? '?limit=' + limit : ''}`, config)
}

// 同步相关 API
export const syncApi = {
  getStatus: (config) => api.get('/sync/status', config),
  trigger: (config) => api.post('/sync/trigger', {}, config)
}

// 性能监控相关 API
export const performanceApi = {
  getStats: (config) => api.get('/performance/stats', config),
  reset: (config) => api.post('/performance/reset', {}, config)
}

// 设备异常监控 API
export const anomalyApi = {
  getAnomalousDevices: (config) => api.get('/anomalies', config),
  getDeviceAnomalyDetails: (deviceId, config) => api.get(`/anomalies/${encodeURIComponent(deviceId)}`, config),
  getStatusHistory: (deviceId, hours = 24, config) => api.get(`/anomalies/${encodeURIComponent(deviceId)}/status-history?hours=${hours}`, config),
  getCoordinateHistory: (deviceId, hours = 24, config) => api.get(`/anomalies/${encodeURIComponent(deviceId)}/coordinate-history?hours=${hours}`, config),
  triggerDetection: (config) => api.post('/anomalies/detect', {}, config)
}

// 日志相关 API
export const logApi = {
  getErrors: (limit = 100, config) => api.get(`/logs/errors?limit=${limit}`, config),
  getAccess: (limit = 100, config) => api.get(`/logs/access?limit=${limit}`, config),
  getOperations: (options = {}, config) => {
    const params = new URLSearchParams()
    if (options.type) params.append('type', options.type)
    if (options.level) params.append('level', options.level)
    if (options.userId) params.append('userId', options.userId)
    if (options.limit) params.append('limit', options.limit)
    if (options.offset) params.append('offset', options.offset)
    if (options.startTime) params.append('startTime', options.startTime)
    if (options.endTime) params.append('endTime', options.endTime)

    return api.get(`/logs/operations?${params.toString()}`, config)
  },
  getStats: (config) => api.get('/logs/stats', config)
}

// 导出所有 API 模块
export default api
