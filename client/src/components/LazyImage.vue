<template>
  <div class="lazy-image-container" ref="containerRef">
    <img
      v-if="!isLoaded"
      :src="placeholder"
      :alt="alt"
      class="placeholder-image"
      aria-hidden="true"
    />
    <img
      v-else
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      class="lazy-image"
      @load="handleLoad"
      @error="handleError"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  srcset: {
    type: String,
    default: ''
  },
  sizes: {
    type: String,
    default: ''
  },
  alt: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjVmN2ZhIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0ibm9uZSIvPjwvc3ZnPg=='
  },
  rootMargin: {
    type: String,
    default: '50px'
  },
  threshold: {
    type: Number,
    default: 0.1
  }
})

const emit = defineEmits(['load', 'error'])

const containerRef = ref(null)
const isLoaded = ref(false)
let observer = null

const loadImage = () => {
  if (!isLoaded.value) {
    isLoaded.value = true
  }
}

const handleLoad = (event) => {
  emit('load', event)
}

const handleError = (event) => {
  emit('error', event)
}

onMounted(() => {
  if ('IntersectionObserver' in window && containerRef.value) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadImage()
          if (observer) {
            observer.disconnect()
          }
        }
      })
    }, {
      rootMargin: props.rootMargin,
      threshold: props.threshold
    })

    observer.observe(containerRef.value)
  } else {
    // 回退方案：直接加载
    loadImage()
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})

// 暴露方法
const forceLoad = () => {
  loadImage()
}

defineExpose({
  forceLoad
})
</script>

<style scoped>
.lazy-image-container {
  position: relative;
  overflow: hidden;
  display: inline-block;
}

.placeholder-image,
.lazy-image {
  display: block;
  width: 100%;
  height: auto;
  transition: opacity 0.3s ease;
}

.placeholder-image {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  opacity: 1;
}

.lazy-image {
  position: relative;
  z-index: 2;
  opacity: 0;
}

.lazy-image-container.loaded .placeholder-image {
  opacity: 0;
}

.lazy-image-container.loaded .lazy-image {
  opacity: 1;
}
</style>