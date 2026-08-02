/**
 * 认证状态管理 Store
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  // 状态
  const user = ref(null)
  const accessToken = ref(null)
  const refreshToken = ref(null)
  const loading = ref(false)
  const error = ref('')

  // 计算属性
  const isAuthenticated = computed(() => !!user.value && !!accessToken.value)

  // 是否为超级管理员（root，最高权限）
  const isSuperAdmin = computed(() => user.value?.role === 'root')

  // 是否可进入后台（root 或 admin）
  const isAdmin = computed(() => user.value?.role === 'root' || user.value?.role === 'admin')

  const permissions = computed(() => user.value?.permissions || [])

  const hasPermission = computed(() => {
    return (permission) => permissions.value.includes(permission)
  })

  const hasRole = computed(() => {
    return (role) => user.value?.role === role
  })

  // 判断当前用户能否访问指定后台页面
  // root 可访问全部；admin 仅可访问仪表盘与分组管理
  const canAccessPage = computed(() => {
    return (path) => {
      if (!user.value) return false
      if (user.value.role === 'root') return true
      if (user.value.role === 'admin') {
        // /admin（仪表盘）与 /admin/groups（分组管理）允许
        return path === '/admin' || path === '/admin/groups'
      }
      return false
    }
  })

  // 初始化：从localStorage恢复认证信息
  const initializeAuth = () => {
    try {
      const savedToken = localStorage.getItem('accessToken')
      const savedRefreshToken = localStorage.getItem('refreshToken')
      const savedUser = localStorage.getItem('user')

      if (savedToken && savedUser && savedRefreshToken) {
        accessToken.value = savedToken
        refreshToken.value = savedRefreshToken
        user.value = JSON.parse(savedUser)
      }
    } catch (error) {
      console.error('恢复认证信息失败:', error)
      clearAuth()
    }
  }

  // 清除认证信息
  const clearAuth = () => {
    // 停止自动刷新定时器
    stopAutoRefresh()

    user.value = null
    accessToken.value = null
    refreshToken.value = null
    error.value = ''
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  }

  // 保存认证信息
  const saveAuth = (authData) => {
    // 处理不同的响应格式
    const tokens = authData.tokens || authData
    accessToken.value = tokens.accessToken || tokens.access_token
    refreshToken.value = tokens.refreshToken || tokens.refresh_token
    user.value = authData.user
    
    // 保存到localStorage
    localStorage.setItem('accessToken', accessToken.value)
    localStorage.setItem('refreshToken', refreshToken.value)
    localStorage.setItem('user', JSON.stringify(authData.user))
  }

  // 注册
  const register = async (username, email, password, role = 'user') => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.register({
        username,
        email,
        password,
        role
      })
      
      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.error || '注册失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 登录
  const login = async (username, password) => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.login({ username, password })
      
      if (response.data.success) {
        saveAuth(response.data.data)
        return response.data.data
      } else {
        throw new Error(response.data.error || '登录失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 登出
  const logout = async () => {
    try {
      error.value = ''
      
      await authApi.logout(refreshToken.value)
      
      clearAuth()
      
      if (window.toast) {
        window.toast.success('登出成功')
      }
    } catch (err) {
      // 即使登出失败，也清除本地认证信息
      clearAuth()
      
      if (window.toast) {
        window.toast.warning('已登出')
      }
    }
  }

  // 刷新访问token
  const refreshAccessToken = async () => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.refreshToken(refreshToken.value)
      
      if (response.data.success) {
        saveAuth({
          accessToken: response.data.data.accessToken,
          refreshToken: refreshToken.value,
          user: response.data.data.user
        })
        
        if (window.toast) {
          window.toast.info('会话已刷新')
        }
        
        return response.data.data
      } else {
        // 刷新失败，需要重新登录
        clearAuth()
        throw new Error(response.data.error || '会话已过期，请重新登录')
      }
    } catch (err) {
      error.value = err.message
      
      // token无效，清除认证信息
      clearAuth()
      
      throw err
    } finally {
      loading.value = false
    }
  }

  // 修改密码
  const changePassword = async (oldPassword, newPassword) => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.changePassword({
        oldPassword,
        newPassword
      })
      
      if (response.data.success) {
        if (window.toast) {
          window.toast.success('密码修改成功，请重新登录')
        }
        
        // 密码修改后需要重新登录
        clearAuth()
        
        return response.data
      } else {
        throw new Error(response.data.error || '密码修改失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 管理员：获取所有用户
  const getAllUsers = async () => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.getAllUsers()
      
      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.error || '获取用户列表失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 管理员：重置用户密码
  const resetPassword = async (userId, newPassword) => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.resetPassword(userId, { newPassword })
      
      if (response.data.success) {
        if (window.toast) {
          window.toast.success('密码重置成功')
        }
        return response.data
      } else {
        throw new Error(response.data.error || '密码重置失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 管理员：删除用户
  const deleteUser = async (userId) => {
    try {
      loading.value = true
      error.value = ''
      
      const response = await authApi.deleteUser(userId)
      
      if (response.data.success) {
        if (window.toast) {
          window.toast.success('用户删除成功')
        }
        return response.data
      } else {
        throw new Error(response.data.error || '用户删除失败')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // 检查权限
  const checkPermission = (permission) => {
    if (!isAuthenticated.value) {
      return false
    }
    return hasPermission.value(permission)
  }

  // 检查角色
  const checkRole = (role) => {
    if (!isAuthenticated.value) {
      return false
    }
    return hasRole.value(role)
  }

  // 自动刷新token（在接近过期时）
  let refreshTimer = null
  
  const startAutoRefresh = () => {
    // 清除现有定时器
    if (refreshTimer) {
      clearInterval(refreshTimer)
    }
    
    // 每5分钟检查一次token是否需要刷新
    refreshTimer = setInterval(() => {
      if (accessToken.value) {
        try {
          const payload = JSON.parse(atob(accessToken.value.split('.')[1]))
          const expiresAt = payload.exp * 1000
          const now = Date.now()
          
          // 在token过期前5分钟自动刷新
          if (expiresAt - now < 5 * 60 * 1000) {
            refreshAccessToken().catch(err => {
              console.error('自动刷新token失败:', err)
            })
          }
        } catch (err) {
          console.error('解析token失败:', err)
        }
      }
    }, 5 * 60 * 1000) // 每5分钟检查一次
  }

  const stopAutoRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  // 401错误处理（token过期）
  const handleAuthError = (error) => {
    if (error.response?.status === 401) {
      // token过期，尝试刷新
      refreshAccessToken().catch(() => {
        // 刷新失败，跳转到登录页
        clearAuth()
      })
    }
  }

  return {
    // 状态
    user,
    accessToken,
    refreshToken,
    loading,
    error,
    // 计算属性
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    permissions,
    hasPermission,
    hasRole,
    canAccessPage,
    // 方法
    initializeAuth,
    clearAuth,
    register,
    login,
    logout,
    refreshAccessToken,
    changePassword,
    getAllUsers,
    resetPassword,
    deleteUser,
    checkPermission,
    checkRole,
    startAutoRefresh,
    stopAutoRefresh,
    handleAuthError
  }
})
