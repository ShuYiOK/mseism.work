import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import DeviceList from '../views/DeviceList.vue'
import Login from '../views/Login.vue'
import AdminAuth from '../views/AdminAuth.vue'
import AdminLayout from '../layouts/AdminLayout.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AdminGroupManage from '../views/AdminGroupManage.vue'
import PerformanceMonitor from '../views/PerformanceMonitor.vue'
import ConfigManage from '../views/ConfigManage.vue'

const routes = [
  {
    path: '/',
    name: 'DeviceList',
    component: DeviceList
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/admin/auth',
    name: 'AdminAuth',
    component: AdminAuth
  },
  {
    path: '/admin',
    component: AdminLayout,
    children: [
      {
        path: '',
        name: 'AdminDashboard',
        component: AdminDashboard
      },
      {
        path: 'groups',
        name: 'AdminGroupManage',
        component: AdminGroupManage
      },
      {
        path: 'performance',
        name: 'PerformanceMonitor',
        component: PerformanceMonitor
      },
      {
        path: 'config',
        name: 'ConfigManage',
        component: ConfigManage
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 导航守卫 - 检查认证状态
router.beforeEach((to) => {
  // 公开页面：设备列表、登录页、管理认证页
  const publicPages = ['/', '/login', '/admin/auth']

  // 如果是管理页面但未登录，重定向到登录页
  if (to.path.startsWith('/admin') && !publicPages.includes(to.path)) {
    // 检查两种认证方式：
    // 1. authStore.isAuthenticated（JWT token 方式）
    // 2. sessionStorage.getItem('adminAuthenticated')(简单密码方式）
    const authStore = useAuthStore()
    const adminAuthenticated = sessionStorage.getItem('adminAuthenticated')
    const authTime = sessionStorage.getItem('adminAuthTime')

    if (!authStore.isAuthenticated && !adminAuthenticated) {
      return '/admin/auth'
    }

    // 检查会话是否过期（2 小时）
    const now = Date.now()
    const twoHours = 2 * 60 * 60 * 1000
    if (adminAuthenticated && authTime && (now - parseInt(authTime)) > twoHours) {
      // 会话过期，清除认证信息
      sessionStorage.removeItem('adminAuthenticated')
      sessionStorage.removeItem('adminAuthTime')
      return '/admin/auth'
    }
  }

  // 允许导航
  return true
})

export default router
