<template>
  <Teleport to="body">
    <div class="toast-container">
      <transition-group name="toast" tag="div">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="[`toast-${toast.type}`, toast.customClass]"
          @click="removeToast(toast.id)"
        >
          <div class="toast-icon">
            <span v-if="toast.type === 'success'">✓</span>
            <span v-else-if="toast.type === 'error'">✕</span>
            <span v-else-if="toast.type === 'warning'">⚠</span>
            <span v-else>ℹ</span>
          </div>
          <div class="toast-content">
            <h4 v-if="toast.title" class="toast-title">{{ toast.title }}</h4>
            <p class="toast-message">{{ toast.message }}</p>
          </div>
          <button class="toast-close" @click.stop="removeToast(toast.id)">
            ×
          </button>
        </div>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const toasts = ref([])
let toastIdCounter = 0

const showToast = (message, options = {}) => {
  const {
    type = 'info',
    title = '',
    duration = 3000,
    customClass = ''
  } = options

  const id = ++toastIdCounter
  const toast = {
    id,
    type,
    title,
    message,
    customClass
  }

  toasts.value.push(toast)

  // 自动移除
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  return id
}

const removeToast = (id) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

const clearAll = () => {
  toasts.value = []
}

// 预定义的toast方法
const toast = {
  success: (message, options) => showToast(message, { ...options, type: 'success' }),
  error: (message, options) => showToast(message, { ...options, type: 'error' }),
  warning: (message, options) => showToast(message, { ...options, type: 'warning' }),
  info: (message, options) => showToast(message, { ...options, type: 'info' })
}

// 挂载到全局
onMounted(() => {
  if (!window.toast) {
    window.toast = toast
  }
})

defineExpose({
  showToast,
  removeToast,
  clearAll,
  toast
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  min-width: 300px;
  max-width: 500px;
  padding: 15px 20px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.toast::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  border-radius: 12px 0 0 12px;
}

.toast-success::before {
  background: #388e3c;
}

.toast-error::before {
  background: #d32f2f;
}

.toast-warning::before {
  background: #f57c00;
}

.toast-info::before {
  background: #1976d2;
}

.toast:hover {
  transform: translateX(-5px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.toast-success {
  background: linear-gradient(135deg, #4caf50 0%, #43a047 100%);
  color: white;
}

.toast-error {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  color: white;
}

.toast-warning {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
}

.toast-info {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
}

.toast-icon {
  font-size: 1.5em;
  font-weight: bold;
  line-height: 1;
  flex-shrink: 0;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  margin: 0 0 4px 0;
  font-size: 1em;
  font-weight: 600;
}

.toast-message {
  margin: 0;
  font-size: 0.9em;
  line-height: 1.4;
  word-wrap: break-word;
}

.toast-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5em;
  line-height: 1;
  padding: 0;
  width: 24px;
  height: 24px;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.toast-close:hover {
  opacity: 1;
}

/* 动画 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}

.toast-move {
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 脉冲动画 */
@keyframes toast-pulse {
  0% {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
  }
  100% {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }
}

.toast-success {
  background: linear-gradient(135deg, #4caf50 0%, #43a047 100%);
  color: white;
  animation: toast-pulse 2s ease-in-out infinite;
}

.toast-error {
  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  color: white;
  animation: toast-pulse 2s ease-in-out infinite;
}

.toast-warning {
  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
  color: white;
  animation: toast-pulse 2s ease-in-out infinite;
}

.toast-info {
  background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
  color: white;
  animation: toast-pulse 2s ease-in-out infinite;
}

/* 响应式 */
@media (max-width: 768px) {
  .toast-container {
    left: 15px;
    right: 15px;
    top: 15px;
  }
  
  .toast {
    min-width: auto;
    width: 100%;
    padding: 12px 16px;
    gap: 10px;
  }
  
  .toast-icon {
    font-size: 1.3em;
  }
  
  .toast-title {
    font-size: 0.95em;
  }
  
  .toast-message {
    font-size: 0.85em;
  }
}

@media (max-width: 480px) {
  .toast-container {
    left: 10px;
    right: 10px;
    top: 10px;
  }
  
  .toast {
    padding: 10px 14px;
    gap: 8px;
  }
  
  .toast-icon {
    font-size: 1.2em;
  }
  
  .toast-title {
    font-size: 0.9em;
  }
  
  .toast-message {
    font-size: 0.8em;
  }
}
</style>
