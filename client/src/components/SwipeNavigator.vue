<template>
  <div
    class="swipe-navigator"
    ref="containerRef"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <div
      class="swipe-track"
      :style="{
        transform: `translateX(${currentOffset}px)`,
        transition: isDragging ? 'none' : 'transform 200ms ease-out'
      }"
    >
      <slot></slot>
    </div>
    <div v-if="showIndicators" class="swipe-indicators">
      <span
        v-for="(item, index) in items"
        :key="index"
        class="swipe-indicator"
        :class="{ active: index === currentIndex }"
        @click="goToSlide(index)"
      ></span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  initialIndex: {
    type: Number,
    default: 0
  },
  showIndicators: {
    type: Boolean,
    default: true
  },
  threshold: {
    type: Number,
    default: 50
  },
  animationDuration: {
    type: Number,
    default: 200
  }
})

const emit = defineEmits(['slideChange'])

const containerRef = ref(null)
const currentIndex = ref(props.initialIndex)
const isDragging = ref(false)
const startX = ref(0)
const currentX = ref(0)
const translateX = ref(0)

const currentOffset = computed(() => {
  if (isDragging.value) {
    const containerWidth = containerRef.value?.offsetWidth || 0
    const diff = currentX.value - startX.value
    const baseOffset = -currentIndex.value * containerWidth
    return baseOffset + diff
  }
  return -currentIndex.value * (containerRef.value?.offsetWidth || 0)
})

const handleTouchStart = (e) => {
  isDragging.value = true
  startX.value = e.touches[0].clientX
  currentX.value = startX.value
}

const handleTouchMove = (e) => {
  if (!isDragging.value) return
  currentX.value = e.touches[0].clientX
}

const handleTouchEnd = () => {
  if (!isDragging.value) return

  isDragging.value = false
  const containerWidth = containerRef.value?.offsetWidth || 1
  const diff = currentX.value - startX.value
  const threshold = props.threshold

  if (diff < -threshold && currentIndex.value < props.items.length - 1) {
    currentIndex.value++
  } else if (diff > threshold && currentIndex.value > 0) {
    currentIndex.value--
  }

  emit('slideChange', currentIndex.value)
}

const goToSlide = (index) => {
  if (index >= 0 && index < props.items.length) {
    currentIndex.value = index
    emit('slideChange', currentIndex.value)
  }
}

defineExpose({
  goToSlide,
  currentIndex
})
</script>

<style scoped>
.swipe-navigator {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

.swipe-track {
  display: flex;
  width: 100%;
  height: 100%;
  will-change: transform;
  transform: translateZ(0);
}

.swipe-track > * {
  flex-shrink: 0;
  width: 100%;
  height: 100%;
}

.swipe-indicators {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}

.swipe-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.3s ease;
}

.swipe-indicator.active {
  background: white;
  transform: scale(1.2);
}

@media (max-width: 768px) {
  .swipe-indicator {
    width: 10px;
    height: 10px;
  }
}
</style>