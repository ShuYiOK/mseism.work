<template>
  <div class="app-container">
    <!-- 全局骨架屏加载 -->
    <div v-if="appLoading" class="app-skeleton-overlay">
      <div class="app-skeleton-content">
        <div class="app-skeleton-logo"></div>
        <Skeleton type="text" :count="3" :container-style="{ maxWidth: '300px', margin: '20px auto' }" />
        <p class="app-skeleton-text">正在加载应用...</p>
      </div>
    </div>

    <ErrorBoundary>
      <router-view v-show="!appLoading" :key="$route.path" v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </ErrorBoundary>
    <Toast ref="toastRef" />
    <BottomNav v-show="!appLoading" />
  </div>
</template>

<script setup>
import { ref, onMounted, provide } from 'vue'
import socketService from './utils/socket'
import { setupWebSocketIntegration } from './utils/websocket-integration'
import { useAuthStore } from './stores/auth'
import ErrorBoundary from './components/ErrorBoundary.vue'
import Toast from './components/Toast.vue'
import Skeleton from './components/Skeleton.vue'
import BottomNav from './components/BottomNav.vue'

const authStore = useAuthStore()
const toastRef = ref(null)
const appLoading = ref(true)

// 提供全局加载状态控制方法给子组件
const setAppLoading = (loading) => {
  appLoading.value = loading
}

provide('setAppLoading', setAppLoading)

onMounted(() => {
  // 初始化认证状态
  authStore.initializeAuth()

  // 启动自动刷新 token（如果已登录）
  if (authStore.isAuthenticated) {
    authStore.startAutoRefresh()
  }

  // 监听 401 错误事件
  window.addEventListener('auth:unauthorized', () => {
    authStore.clearAuth()
  })

  // 连接 WebSocket
  socketService.connect()

  // 设置 WebSocket 事件集成到 Pinia store
  setupWebSocketIntegration(socketService)

  // 模拟最短加载时间，确保骨架屏动画至少显示 500ms
  setTimeout(() => {
    appLoading.value = false
  }, 500)
})
</script>

<style>
/* 全局样式 */
:root {
  --primary-color: #5a6fd8;
  --secondary-color: #6a4492;
  --success-color: #388e3c;
  --danger-color: #d32f2f;
  --warning-color: #f57c00;
  --info-color: #1976d2;
  --card-bg: rgba(255, 255, 255, 0.95);
  --border-color: rgba(90, 111, 216, 0.3);
  --text-primary: #212121;
  --text-secondary: #424242;
  --text-light: #ffffff;
  --text-dark: #000000;
  --bg-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --bg-secondary: #f5f7fa;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.12);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.15);
  --accessible-success: #388e3c;
  --accessible-danger: #d32f2f;
  --accessible-warning: #f57c00;
  --accessible-info: #1976d2;
}

[data-theme="dark"] {
  --primary-color: #7a8ff8;
  --secondary-color: #9c6bc4;
  --success-color: #66bb6a;
  --danger-color: #ef5350;
  --warning-color: #ffb74d;
  --info-color: #42a5f5;
  --card-bg: rgba(42, 42, 62, 0.95);
  --border-color: rgba(122, 143, 248, 0.3);
  --text-primary: #e0e0e0;
  --text-secondary: #aaaaaa;
  --text-light: #1e1e2f;
  --text-dark: #ffffff;
  --bg-primary: linear-gradient(135deg, #4a5bc7 0%, #5a3d8a 100%);
  --bg-secondary: #1e1e2f;
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
  --accessible-success: #66bb6a;
  --accessible-danger: #ef5350;
  --accessible-warning: #ffb74d;
  --accessible-info: #42a5f5;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --primary-color: #7a8ff8;
    --secondary-color: #9c6bc4;
    --success-color: #66bb6a;
    --danger-color: #ef5350;
    --warning-color: #ffb74d;
    --info-color: #42a5f5;
    --card-bg: rgba(42, 42, 62, 0.95);
    --border-color: rgba(122, 143, 248, 0.3);
    --text-primary: #e0e0e0;
    --text-secondary: #aaaaaa;
    --text-light: #1e1e2f;
    --text-dark: #ffffff;
    --bg-primary: linear-gradient(135deg, #4a5bc7 0%, #5a3d8a 100%);
    --bg-secondary: #1e1e2f;
    --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.5);
    --accessible-success: #66bb6a;
    --accessible-danger: #ef5350;
    --accessible-warning: #ffb74d;
    --accessible-info: #42a5f5;
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: var(--bg-primary);
  min-height: 100vh;
  color: var(--text-primary);
}

.app-container {
  min-height: 100vh;
  position: relative;
  max-width: 100%;
  background: var(--bg-secondary);
}

/* 大屏幕容器限制 */
@media (min-width: 1200px) {
  .app-container {
    max-width: 1400px;
    margin: 0 auto;
  }
}

/* 中型屏幕容器限制 */
@media (min-width: 992px) and (max-width: 1199px) {
  .app-container {
    max-width: 1100px;
    margin: 0 auto;
  }
}

/* 平板屏幕容器限制 */
@media (min-width: 768px) and (max-width: 991px) {
  .app-container {
    max-width: 900px;
    margin: 0 auto;
  }
}

/* 全局骨架屏覆盖层 */
.app-skeleton-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.app-skeleton-content {
  text-align: center;
  padding: 40px;
  max-width: 400px;
  width: 90%;
}

.app-skeleton-logo {
  width: 100px;
  height: 100px;
  border-radius: 24px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  margin: 0 auto 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.app-skeleton-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1em;
  margin-top: 30px;
  font-weight: 500;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .app-skeleton-content {
    padding: 30px;
  }

  .app-skeleton-logo {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    margin-bottom: 20px;
  }

  .app-skeleton-text {
    font-size: 1em;
    margin-top: 20px;
  }
}

@media (max-width: 480px) {
  .app-skeleton-content {
    padding: 20px;
  }

  .app-skeleton-logo {
    width: 60px;
    height: 60px;
    border-radius: 16px;
    margin-bottom: 15px;
  }

  .app-skeleton-text {
    font-size: 0.9em;
    margin-top: 15px;
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 页面过渡动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
