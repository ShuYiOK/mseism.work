/**
 * 配置路由
 * 处理配置相关的 API 请求
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');
const fs = require('fs');
const path = require('path');

// 获取配置
router.get('/', apiRateLimit(), authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const config = configService.getConfig();
  res.json({ success: true, data: config });
}));

// 重新加载配置
router.post('/reload', apiRateLimit(), authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const result = configService.reloadConfig();
  res.json(result);
}));

// 验证配置
router.post('/validate', apiRateLimit(), authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ success: false, error: '配置对象不能为空' });
  }
  const result = configService.validateConfig(config);
  res.json(result);
}));

// 获取 .env 文件内容
router.get('/env-file/content', apiRateLimit(), authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      res.json({ success: true, data: content });
    } else {
      res.json({ success: true, data: '' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '读取 .env 文件失败: ' + error.message });
  }
}));

// 更新 .env 文件
router.post('/env-file/update', apiRateLimit(), authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const updates = req.body;
    const envPath = path.join(__dirname, '../.env');
    
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加环境变量
    const lines = content.split('\n');
    const updatedLines = lines.filter(line => {
      if (!line || line.startsWith('#')) return true;
      const key = line.split('=')[0].trim();
      return !updates.hasOwnProperty(key);
    });
    
    // 添加新的环境变量
    Object.entries(updates).forEach(([key, value]) => {
      updatedLines.push(`${key}=${value}`);
    });
    
    // 写入文件
    fs.writeFileSync(envPath, updatedLines.join('\n'));
    
    res.json({ success: true, message: '.env 文件更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: '更新 .env 文件失败: ' + error.message });
  }
}));

// 获取示例配置
router.get('/example', apiRateLimit(), authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const exampleContent = `# 服务器配置
PORT=3001
NODE_ENV=development

# MySQL 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_database_password_here
DB_NAME=mseism

# 外部设备数据源 API
DEVICE_API_URL=http://your-device-api-host:port/devices/list

# 数据同步配置
SYNC_INTERVAL=5000
OFFLINE_THRESHOLD=300
API_TIMEOUT=10000

# WebSocket 配置
WS_PING_TIMEOUT=60000
WS_PING_INTERVAL=25000

# JWT 认证配置
JWT_SECRET=your-secret-key-here-at-least-32-characters-long
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
JWT_ALGORITHM=HS256

# 密码加密配置
BCRYPT_ROUNDS=12

# CORS 配置
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# 安全配置
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_TIME=30

# 性能监控配置
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_ALERT_THRESHOLD=1000
SYNC_ALERT_THRESHOLD=5000

# 日志配置
LOG_LEVEL=info
ENABLE_ACCESS_LOG=true
ENABLE_ERROR_LOG=true
ENABLE_OPERATION_LOG=true

# 速率限制配置
API_RATE_LIMIT_WINDOW=60000
API_RATE_LIMIT_MAX=100
SYNC_RATE_LIMIT_WINDOW=60000
SYNC_RATE_LIMIT_MAX=10`;
    
    res.json({ success: true, data: exampleContent });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取示例配置失败: ' + error.message });
  }
}));

module.exports = router;
