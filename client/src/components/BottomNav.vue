<template>
  <nav
    v-if="isAuthenticated"
    class="bottom-nav"
    role="navigation"
    aria-label="移动端主导航"
  >
    <router-link
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      class="bottom-nav-item touch-interactive"
      :class="{ active: isActive(item.path) }"
      :aria-current="isActive(item.path) ? 'page' : undefined"
      @click="handleNavClick(item)"
    >
      <span class="bottom-nav-icon">{{ item.icon }}</span>
      <span class="bottom-nav-text">{{ item.title }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)

const navItems = [
  { path: '/', title: '设备列表', icon: '📱' },
  { path: '/admin', title: '仪表盘', icon: '📊' },
  { path: '/admin/groups', title: '分组', icon: '📁' },
  { path: '/admin/config', title: '配置', icon: '⚙️' }
]

const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const handleNavClick = (item) => {
  if (navigator.vibrate) {
    navigator.vibrate(10)
  }
}
</script>

<style scoped>
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--bottom-nav-height);
  background: var(--card-bg);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  padding: 0;
  margin: 0;
  list-style: none;
  justify-content: space-around;
  align-items: center;
}

.bottom-nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 8px 4px;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--touch-color-transition);
  min-width: var(--touch-target-min);
  background: transparent;
  border: none;
  cursor: pointer;
}

.bottom-nav-item:active {
  background-color: rgba(102, 126, 234, 0.1);
}

.bottom-nav-item.active {
  color: var(--primary-color);
}

.bottom-nav-item.active .bottom-nav-icon {
  transform: scale(1.1);
}

.bottom-nav-icon {
  font-size: 24px;
  margin-bottom: 2px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--touch-feedback-duration) var(--scroll-bounce);
}

.bottom-nav-text {
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .bottom-nav {
    display: flex;
  }
}

@media (orientation: landscape) and (max-height: 500px) {
  .bottom-nav {
    height: 48px;
  }

  .bottom-nav-icon {
    font-size: 20px;
    height: 24px;
  }

  .bottom-nav-text {
    font-size: 9px;
  }
}
</style>