<template>
  <div class="config-manage">
    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-info">
        <span class="info-icon">ℹ️</span>
        <span>修改配置后需要热更新或重启服务器</span>
      </div>
      <div class="action-buttons">
        <button @click="loadConfig" class="btn btn-secondary" :disabled="isLoading">
          <span class="icon">{{ isLoading ? '⏳' : '🔄' }}</span>
          刷新配置
        </button>
        <button @click="showReloadConfirm = true" class="btn btn-warning" :disabled="!isAdmin || isReloading">
          <span class="icon">{{ isReloading ? '⏳' : '🔥' }}</span>
          热更新配置
        </button>
      </div>
    </div>

    <!-- 配置分区 -->
    <div class="config-sections">
      <div
        v-for="(section, sectionKey) in configData"
        :key="sectionKey"
        class="card config-section"
      >
        <div class="card-header">
          <div class="header-left">
            <span class="section-icon">{{ getSectionIcon(sectionKey) }}</span>
            <h3>{{ getSectionTitle(sectionKey) }}</h3>
          </div>
          <span class="config-count">{{ Object.keys(section).length }} 项</span>
        </div>
        <div class="card-body">
          <div class="config-grid">
            <div v-for="(value, key) in section" :key="key" class="config-item">
              <label class="config-label">{{ formatKey(key) }}</label>
              <div class="config-value-wrapper">
                <span v-if="isSecret(key)" class="config-value secret">
                  <span class="secret-text">***</span>
                  <button
                    @click="toggleSecret(sectionKey, key)"
                    class="reveal-btn"
                    title="显示/隐藏"
                  >
                    {{ revealedSecrets[`${sectionKey}.${key}`] ? '🙈' : '👁️' }}
                  </button>
                </span>
                <span v-else class="config-value">{{ formatValue(value) }}</span>
                <span v-if="needsRestart(sectionKey, key)" class="restart-badge">
                  🔄 需重启
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="Object.keys(configData).length === 0" class="empty-state">
        <p class="empty-icon">⚙️</p>
        <p>暂无配置数据</p>
      </div>
    </div>

    <!-- 环境变量编辑器 -->
    <div class="card env-editor">
      <div class="card-header">
        <div class="header-left">
          <span class="section-icon">📝</span>
          <h3>环境变量编辑</h3>
        </div>
        <span class="admin-badge">{{ isAdmin ? '管理员' : '只读' }}</span>
      </div>
      <div class="card-body">
        <textarea
          v-model="envContent"
          class="env-textarea"
          spellcheck="false"
          :readonly="!isAdmin"
          placeholder="# 配置文件内容将显示在这里"
        ></textarea>
        <div v-if="!isAdmin" class="readonly-notice">
          ℹ️ 只读模式：只有管理员可以编辑配置
        </div>
        <div class="env-actions">
          <button @click="loadEnvFile" class="btn btn-secondary" :disabled="isLoading">
            <span class="icon">📂</span> 加载文件
          </button>
          <button @click="updateEnvFile" class="btn btn-primary" :disabled="!isAdmin || isUpdating">
            <span class="icon">{{ isUpdating ? '⏳' : '💾' }}</span>
            {{ isUpdating ? '保存中...' : '保存配置' }}
          </button>
          <button @click="loadExample" class="btn btn-info" :disabled="isLoading">
            <span class="icon">📋</span> 示例配置
          </button>
        </div>
      </div>
    </div>

    <!-- 配置验证 -->
    <div class="card config-validator">
      <div class="card-header">
        <div class="header-left">
          <span class="section-icon">✅</span>
          <h3>配置验证</h3>
        </div>
      </div>
      <div class="card-body">
        <div class="validator-actions">
          <button @click="validateCurrentConfig" class="btn btn-primary" :disabled="isValidating">
            <span class="icon">{{ isValidating ? '⏳' : '🔍' }}</span>
            验证当前配置
          </button>
        </div>
        <div v-if="validationResult" :class="['validation-result', validationResult.valid ? 'valid' : 'invalid']">
          <div class="result-content">
            <span class="result-icon">{{ validationResult.valid ? '✅' : '❌' }}</span>
            <p class="result-message">
              {{ validationResult.valid ? '配置验证通过' : '配置验证失败: ' + validationResult.message }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 热更新确认模态框 -->
    <div v-if="showReloadConfirm" class="modal-overlay" @click="closeReloadModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>🔥 热更新配置</h2>
          <button @click="closeReloadModal" class="btn-icon">✕</button>
        </div>
        <div class="modal-body">
          <p>热更新配置将重新加载 .env 文件中的所有配置项。</p>
          <div class="warning-box">
            <span class="warning-icon">⚠️</span>
            <div class="warning-content">
              <p><strong>注意：</strong></p>
              <ul>
                <li>某些配置项可能需要重启服务器才能生效</li>
                <li>热更新期间可能短暂影响服务</li>
                <li>建议在低峰期执行此操作</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeReloadModal" class="btn">取消</button>
          <button @click="reloadConfig" class="btn btn-warning" :disabled="isReloading">
            {{ isReloading ? '更新中...' : '确认更新' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const authStore = useAuthStore()
// 系统配置仅 root（超级管理员）可编辑
const isAdmin = computed(() => authStore.isSuperAdmin)

// 状态管理
const configData = ref({})
const envContent = ref('')
const showReloadConfirm = ref(false)
const isLoading = ref(false)
const isReloading = ref(false)
const isUpdating = ref(false)
const isValidating = ref(false)
const validationResult = ref(null)
const revealedSecrets = ref({})

// 分区图标映射
const sectionIcons = {
  server: '🖥️',
  database: '🗄️',
  deviceApi: '📡',
  sync: '🔄',
  websocket: '🔌',
  jwt: '🔐',
  security: '🛡️',
  cors: '🌐',
  performance: '📊',
  logging: '📝',
  rateLimit: '⚡'
}

// 分区标题
const sectionTitles = {
  server: '服务器配置',
  database: '数据库配置',
  deviceApi: '外部设备数据源 API',
  sync: '数据同步配置',
  websocket: 'WebSocket 配置',
  jwt: 'JWT 认证配置',
  security: '安全配置',
  cors: 'CORS 配置',
  performance: '性能监控配置',
  logging: '日志配置',
  rateLimit: '速率限制配置'
}

// 需要重启的配置
const restartRequiredKeys = ['port', 'nodeEnv', 'path', 'host', 'database']

// 获取请求配置
const getConfigRequestConfig = () => ({
  headers: {
    'X-Admin-Authenticated': 'true'
  }
})

// 获取分区图标
const getSectionIcon = (key) => {
  return sectionIcons[key] || '⚙️'
}

// 获取分区标题
const getSectionTitle = (key) => {
  return sectionTitles[key] || key
}

// 格式化配置键名
const formatKey = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/([A-Z])/g, ' $1')
    .trim()
}

// 格式化配置值
const formatValue = (value) => {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// 判断是否为敏感信息
const isSecret = (key) => {
  const secretKeywords = ['secret', 'password', 'key', 'token', 'jwt']
  return secretKeywords.some(keyword => key.toLowerCase().includes(keyword))
}

// 切换敏感信息显示
const toggleSecret = (sectionKey, key) => {
  const fullKey = `${sectionKey}.${key}`
  revealedSecrets.value[fullKey] = !revealedSecrets.value[fullKey]
}

// 判断是否需要重启
const needsRestart = (sectionKey, key) => {
  return restartRequiredKeys.some(k => key.toLowerCase().includes(k))
}

// 加载配置
const loadConfig = async () => {
  isLoading.value = true
  try {
    const response = await api.get('/config', getConfigRequestConfig())
    configData.value = response.data.data

    if (window.toast) {
      window.toast.success('配置加载成功')
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    if (window.toast) {
      window.toast.error('加载配置失败: ' + error.message)
    }
  } finally {
    isLoading.value = false
  }
}

// 加载环境变量文件
const loadEnvFile = async () => {
  try {
    const response = await api.get('/config/env-file/content', getConfigRequestConfig())
    envContent.value = response.data.data

    if (window.toast) {
      window.toast.success('环境文件加载成功')
    }
  } catch (error) {
    console.error('加载 .env 文件失败:', error)
    if (window.toast) {
      window.toast.error('加载 .env 文件失败: ' + error.message)
    }
  }
}

// 更新环境变量文件
const updateEnvFile = async () => {
  if (!isAdmin.value) {
    if (window.toast) {
      window.toast.warning('需要管理员权限')
    }
    return
  }

  isUpdating.value = true
  try {
    // 解析 .env 内容
    const updates = {}
    const lines = envContent.value.split('\n')

    lines.forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        if (key && valueParts.length > 0) {
          updates[key.trim()] = valueParts.join('=').trim()
        }
      }
    })

    const response = await api.post('/config/env-file/update', updates, getConfigRequestConfig())

    if (response.data.success) {
      if (window.toast) {
        window.toast.success('配置更新成功，请热更新或重启服务器')
      }
      await loadConfig()
    } else {
      throw new Error(response.data.message)
    }
  } catch (error) {
    console.error('更新配置失败:', error)
    if (window.toast) {
      window.toast.error('更新配置失败: ' + error.message)
    }
  } finally {
    isUpdating.value = false
  }
}

// 加载示例配置
const loadExample = async () => {
  try {
    const response = await api.get('/config/example', getConfigRequestConfig())
    envContent.value = response.data.data

    if (window.toast) {
      window.toast.success('示例配置加载成功')
    }
  } catch (error) {
    console.error('加载示例配置失败:', error)
    if (window.toast) {
      window.toast.error('加载示例配置失败: ' + error.message)
    }
  }
}

// 验证配置
const validateCurrentConfig = async () => {
  isValidating.value = true
  validationResult.value = null

  try {
    const response = await api.post('/config/validate', configData.value, getConfigRequestConfig())
    validationResult.value = response.data.data

    if (validationResult.value.valid) {
      if (window.toast) {
        window.toast.success('配置验证通过')
      }
    } else {
      if (window.toast) {
        window.toast.warning('配置验证失败: ' + validationResult.value.message)
      }
    }
  } catch (error) {
    console.error('验证配置失败:', error)
    validationResult.value = { valid: false, message: error.message }
    if (window.toast) {
      window.toast.error('验证失败: ' + error.message)
    }
  } finally {
    isValidating.value = false
  }
}

// 热更新配置
const reloadConfig = async () => {
  isReloading.value = true

  try {
    const response = await api.post('/config/reload', {}, getConfigRequestConfig())

    if (response.data.success) {
      if (window.toast) {
        window.toast.success('配置热更新成功！')
      }
      await loadConfig()
      closeReloadModal()
    } else {
      throw new Error(response.data.message)
    }
  } catch (error) {
    console.error('热更新配置失败:', error)
    if (window.toast) {
      window.toast.error('热更新配置失败: ' + error.message)
    }
  } finally {
    isReloading.value = false
  }
}

// 关闭模态框
const closeReloadModal = () => {
  showReloadConfirm.value = false
}

// 组件挂载
onMounted(() => {
  loadConfig()
  loadEnvFile()
})
</script>

<style scoped>
.config-manage {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 操作栏 */
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.action-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 0.9em;
}

.info-icon {
  font-size: 1.2em;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 卡片通用样式 */
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-icon {
  font-size: 1.3em;
}

.card-header h3 {
  margin: 0;
  font-size: 1.05em;
  font-weight: 600;
}

.config-count {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 0.75em;
}

.admin-badge {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 0.75em;
}

.card-body {
  padding: 20px;
}

/* 按钮样式 */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #545b62;
}

.btn-warning {
  background: #ffc107;
  color: #000;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background: #138496;
}

.btn .icon {
  font-size: 1.1em;
}

/* 配置分区 */
.config-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-section {
  transition: all 0.3s ease;
}

.config-section:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.config-label {
  font-size: 0.85em;
  color: #666;
  font-weight: 600;
}

.config-value-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.config-value {
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  word-break: break-all;
  flex: 1;
}

.config-value.secret {
  display: flex;
  align-items: center;
  gap: 8px;
}

.secret-text {
  color: #999;
  font-style: italic;
  letter-spacing: 2px;
}

.reveal-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.reveal-btn:hover {
  background: #f0f0f0;
}

.restart-badge {
  padding: 3px 8px;
  background: #fff3cd;
  color: #856404;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 600;
  white-space: nowrap;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 3em;
  margin-bottom: 16px;
}

/* 环境变量编辑器 */
.env-editor {
  transition: all 0.3s ease;
}

.env-editor:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.env-textarea {
  width: 100%;
  min-height: 300px;
  max-height: 500px;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.3s;
}

.env-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.readonly-notice {
  margin-top: 12px;
  padding: 10px 14px;
  background: #f0f7ff;
  border-radius: 6px;
  color: #667eea;
  font-size: 0.85em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.env-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

/* 配置验证 */
.config-validator {
  transition: all 0.3s ease;
}

.config-validator:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.validator-actions {
  display: flex;
  gap: 12px;
}

.validation-result {
  margin-top: 16px;
  border-radius: 8px;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.result-icon {
  font-size: 1.5em;
}

.result-message {
  margin: 0;
  flex: 1;
}

.validation-result.valid {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  padding: 12px 16px;
}

.validation-result.invalid {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  padding: 12px 16px;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  animation: fadeIn 0.2s;
}

.modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.2em;
  color: #333;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: #666;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.modal-body {
  padding: 24px;
}

.modal-body p {
  color: #666;
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.warning-box {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff3cd;
  border-radius: 8px;
  border: 1px solid #ffc107;
}

.warning-icon {
  font-size: 1.5em;
}

.warning-content {
  flex: 1;
}

.warning-content p {
  margin: 0 0 8px 0;
}

.warning-content p:last-child {
  margin: 0;
}

.warning-content strong {
  color: #856404;
}

.warning-content ul {
  margin: 0;
  padding-left: 20px;
}

.warning-content li {
  margin-bottom: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

/* 响应式 */
@media (max-width: 768px) {
  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }

  .config-grid {
    grid-template-columns: 1fr;
  }

  .env-actions {
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .card-body {
    padding: 16px;
  }

  .modal {
    max-width: 95%;
  }
}
</style>
