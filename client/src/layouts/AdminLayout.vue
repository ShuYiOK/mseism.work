<template>
  <div class="admin-layout">
    <!-- 移动端遮罩层 -->
    <div
      v-if="isMobile && sidebarCollapsed === false"
      class="sidebar-overlay"
      @click="toggleSidebar"
    ></div>

    <!-- 侧边栏 -->
    <aside
      class="admin-sidebar"
      :class="{ 
        'sidebar-collapsed': isMobile && sidebarCollapsed,
        'sidebar-expanded': isMobile && !sidebarCollapsed
      }"
    >
      <!-- 切换按钮 -->
      <button
        class="sidebar-toggle"
        @click="toggleSidebar"
        :aria-label="sidebarCollapsed ? '展开菜单' : '收起菜单'"
      >
        {{ sidebarCollapsed ? '☰' : '✕' }}
      </button>

      <div class="sidebar-header">
        <h2>🔧 管理后台</h2>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
          :title="item.title"
          @click="isMobile ? toggleSidebar() : null"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-text">{{ item.title }}</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button @click="handleLogout" class="logout-btn">
          <span>🚪</span> 退出登录
        </button>
        <router-link to="/" class="back-link">
          <span>←</span> 返回前台
        </router-link>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main
      class="admin-main"
      :class="{ 'main-collapsed': isMobile }"
    >
      <!-- 面包屑 -->
      <div class="breadcrumb">
        <span>管理后台</span>
        <span class="separator">/</span>
        <span class="current">{{ currentPageTitle }}</span>
      </div>

      <!-- 路由视图 -->
      <div class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { debounceResize } from '../utils/performance'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const MOBILE_BREAKPOINT = 768
const isMobile = ref(false)
const sidebarCollapsed = ref(true) // 移动端默认收起

const menuItems = [
  { path: '/admin', title: '仪表盘', icon: '📊' },
  { path: '/admin/groups', title: '分组管理', icon: '📁' },
  { path: '/admin/performance', title: '系统监控', icon: '📈' },
  { path: '/admin/config', title: '系统配置', icon: '⚙️' },
]

const currentPageTitle = computed(() => {
  const item = menuItems.find(i => route.path.startsWith(i.path))
  return item?.title || '管理后台'
})

const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const resizeTimeout = ref(null)

const handleResize = debounceResize(() => {
  const newIsMobile = window.innerWidth <= MOBILE_BREAKPOINT
  if (isMobile.value !== newIsMobile) {
    isMobile.value = newIsMobile
    if (!isMobile.value) {
      sidebarCollapsed.value = false
    } else {
      sidebarCollapsed.value = true
    }
  }
})

const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    sessionStorage.removeItem('adminAuthenticated')
    sessionStorage.removeItem('adminAuthTime')
    authStore.clearAuth()
    router.push('/login')
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize, { passive: true })
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize, { passive: true })
  if (resizeTimeout) {
    cancelAnimationFrame(resizeTimeout)
  }
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
}

/* 移动端遮罩层 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

/* 侧边栏 */
.admin-sidebar {
  width: 240px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  contain: layout style;
  will-change: transform, width;
}

/* 移动端收起状态 - 抽屉式滑出 */
.admin-sidebar.sidebar-collapsed {
  transform: translateX(-100%);
  width: 72px;
}

/* 移动端展开状态 - 抽屉式滑入 */
.admin-sidebar.sidebar-expanded {
  transform: translateX(0);
  width: 240px;
}

/* 桌面端侧边栏显示 */
@media (min-width: 769px) {
  .admin-sidebar {
    transform: translateX(0);
  }
}

/* 切换按钮 */
.sidebar-toggle {
  position: absolute;
  top: 50%;
  right: -20px;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 101;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, box-shadow;
}

.sidebar-toggle:hover {
  background: linear-gradient(180deg, #5568d3 0%, #6a4190 100%);
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.sidebar-toggle:active {
  transform: translateY(-50%) scale(0.95);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-collapsed .sidebar-header {
  padding: 20px 10px;
  text-align: center;
}

.sidebar-collapsed .sidebar-header h2,
.sidebar-collapsed .nav-text,
.sidebar-collapsed .logout-btn span:last-child,
.sidebar-collapsed .back-link span:last-child {
  display: none;
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  gap: 12px;
  min-height: 48px;
}

/* 收起状态下的导航项 */
.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 14px;
  gap: 0;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.95);
  color: #667eea;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.nav-icon {
  font-size: 24px;
  width: 28px;
  height: 28px;
  text-align: center;
  flex-shrink: 0;
}

.sidebar-collapsed .nav-icon {
  width: 28px;
  height: 28px;
}

.nav-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  padding: 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-collapsed .sidebar-footer {
  padding: 12px 8px;
}

.logout-btn,
.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.9em;
  transition: all 0.3s ease;
  min-height: 44px;
}

.sidebar-collapsed .logout-btn,
.sidebar-collapsed .back-link {
  padding: 12px;
  gap: 0;
}

.logout-btn {
  background: rgba(244, 67, 54, 0.9);
  color: white;
}

.logout-btn:hover {
  background: #d32f2f;
}

.back-link {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.back-link:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* 主内容区 */
.admin-main {
  flex: 1;
  margin-left: 240px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: margin-left;
}

.admin-main.main-collapsed {
  margin-left: 72px;
}

.breadcrumb {
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  font-size: 0.9em;
  color: #666;
}

.breadcrumb .separator {
  margin: 0 8px;
  color: #ccc;
}

.breadcrumb .current {
  color: #667eea;
  font-weight: 600;
}

.admin-content {
  flex: 1;
  padding: 24px;
  max-width: 1400px;
  width: 100%;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 响应式布局 - 桌面端（1200px+） */
@media (min-width: 1200px) {
  .admin-content {
    max-width: 1400px;
  }
}

/* 响应式布局 - 中型平板（992px-1199px） */
@media (max-width: 1199px) and (min-width: 992px) {
  .admin-sidebar {
    width: 200px;
  }
  
  .admin-main {
    margin-left: 200px;
  }
  
  .admin-content {
    max-width: 1100px;
  }
  
  .sidebar-header h2 {
    font-size: 1.1em;
  }
}

/* 响应式布局 - 平板（768px-991px） */
@media (max-width: 991px) and (min-width: 768px) {
  .admin-sidebar {
    width: 180px;
  }
  
  .admin-main {
    margin-left: 180px;
  }
  
  .admin-content {
    max-width: 900px;
  }
  
  .sidebar-header h2 {
    font-size: 1em;
  }
  
  .nav-item {
    padding: 12px 14px;
  }
}

/* 响应式布局 - 移动端（480px-767px） */
@media (max-width: 768px) {
  .admin-sidebar {
    transform: translateX(-100%);
    width: 280px;
  }

  .admin-sidebar.sidebar-expanded {
    transform: translateX(0);
    width: 280px;
  }

  .admin-main {
    margin-left: 0;
  }

  .sidebar-header h2 {
    font-size: 0;
  }

  .logout-btn span:last-child,
  .back-link span:last-child {
    display: none;
  }
  
  .admin-content {
    max-width: 100%;
  }
}

/* 响应式布局 - 小屏幕（360px-479px） */
@media (max-width: 480px) {
  .admin-sidebar {
    transform: translateX(-100%);
    width: 260px;
  }

  .admin-sidebar.sidebar-expanded {
    transform: translateX(0);
    width: 260px;
  }

  .admin-main {
    margin-left: 0;
  }

  .nav-item {
    padding: 10px 8px;
    min-height: 44px;
    margin-bottom: 6px;
  }

  .nav-icon {
    font-size: 22px;
    width: 28px;
    height: 28px;
  }

  .sidebar-toggle {
    width: 28px;
    height: 28px;
    right: -14px;
    font-size: 12px;
  }

  .sidebar-header {
    padding: 16px 8px;
  }

  .sidebar-collapsed .sidebar-footer {
    padding: 8px 4px;
  }

  .breadcrumb {
    padding: 10px 12px;
    font-size: 0.8em;
  }

  .admin-content {
    padding: 12px;
  }
}

/* 响应式布局 - 极小屏幕（360px以下） */
@media (max-width: 360px) {
  .admin-sidebar {
    transform: translateX(-100%);
    width: 240px;
  }

  .admin-sidebar.sidebar-expanded {
    transform: translateX(0);
    width: 240px;
  }

  .admin-main {
    margin-left: 0;
  }

  .nav-item {
    padding: 10px 6px;
    min-height: 46px;
    border-radius: 8px;
  }

  .nav-icon {
    font-size: 20px;
    width: 26px;
    height: 26px;
  }

  .sidebar-toggle {
    width: 26px;
    height: 26px;
    right: -13px;
    font-size: 11px;
  }

  .sidebar-header {
    padding: 12px 6px;
  }

  .sidebar-nav {
    padding: 12px 6px;
  }

  .logout-btn,
  .back-link {
    padding: 10px 6px;
    min-height: 40px;
  }

  .breadcrumb {
    padding: 8px 10px;
    font-size: 0.75em;
  }

  .admin-content {
    padding: 10px;
  }
}
</style>
