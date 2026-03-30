/**
 * 认证路由
 * 处理用户认证相关的 API 请求
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');

// 异步处理中间件
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 用户登录
router.post('/login', apiRateLimit(), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
  }
  const result = await authService.login(username, password);
  res.json(result);
}));

// 刷新 token
router.post('/refresh', apiRateLimit(), asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ success: false, error: '刷新 token 不能为空' });
  }
  const result = await authService.refreshToken(refresh_token);
  res.json(result);
}));

// 获取当前用户信息
router.get('/me', apiRateLimit(), authenticateToken, asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.id);
  res.json({ success: true, data: user });
}));

module.exports = router;
