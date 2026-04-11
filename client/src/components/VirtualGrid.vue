<template>
  <div ref="containerRef" class="virtual-grid-container" :style="{ height: containerHeight }">
    <div class="virtual-grid-spacer" :style="{ height: totalHeight }">
      <div class="virtual-grid-items" :style="itemsStyle">
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
  items: {
    type: Array,
    required: true
  },
  itemHeight: {
    type: Number,
    default: 200
  },
  itemWidth: {
    type: Number,
    default: 300
  },
  gap: {
    type: Number,
    default: 20
  },
  containerHeight: {
    type: String,
    default: '600px'
  },
  bufferSize: {
    type: Number,
    default: 3
  },
  itemKey: {
    type: String,
    default: 'id'
  }
})

const emit = defineEmits(['scroll', 'range-change'])

const containerRef = ref(null)
const scrollTop = ref(0)
const containerHeightPx = ref(600)
const containerWidthPx = ref(1200)
const columns = ref(4)

const updateColumns = () => {
  if (containerRef.value) {
    containerWidthPx.value = containerRef.value.clientWidth
    const availableWidth = containerWidthPx.value
    const itemTotalWidth = props.itemWidth + props.gap
    const calculatedColumns = Math.max(1, Math.floor((availableWidth + props.gap) / itemTotalWidth))
    columns.value = calculatedColumns
  }
}

const rowHeight = computed(() => props.itemHeight + props.gap)

const totalRows = computed(() => Math.ceil(props.items.length / columns.value))

const totalHeight = computed(() => {
  return totalRows.value * rowHeight.value + 'px'
})

const visibleItems = computed(() => {
  const startRow = Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - props.bufferSize)
  const visibleRowCount = Math.ceil(containerHeightPx.value / rowHeight.value)
  const endRow = Math.min(totalRows.value, startRow + visibleRowCount + props.bufferSize * 2)
  
  const items = []
  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < columns.value; col++) {
      const index = row * columns.value + col
      if (index < props.items.length) {
        items.push({
          key: props.items[index][props.itemKey] ?? index,
          data: props.items[index],
          index: index,
          row: row,
          col: col
        })
      }
    }
  }
  
  return items
})

const itemsStyle = computed(() => {
  const startRow = Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - props.bufferSize)
  return {
    transform: `translateY(${startRow * rowHeight.value}px)`,
    display: 'grid',
    gridTemplateColumns: `repeat(${columns.value}, ${props.itemWidth}px)`,
    gap: `${props.gap}px`,
    padding: `0 ${props.gap}px`
  }
})

const handleScroll = (e) => {
  scrollTop.value = e.target.scrollTop
  emit('scroll', {
    scrollTop: scrollTop.value,
    scrollHeight: e.target.scrollHeight,
    clientHeight: e.target.clientHeight
  })
  
  const startRow = Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - props.bufferSize)
  const visibleRowCount = Math.ceil(containerHeightPx.value / rowHeight.value)
  const endRow = Math.min(totalRows.value, startRow + visibleRowCount + props.bufferSize * 2)
  const startIndex = startRow * columns.value
  const endIndex = Math.min(props.items.length, endRow * columns.value)
  emit('range-change', { start: startIndex, end: endIndex })
}

const updateContainerHeight = () => {
  if (containerRef.value) {
    containerHeightPx.value = containerRef.value.clientHeight
  }
}

const scrollTo = (position) => {
  if (containerRef.value) {
    containerRef.value.scrollTop = position
  }
}

const scrollToItem = (index) => {
  const row = Math.floor(index / columns.value)
  const position = row * rowHeight.value
  scrollTo(position)
}

defineExpose({
  scrollTo,
  scrollToItem,
  updateContainerHeight,
  updateColumns
})

const handleResize = () => {
  updateContainerHeight()
  updateColumns()
}

onMounted(() => {
  updateContainerHeight()
  updateColumns()
  if (containerRef.value) {
    containerRef.value.addEventListener('scroll', handleScroll)
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('scroll', handleScroll)
  }
  window.removeEventListener('resize', handleResize)
})

watch(() => props.items.length, () => {
  nextTick(() => {
    updateContainerHeight()
    updateColumns()
  })
})

watch(() => [props.itemWidth, props.gap], () => {
  nextTick(() => {
    updateColumns()
  })
})
</script>

<style scoped>
.virtual-grid-container {
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.virtual-grid-spacer {
  position: relative;
  width: 100%;
}

.virtual-grid-items {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
  width: 100%;
}

.virtual-grid-container::-webkit-scrollbar {
  width: 8px;
}

.virtual-grid-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.virtual-grid-container::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.5);
  border-radius: 4px;
}

.virtual-grid-container::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.7);
}
</style>
