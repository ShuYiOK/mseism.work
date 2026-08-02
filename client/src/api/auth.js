/**
 * 认证相关 API
 */
import api from './index'

export const authApi = {
  // 注册
  register: (data) => api.post('/auth/register', data),
  
  // 登录
  login: (data) => api.post('/auth/login', data),
  
  // 登出（服务端读取 refresh_token，前端需对齐字段名）
  logout: (refreshToken) => api.post('/auth/logout', { refresh_token: refreshToken }),

  // 刷新token（服务端读取 refresh_token，前端需对齐字段名）
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
  
  // 撤销所有token
  revokeAll: () => api.post('/auth/revoke-all', {}, { skipErrorNotification: true }),
  
  // 获取当前用户信息
  getMe: () => api.get('/auth/me'),
  
  // 修改密码
  changePassword: (data) => api.post('/auth/change-password', data),
  
  // 管理员：获取所有用户
  getAllUsers: () => api.get('/auth/users'),
  
  // 管理员：获取指定用户
  getUserById: (id) => api.get(`/auth/users/${id}`),
  
  // 管理员：更新用户
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
  
  // 确理员：重置用户密码
  resetPassword: (id, data) => api.post(`/auth/users/${id}/reset-password`, data),
  
  // 管理员：删除用户
  deleteUser: (id) => api.delete(`/auth/users/${id}`),
  
  // 管理员：获取审计日志
  getAuditLogs: (limit, userId) => api.get(`/auth/audit-logs?limit=${limit}${userId ? '&userId=' + userId : ''}`),
  
  // 管理员：清理过期token
  cleanupTokens: () => api.post('/auth/cleanup-tokens', {})
}

export default authApi
