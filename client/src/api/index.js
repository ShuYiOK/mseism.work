/**
 * API 请求模块 - 带重试机制和认证
 */
import axios from 'axios'
import performanceMonitor from '../utils/performance'

// 默认配置
const DEFAULT_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  retryCondition: (error) => {
    // 默认重试条件：网络错误或 5xx 错误
    return !error.response || (error.response.status >= 500)
  }
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

        // 检查是否需要重试
        const shouldRetry = config.metadata.retryCount < this.config.retries &&
                           this.config.retryCondition(error)

        if (shouldRetry) {
          config.metadata.retryCount++

          const delay = this.config.retryDelay * Math.pow(2, config.metadata.retryCount - 1)

          // 显示重试提示
          if (window.toast?.warning) {
            window.toast.warning(`正在重试请求 (${config.metadata.retryCount}/${this.config.retries})...`, {
              title: '请求失败',
              duration: 2000
            })
          }

          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, delay))

          return this.instance(config)
        }

        // 达到最大重试次数或不满足重试条件
        if (window.toast?.error && !error.config?.skipErrorNotification) {
          const errorMessage = error.response?.data?.error || error.message || '请求失败'

          if (error.response?.status === 401) {
            // 401 错误已在上面的拦截器中处理
            console.warn('[API] 认证失败，已清除本地认证信息')
          } else if (error.response?.status === 403) {
            window.toast.error('没有权限访问此资源', {
              title: '权限不足'
            })
          } else if (error.response?.status === 404) {
            window.toast.error('请求的资源不存在', {
              title: '未找到'
            })
          } else if (error.response?.status === 429) {
            window.toast.error('请求过于频繁，请稍后再试', {
              title: '请求受限'
            })
          } else if (error.code === 'ECONNABORTED') {
            window.toast.error('请求超时，请检查网络连接', {
              title: '超时'
            })
          } else if (error.code === 'ERR_NETWORK') {
            window.toast.error('网络错误，请检查网络连接', {
              title: '网络错误'
            })
          } else {
            window.toast.error(errorMessage, {
              title: '请求失败'
            })
          }
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
  getAll: (config) => api.get('http://localhost:3001/api/groups', config),
  getById: (id, config) => api.get(`http://localhost:3001/api/groups/${id}`, config),
  getDevices: (id, config) => api.get(`http://localhost:3001/api/groups/${id}/devices`, config),
  create: (data, config) => api.post('http://localhost:3001/api/groups', data, config),
  update: (id, data, config) => api.put(`http://localhost:3001/api/groups/${id}`, data, config),
  delete: (id, config) => api.delete(`http://localhost:3001/api/groups/${id}`, config),
  addDevice: (groupId, deviceId, config) =>
    api.post(`http://localhost:3001/api/groups/${groupId}/devices`, { deviceId }, config),
  removeDevice: (groupId, deviceId, config) =>
    api.delete(`http://localhost:3001/api/groups/${groupId}/devices/${deviceId}`, config),

  // 批量查询
  getGroupsByIds: (groupIds, config) =>
    api.post('http://localhost:3001/api/groups/batch', { groupIds }, config),
  getAllWithDevices: (config) =>
    api.get('http://localhost:3001/api/groups-with-devices', config),
  getStats: (config) =>
    api.get('http://localhost:3001/api/groups/stats', config)
}

// 批量查询相关 API
export const batchApi = {
  getDevicesByIds: (deviceIds, config) =>
    api.post('http://localhost:3001/api/devices/batch', { deviceIds }, config),
  getGroupsByIds: (groupIds, config) =>
    api.post('http://localhost:3001/api/groups/batch', { groupIds }, config),
  getAllGroupsWithDevices: (config) =>
    api.get('http://localhost:3001/api/groups-with-devices', config),
  getAllDevicesWithGroups: (config) =>
    api.get('http://localhost:3001/api/devices-with-groups', config),
  getDeviceGroupMappings: (config) =>
    api.get('http://localhost:3001/api/device-group-mappings', config),
  getOnlineDevices: (limit, config) =>
    api.get(`http://localhost:3001/api/devices/online${limit ? '?limit=' + limit : ''}`, config),
  getOfflineDevices: (limit, config) =>
    api.get(`http://localhost:3001/api/devices/offline${limit ? '?limit=' + limit : ''}`, config),
  getDevicesByStatus: (status, limit, config) =>
    api.get(`http://localhost:3001/api/devices/status/${status}${limit ? '?limit=' + limit : ''}`, config)
}

// 同步相关 API
export const syncApi = {
  getStatus: (config) => api.get('http://localhost:3001/api/sync/status', config),
  trigger: (config) => api.post('http://localhost:3001/api/sync/trigger', {}, config)
}

// 性能监控相关 API
export const performanceApi = {
  getStats: (config) => api.get('http://localhost:3001/api/performance/stats', config),
  reset: (config) => api.post('http://localhost:3001/api/performance/reset', {}, config)
}

// 日志相关 API
export const logApi = {
  getErrors: (limit = 100, config) => api.get(`http://localhost:3001/api/logs/errors?limit=${limit}`, config),
  getAccess: (limit = 100, config) => api.get(`http://localhost:3001/api/logs/access?limit=${limit}`, config),
  getOperations: (options = {}, config) => {
    const params = new URLSearchParams()
    if (options.type) params.append('type', options.type)
    if (options.level) params.append('level', options.level)
    if (options.userId) params.append('userId', options.userId)
    if (options.limit) params.append('limit', options.limit)
    if (options.offset) params.append('offset', options.offset)
    if (options.startTime) params.append('startTime', options.startTime)
    if (options.endTime) params.append('endTime', options.endTime)

    return api.get(`http://localhost:3001/api/logs/operations?${params.toString()}`, config)
  },
  getStats: (config) => api.get('http://localhost:3001/api/logs/stats', config)
}

// 导出所有 API 模块
export default api
