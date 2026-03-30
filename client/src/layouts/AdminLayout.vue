<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="admin-sidebar">
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
    <main class="admin-main">
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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 菜单配置（可扩展）
const menuItems = [
  { path: '/admin', title: '仪表盘', icon: '📊' },
  { path: '/admin/groups', title: '分组管理', icon: '📁' },
  { path: '/admin/performance', title: '系统监控', icon: '📈' },
  { path: '/admin/config', title: '系统配置', icon: '⚙️' },
]

// 当前页面标题
const currentPageTitle = computed(() => {
  const item = menuItems.find(i => route.path.startsWith(i.path))
  return item?.title || '管理后台'
})

// 判断是否激活
const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}

// 退出登录
const handleLogout = () => {
  if (confirm('确定要退出登录吗？')) {
    sessionStorage.removeItem('adminAuthenticated')
    sessionStorage.removeItem('adminAuthTime')
    authStore.clearAuth()
    router.push('/login')
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f7fa;
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
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 1.3em;
  font-weight: 600;
}

.sidebar-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  border-radius: 10px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  gap: 12px;
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
  font-size: 1.2em;
  width: 24px;
  text-align: center;
}

.nav-text {
  flex: 1;
}

.sidebar-footer {
  padding: 16px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.logout-btn,
.back-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  font-size: 0.9em;
  transition: all 0.3s ease;
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

/* 响应式 */
@media (max-width: 768px) {
  .admin-sidebar {
    width: 100%;
    position: relative;
    height: auto;
  }

  .admin-main {
    margin-left: 0;
  }

  .sidebar-footer {
    flex-direction: row;
  }

  .logout-btn,
  .back-link {
    flex: 1;
  }
}
</style>
