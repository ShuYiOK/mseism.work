<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>🔐 设备监控系统</h1>
        <p class="subtitle">登录到管理后台</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            placeholder="请输入用户名"
            required
            :disabled="loading"
            class="form-input"
            autocomplete="username"
          />
        </div>

        <div class="form-group password-group">
          <label for="password">密码</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="formData.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              required
              :disabled="loading"
              class="form-input password-input"
              autocomplete="current-password"
            />
            <button
              type="button"
              @click="togglePasswordVisibility"
              class="password-toggle-btn"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              tabindex="-1"
            >
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>

        <div class="login-footer">
          <router-link to="/" class="back-link">返回设备列表</router-link>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const formData = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const handleLogin = async () => {
  try {
    error.value = ''
    loading.value = true

    await authStore.login(formData.value.username, formData.value.password)

    router.push('/admin/groups')

    formData.value = {
      username: '',
      password: ''
    }
  } catch (err) {
    error.value = err.message || '登录失败，请检查用户名和密码'
    console.error('登录错误:', err)
  } finally {
    loading.value = false
    showPassword.value = false
  }
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    router.push('/admin/groups')
  }
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  background: rgba(255, 255, 255, 0.95);
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #667eea;
  font-size: 2em;
  margin: 0 0 10px 0;
}

.subtitle {
  color: #666;
  margin: 0;
}

.error-message {
  background: #ffebee;
  color: #d32f2f;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  text-align: center;
  font-size: 0.9em;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
  font-size: 0.9em;
}

.password-group {
  position: relative;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1em;
  transition: all 0.3s ease;
}

.password-input {
  padding-right: 55px;
}

.password-toggle-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  font-size: 20px;
  padding: 8px;
  cursor: pointer;
  color: #666;
  border-radius: 8px;
  transition: all 0.2s ease;
  user-select: none;
}

.password-toggle-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.password-toggle-btn:active {
  transform: translateY(-50%) scale(0.95);
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.login-btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.back-link {
  display: block;
  color: #667eea;
  text-decoration: none;
  font-weight: bold;
  transition: all 0.3s ease;
}

.back-link:hover {
  text-decoration: underline;
}

@media (max-width: 480px) {
  .login-container {
    padding: 30px 20px;
  }
}
</style>