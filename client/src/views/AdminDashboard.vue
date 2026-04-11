<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-info">
          <h3>{{ stats.groups }}</h3>
          <p>分组总数</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🖥️</div>
        <div class="stat-info">
          <h3>{{ stats.devices }}</h3>
          <p>设备总数</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🟢</div>
        <div class="stat-info">
          <h3>{{ stats.online }}</h3>
          <p>在线设备</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info">
          <h3>{{ stats.offline }}</h3>
          <p>离线设备</p>
        </div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <h3>快捷操作</h3>
      <div class="action-buttons">
        <router-link to="/admin/groups" class="action-btn">
          <span>➕</span> 创建分组
        </router-link>
        <button @click="refreshData" class="action-btn">
          <span>🔄</span> 刷新数据
        </button>
        <router-link to="/admin/performance" class="action-btn">
          <span>📊</span> 查看监控
        </router-link>
      </div>
    </div>

    <!-- 最近活动 -->
    <div class="recent-activity">
      <h3>最近活动</h3>
      <div class="activity-list">
        <div v-for="activity in activities" :key="activity.id" class="activity-item">
          <span class="activity-icon">{{ activity.icon }}</span>
          <div class="activity-content">
            <p class="activity-text">{{ activity.text }}</p>
            <span class="activity-time">{{ activity.time }}</span>
          </div>
        </div>
        <div v-if="activities.length === 0" class="no-activity">暂无活动记录</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDeviceStore } from '../stores/devices'

const deviceStore = useDeviceStore()

const stats = ref({
  groups: 0,
  devices: 0,
  online: 0,
  offline: 0
})

const activities = ref([])

const loadStats = async () => {
  // 从 store 获取统计数据
  stats.value = {
    groups: deviceStore.groups?.length || 0,
    devices: deviceStore.devices?.length || 0,
    online: deviceStore.devices?.filter(d => d.online)?.length || 0,
    offline: deviceStore.devices?.filter(d => !d.online)?.length || 0
  }
}

const loadActivities = () => {
  // 模拟活动数据，实际应从API获取
  activities.value = [
    { id: 1, icon: '📁', text: '创建了新分组"测试组"', time: '5分钟前' },
    { id: 2, icon: '🖥️', text: '添加了3台设备到"生产环境"', time: '10分钟前' },
    { id: 3, icon: '⚙️', text: '更新了系统配置', time: '1小时前' },
  ]
}

const refreshData = async () => {
  await deviceStore.loadGroups()
  await deviceStore.loadDevices()
  await loadStats()
}

onMounted(async () => {
  await Promise.all([
    deviceStore.loadGroups(),
    deviceStore.loadDevices()
  ])
  loadStats()
  loadActivities()
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.stat-icon {
  font-size: 2.5em;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
}

.stat-info h3 {
  margin: 0 0 4px 0;
  font-size: 2em;
  color: #333;
}

.stat-info p {
  margin: 0;
  color: #666;
  font-size: 0.9em;
}

/* 快捷操作 */
.quick-actions {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.quick-actions h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #f5f7fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  text-decoration: none;
  color: #333;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

/* 最近活动 */
.recent-activity {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.recent-activity h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.activity-icon {
  font-size: 1.5em;
}

.activity-content {
  flex: 1;
}

.activity-text {
  margin: 0 0 4px 0;
  color: #333;
}

.activity-time {
  font-size: 0.85em;
  color: #999;
}

.no-activity {
  text-align: center;
  color: #999;
  padding: 32px;
}

/* 响应式 */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-icon {
    width: 48px;
    height: 48px;
    font-size: 2em;
  }
}
</style>
