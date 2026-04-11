<template>
  <div 
    class="stat-card" 
    @click="onClick" 
    :class="{ active: isActive }"
    role="button"
    tabindex="0"
    :aria-pressed="isActive"
    :aria-label="ariaLabel"
  >
    <h3 :style="{ color: color }">{{ value }}</h3>
    <p>{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  value: string | number
  label: string
  color?: string
  isActive?: boolean
  ariaLabel: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const onClick = () => {
  emit('click')
}
</script>

<style scoped>
.stat-card {
  background: rgba(255,255,255,0.95);
  padding: 15px 30px;
  border-radius: 30px;
  box-shadow: var(--shadow-md);
  text-align: center;
  min-width: 100px;
  min-height: 80px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

.stat-card:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(102, 126, 234, 0.1) 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.stat-card.active {
  border-color: #4caf50;
  background: #4caf50;
  color: white;
}

.stat-card h3 {
  color: #667eea;
  font-size: 1.5em;
  margin: 0;
}

.stat-card p {
  color: #666;
  font-size: 0.85em;
  margin: 0;
}

.stat-card.active h3,
.stat-card.active p {
  color: white;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .stat-card {
    padding: 12px 25px;
    min-width: 90px;
  }
  
  .stat-card h3 {
    font-size: 1.3em;
  }
}

@media (max-width: 480px) {
  .stat-card {
    padding: 8px 12px;
    min-width: 70px;
    border-radius: 20px;
  }
  
  .stat-card h3 {
    font-size: 1.1em;
  }
  
  .stat-card p {
    font-size: 0.8em;
  }
}
</style>