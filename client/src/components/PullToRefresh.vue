<template>
  <div
    class="pull-to-refresh"
    ref="containerRef"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div
      class="pull-indicator"
      :class="{ pulling: isPulling, ready: pullDistance >= threshold, refreshing: isRefreshing }"
      :style="{ transform: `translateY(${pullDistance}px)` }"
    >
      <div v-if="isRefreshing" class="refresh-spinner"></div>
      <span v-else class="pull-arrow">{{ pullDistance >= threshold ? '↓' : '↑' }}</span>
      <span class="pull-text">{{ pullText }}</span>
    </div>
    <div class="refresh-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  threshold: {
    type: Number,
    default: 80
  },
  maxPull: {
    type: Number,
    default: 120
  },
  refreshing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['refresh'])

const containerRef = ref(null)
const isPulling = ref(false)
const isRefreshing = ref(false)
const pullDistance = ref(0)
const startY = ref(0)
const currentY = ref(0)

const pullText = computed(() => {
  if (isRefreshing.value) return '刷新中...'
  if (pullDistance.value >= props.threshold) return '释放刷新'
  return '下拉刷新'
})

const handleTouchStart = (e) => {
  if (isRefreshing.value) return

  const container = containerRef.value
  if (container.scrollTop <= 0) {
    isPulling.value = true
    startY.value = e.touches[0].clientY
    currentY.value = startY.value
  }
}

const handleTouchMove = (e) => {
  if (!isPulling.value || isRefreshing.value) return

  currentY.value = e.touches[0].clientY
  const diff = currentY.value - startY.value

  if (diff > 0) {
    e.preventDefault()
    const deceleration = 0.5
    pullDistance.value = Math.min(diff * deceleration, props.maxPull)
  }
}

const handleTouchEnd = () => {
  if (!isPulling.value) return

  if (pullDistance.value >= props.threshold) {
    isRefreshing.value = true
    pullDistance.value = props.threshold
    emit('refresh')

    setTimeout(() => {
      isRefreshing.value = false
      pullDistance.value = 0
      isPulling.value = false
    }, 1000)
  } else {
    pullDistance.value = 0
    isPulling.value = false
  }
}
</script>

<style scoped>
.pull-to-refresh {
  position: relative;
  overflow: hidden;
  min-height: 100%;
}

.pull-indicator {
  position: absolute;
  top: -60px;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-secondary);
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  z-index: 10;
}

.pull-indicator.pulling {
  transition: none;
}

.pull-indicator.refreshing {
  transform: translateY(0) !important;
}

.pull-arrow {
  font-size: 20px;
  color: var(--text-secondary);
  transition: transform 0.3s ease;
}

.pull-indicator.ready .pull-arrow {
  transform: rotate(180deg);
}

.refresh-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.pull-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.refresh-content {
  min-height: 100%;
}
</style>