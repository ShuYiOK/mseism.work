<template>
  <div class="lazy-container" ref="containerRef">
    <div v-if="!isLoaded" class="lazy-placeholder">
      <slot name="placeholder">
        <div class="skeleton"></div>
      </slot>
    </div>
    <div v-else class="lazy-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  rootMargin: {
    type: String,
    default: '50px'
  },
  threshold: {
    type: Number,
    default: 0.1
  }
})

const emit = defineEmits(['load'])

const containerRef = ref(null)
const isLoaded = ref(false)
let observer = null

const loadContent = () => {
  if (!isLoaded.value) {
    isLoaded.value = true
    emit('load')
    if (observer) {
      observer.disconnect()
    }
  }
}

onMounted(() => {
  if ('IntersectionObserver' in window && containerRef.value) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadContent()
        }
      })
    }, {
      rootMargin: props.rootMargin,
      threshold: props.threshold
    })

    observer.observe(containerRef.value)
  } else {
    // 回退方案：直接加载
    loadContent()
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})

// 暴露方法
const forceLoad = () => {
  loadContent()
}

defineExpose({
  forceLoad
})
</script>

<style scoped>
.lazy-container {
  position: relative;
  overflow: hidden;
}

.lazy-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.lazy-content {
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>