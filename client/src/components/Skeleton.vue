<template>
  <div class="skeleton-container" :style="{ ...containerStyle, '--animation-duration': animationDuration }">
    <!-- 卡片骨架屏 -->
    <div v-if="type === 'card'" class="skeleton-card" v-for="n in count" :key="n">
      <div class="skeleton-card-header">
        <div class="skeleton-text skeleton-title"></div>
        <div class="skeleton-badge"></div>
      </div>
      <div class="skeleton-card-body">
        <div class="skeleton-row">
          <div class="skeleton-label"></div>
          <div class="skeleton-text skeleton-value"></div>
        </div>
        <div class="skeleton-row">
          <div class="skeleton-label"></div>
          <div class="skeleton-text skeleton-value-full"></div>
        </div>
        <div class="skeleton-row">
          <div class="skeleton-label"></div>
          <div class="skeleton-text skeleton-value"></div>
        </div>
        <div class="skeleton-row">
          <div class="skeleton-label"></div>
          <div class="skeleton-text skeleton-value"></div>
        </div>
      </div>
    </div>

    <!-- 表格骨架屏 -->
    <div v-else-if="type === 'table'" class="skeleton-table">
      <div class="skeleton-table-header">
        <div class="skeleton-th" v-for="n in columns" :key="n"></div>
      </div>
      <div class="skeleton-table-body">
        <div class="skeleton-tr" v-for="n in count" :key="n">
          <div class="skeleton-td" v-for="m in columns" :key="m"></div>
        </div>
      </div>
    </div>

    <!-- 文本骨架屏 -->
    <div v-else-if="type === 'text'" class="skeleton-text-block">
      <div class="skeleton-text-line" v-for="n in count" :key="n" :style="{ width: getTextLineWidth(n) }"></div>
    </div>

    <!-- 圆形骨架屏 -->
    <div v-else-if="type === 'circle'" class="skeleton-circle-block">
      <div class="skeleton-circle" v-for="n in count" :key="n" :style="{ width: size, height: size }"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  // 骨架屏类型：card, table, text, circle
  type: {
    type: String,
    default: 'card',
    validator: (value) => ['card', 'table', 'text', 'circle'].includes(value)
  },
  // 数量
  count: {
    type: Number,
    default: 6
  },
  // 表格列数
  columns: {
    type: Number,
    default: 6
  },
  // 容器样式
  containerStyle: {
    type: Object,
    default: () => ({})
  },
  // 圆形大小（用于 circle 类型）
  size: {
    type: String,
    default: '50px'
  },
  // 动画持续时间
  animationDuration: {
    type: String,
    default: '1.5s'
  }
})

// 获取文本行的宽度（模拟不同长度）
const getTextLineWidth = (index) => {
  const widths = ['100%', '90%', '95%', '80%', '100%', '70%']
  return widths[(index - 1) % widths.length]
}
</script>

<style scoped>
.skeleton-container {
  width: 100%;
}

/* 基础骨架屏样式 */
.skeleton-text,
.skeleton-badge,
.skeleton-label,
.skeleton-value,
.skeleton-value-full,
.skeleton-th,
.skeleton-td,
.skeleton-text-line,
.skeleton-circle {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.3) 50%,
    rgba(255, 255, 255, 0.1) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-loading var(--animation-duration, 1.5s) ease-in-out infinite;
  border-radius: 4px;
  transition: all 0.3s ease;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 卡片骨架屏 */
.skeleton-card {
  background: var(--card-bg);
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.skeleton-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--border-color);
}

.skeleton-title {
  width: 120px;
  height: 24px;
}

.skeleton-badge {
  width: 50px;
  height: 20px;
  border-radius: 10px;
}

.skeleton-card-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.skeleton-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.skeleton-label {
  width: 40px;
  height: 12px;
  opacity: 0.6;
}

.skeleton-value {
  width: 80px;
  height: 18px;
}

.skeleton-value-full {
  width: 100%;
  height: 18px;
}

/* 表格骨架屏 */
.skeleton-table {
  background: var(--card-bg);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.skeleton-table-header {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 15px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 2px solid var(--border-color);
}

.skeleton-th {
  height: 20px;
  border-radius: 4px;
}

.skeleton-table-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-tr {
  display: grid;
  grid-template-columns: repeat(v-bind(columns), 1fr);
  gap: 15px;
}

.skeleton-td {
  height: 16px;
  border-radius: 4px;
}

/* 文本骨架屏 */
.skeleton-text-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-text-line {
  height: 16px;
  border-radius: 4px;
}

/* 圆形骨架屏 */
.skeleton-circle-block {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.skeleton-circle {
  border-radius: 50%;
}

/* 响应式 */
@media (max-width: 768px) {
  .skeleton-card-body {
    grid-template-columns: 1fr;
  }
  
  .skeleton-table-header,
  .skeleton-tr {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 480px) {
  .skeleton-card {
    padding: 15px;
  }
  
  .skeleton-title {
    width: 100px;
    height: 20px;
  }
  
  .skeleton-table-header,
  .skeleton-tr {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
