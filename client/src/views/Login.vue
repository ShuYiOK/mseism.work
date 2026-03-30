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
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="formData.password"
            type="password"
            placeholder="请输入密码"
            required
            :disabled="loading"
            class="form-input"
          />
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>

        <div class="login-footer">
          <p class="hint">默认管理员账户: admin / admin123</p>
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
import { useDeviceStore } from '../stores/devices'

const router = useRouter()
const authStore = useAuthStore()
const deviceStore = useDeviceStore()

const formData = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  try {
    error.value = ''
    loading.value = true

    // 调用登录方法
    await authStore.login(formData.value.username, formData.value.password)

    // 登录成功后跳转到管理页面
    router.push('/admin/groups')

    // 清空表单
    formData.value = {
      username: '',
      password: ''
    }
  } catch (err) {
    error.value = err.message || '登录失败，请检查用户名和密码'
    console.error('登录错误:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // 如果已经登录，直接跳转到管理页面
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

.form-input {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1em;
  transition: all 0.3s ease;
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

.hint {
  color: #999;
  font-size: 0.85em;
  margin-bottom: 15px;
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
