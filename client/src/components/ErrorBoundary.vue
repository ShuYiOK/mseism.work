<template>
  <div class="error-boundary">
    <slot v-if="!error" />
    <div v-else class="error-fallback">
      <div class="error-icon">⚠️</div>
      <h2 class="error-title">出了点问题</h2>
      <p class="error-message">{{ error.message }}</p>
      <div v-if="showDetails && error.stack" class="error-details">
        <pre>{{ error.stack }}</pre>
      </div>
      <div class="error-actions">
        <button @click="retry" class="retry-btn">重试</button>
        <button @click="goHome" class="home-btn">返回首页</button>
        <button v-if="!showDetails" @click="showDetails = true" class="details-btn">
          查看详情
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  fallback: {
    type: String,
    default: ''
  },
  onError: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['error'])

const router = useRouter()
const error = ref(null)
const errorInfo = ref(null)
const showDetails = ref(false)

// 捕获子组件错误
onErrorCaptured((err, instance, info) => {
  console.error('[错误边界] 捕获到错误:', err)
  
  error.value = err
  errorInfo.value = info
  
  // 记录错误日志
  if (window.performanceMonitor) {
    window.performanceMonitor.addAlert('error', err.message, 'error')
  }
  
  // 显示错误通知
  if (window.toast) {
    window.toast.error('应用程序出现错误', {
      title: '错误',
      duration: 0 // 不自动关闭
    })
  }
  
  // 调用自定义错误处理
  if (props.onError) {
    props.onError(err, instance, info)
  }
  
  // 触发错误事件
  emit('error', err, instance, info)
  
  // 阻止错误继续向上传播
  return false
})

// 监听全局错误
onMounted(() => {
  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[错误边界] 未处理的Promise拒绝:', event.reason)
    
    if (window.toast) {
      window.toast.warning('应用程序出现异常，请刷新页面', {
        title: '警告',
        duration: 5000
      })
    }
  })
  
  // 捕获全局错误
  window.addEventListener('error', (event) => {
    console.error('[错误边界] 全局错误:', event.error)
    
    if (window.toast && event.error) {
      window.toast.error(event.error.message || '发生未知错误', {
        title: '错误'
      })
    }
  })
})

const retry = () => {
  error.value = null
  errorInfo.value = null
  showDetails.value = false
}

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 40px 20px;
  text-align: center;
  background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
  border-radius: 15px;
  margin: 20px;
}

.error-icon {
  font-size: 4em;
  margin-bottom: 20px;
}

.error-title {
  color: #d32f2f;
  font-size: 2em;
  margin: 0 0 10px 0;
}

.error-message {
  color: #333;
  font-size: 1.1em;
  margin: 0 0 20px 0;
  max-width: 600px;
}

.error-details {
  background: white;
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
  max-width: 800px;
  width: 100%;
  text-align: left;
}

.error-details pre {
  margin: 0;
  padding: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
  color: #d32f2f;
}

.error-actions {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
}

.retry-btn,
.home-btn,
.details-btn {
  padding: 12px 30px;
  border: none;
  border-radius: 25px;
  font-size: 1em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.retry-btn {
  background: #4caf50;
  color: white;
}

.retry-btn:hover {
  background: #43a047;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.home-btn {
  background: #2196f3;
  color: white;
}

.home-btn:hover {
  background: #1976d2;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
}

.details-btn {
  background: #ff9800;
  color: white;
}

.details-btn:hover {
  background: #f57c00;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.4);
}

/* 响应式 */
@media (max-width: 768px) {
  .error-fallback {
    margin: 10px;
    padding: 20px;
  }
  
  .error-icon {
    font-size: 3em;
  }
  
  .error-title {
    font-size: 1.5em;
  }
  
  .error-message {
    font-size: 1em;
  }
  
  .error-actions {
    flex-direction: column;
  }
  
  .retry-btn,
  .home-btn,
  .details-btn {
    width: 100%;
    max-width: 250px;
  }
}
</style>
