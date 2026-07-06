/**
 * 认证路由
 * 处理用户认证相关的 API 请求
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { ErrorCodes, createErrorResponse } = require('../utils/errorCodes');
const { asyncHandler } = require('../middlewares/errorHandler');

router.post('/login', apiRateLimit(), asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'username', message: '用户名不能为空' }]
    ));
  }

  if (!password) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'password', message: '密码不能为空' }]
    ));
  }

  const ip = req.ip || req.connection.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';

  try {
    const result = await auth.login(username, password, ip, userAgent);
    res.json({
      success: true,
      data: {
        user: result.user,
        tokens: {
          access_token: result.accessToken,
          refresh_token: result.refreshToken
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.message === 'Invalid credentials') {
      return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.INVALID_CREDENTIALS));
    }
    throw error;
  }
}));

router.post('/refresh', apiRateLimit(), asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'refresh_token', message: '刷新 token 不能为空' }]
    ));
  }

  const result = await auth.refreshAccessToken(refresh_token);
  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}));

router.get('/me', apiRateLimit(), authenticateToken, asyncHandler(async (req, res) => {
  const user = await auth.getUserById(req.user.userId || req.user.id);

  if (!user) {
    return res.status(404).json(createErrorResponse(ErrorCodes.RESOURCE.NOT_FOUND));
  }

  res.json({
    success: true,
    data: user,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
}));

module.exports = router;
