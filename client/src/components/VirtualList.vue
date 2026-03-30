<template>
  <div ref="containerRef" class="virtual-list-container" :style="{ height: containerHeight }">
    <div class="virtual-list-spacer" :style="{ height: totalHeight }">
      <div class="virtual-list-items" :style="itemsStyle">
        <slot 
          name="item" 
          v-for="item in visibleItems" 
          :key="item.key"
          :item="item.data"
          :index="item.index"
        ></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  // 数据数组
  items: {
    type: Array,
    required: true
  },
  // 每个项目的高度（像素）
  itemHeight: {
    type: Number,
    default: 100
  },
  // 容器高度
  containerHeight: {
    type: String,
    default: '600px'
  },
  // 缓冲区大小（渲染可见区域上下多少个项目）
  bufferSize: {
    type: Number,
    default: 5
  },
  // 获取项目的唯一 key
  itemKey: {
    type: String,
    default: 'id'
  }
})

const emit = defineEmits(['scroll', 'range-change'])

const containerRef = ref(null)
const scrollTop = ref(0)
const containerHeightPx = ref(600)

// 计算总高度
const totalHeight = computed(() => {
  return props.items.length * props.itemHeight + 'px'
})

// 计算可见区域的项目
const visibleItems = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize)
  const visibleCount = Math.ceil(containerHeightPx.value / props.itemHeight)
  const end = Math.min(props.items.length, start + visibleCount + props.bufferSize * 2)
  
  const items = []
  for (let i = start; i < end; i++) {
    items.push({
      key: props.items[i][props.itemKey] ?? i,
      data: props.items[i],
      index: i,
      style: {
        position: 'absolute',
        top: i * props.itemHeight + 'px',
        left: 0,
        right: 0,
        height: props.itemHeight + 'px'
      }
    })
  }
  
  return items
})

// 项目容器的样式
const itemsStyle = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize)
  return {
    transform: `translateY(${start * props.itemHeight}px)`
  }
})

// 处理滚动
const handleScroll = (e) => {
  scrollTop.value = e.target.scrollTop
  emit('scroll', {
    scrollTop: scrollTop.value,
    scrollHeight: e.target.scrollHeight,
    clientHeight: e.target.clientHeight
  })
  
  // 触发范围变化事件
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize)
  const visibleCount = Math.ceil(containerHeightPx.value / props.itemHeight)
  const end = Math.min(props.items.length, start + visibleCount + props.bufferSize * 2)
  emit('range-change', { start, end })
}

// 更新容器高度
const updateContainerHeight = () => {
  if (containerRef.value) {
    containerHeightPx.value = containerRef.value.clientHeight
  }
}

// 滚动到指定位置
const scrollTo = (position) => {
  if (containerRef.value) {
    containerRef.value.scrollTop = position
  }
}

// 滚动到指定项目
const scrollToItem = (index) => {
  const position = index * props.itemHeight
  scrollTo(position)
}

// 暴露方法给父组件
defineExpose({
  scrollTo,
  scrollToItem,
  updateContainerHeight
})

onMounted(() => {
  updateContainerHeight()
  if (containerRef.value) {
    containerRef.value.addEventListener('scroll', handleScroll)
  }
  // 监听窗口大小变化
  window.addEventListener('resize', updateContainerHeight)
})

onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('resize', updateContainerHeight)
})

// 监听 items 变化时更新容器高度
watch(() => props.items.length, () => {
  nextTick(() => {
    updateContainerHeight()
  })
})
</script>

<style scoped>
.virtual-list-container {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.virtual-list-spacer {
  position: relative;
  width: 100%;
}

.virtual-list-items {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
  width: 100%;
  display: block;
}

/* 滚动条样式 */
.virtual-list-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-list-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.virtual-list-container::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.5);
  border-radius: 4px;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.7);
}
</style>
