<template>
  <div class="auth-page">
    <div class="auth-container">
      <h1>🔐 后台管理</h1>
      <p class="auth-desc">请输入管理员账号密码访问后台管理功能</p>

      <form @submit.prevent="handleLogin" class="auth-form">
        <input
          type="text"
          v-model="username"
          placeholder="用户名 (admin / root)"
          class="text-input"
          autocomplete="username"
        />
        <input
          type="password"
          v-model="password"
          placeholder="密码"
          class="password-input"
          autocomplete="current-password"
        />
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '验证中...' : '进入' }}
        </button>
      </form>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <div class="auth-footer">
        <router-link to="/" class="back-link">← 返回设备列表</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('admin')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  if (!username.value.trim()) {
    error.value = '请输入用户名'
    return
  }
  if (!password.value.trim()) {
    error.value = '请输入密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await authStore.login(username.value, password.value)

    if (authStore.isAdmin) {
      sessionStorage.setItem('adminAuthenticated', 'true')
      sessionStorage.setItem('adminAuthTime', Date.now().toString())
      router.push('/admin')
    } else {
      error.value = '非管理员账号，无权访问后台'
      authStore.logout()
    }
  } catch (err) {
    error.value = err.message || '登录失败，请检查账号密码'
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-container {
  background: rgba(255, 255, 255, 0.98);
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.auth-container h1 {
  color: #667eea;
  font-size: 1.8em;
  margin-bottom: 10px;
}

.auth-desc {
  color: #666;
  margin-bottom: 30px;
  font-size: 0.95em;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.text-input,
.password-input {
  padding: 15px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 1.1em;
  text-align: center;
  transition: border-color 0.3s ease;
}

.text-input:focus,
.password-input:focus {
  outline: none;
  border-color: #667eea;
}

.login-btn {
  padding: 15px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
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

.error-msg {
  color: #f44336;
  margin-top: 15px;
  font-size: 0.95em;
}

.auth-footer {
  margin-top: 25px;
  padding-top: 25px;
  border-top: 1px solid #e0e0e0;
}

.back-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.back-link:hover {
  color: #5568d3;
}

@media (max-width: 480px) {
  .auth-container {
    padding: 30px 25px;
  }
}
</style>
