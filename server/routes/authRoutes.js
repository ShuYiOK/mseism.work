/**
 * 认证路由
 * 处理用户认证相关的 API 请求
 */

const express = require('express');
const router = express.Router();
const auth = require('../auth');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { authenticateToken, requireSuperAdmin } = require('../middlewares/authMiddleware');
const { ErrorCodes, createErrorResponse } = require('../utils/errorCodes');
const { asyncHandler } = require('../middlewares/errorHandler');

// 通用：所有认证相关接口都要过频率限制
router.use(apiRateLimit());

// ============== 公开接口 ==============

router.post('/login', asyncHandler(async (req, res) => {
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

  const ip = req.ip || req.connection?.remoteAddress || '';
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
    // 登录失败统一返回 INVALID_CREDENTIALS，避免泄露用户是否存在
    if (error.message.includes('用户名或密码错误') || error.message.includes('密码错误')) {
      return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.INVALID_CREDENTIALS));
    }
    // 账户锁定/未激活等业务错误，原样返回
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_ERROR', message: error.message }
    });
  }
}));

// 刷新访问 token
router.post('/refresh', asyncHandler(async (req, res) => {
  // 兼容 snake_case 与 camelCase
  const refresh_token = req.body.refresh_token || req.body.refreshToken;

  if (!refresh_token) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'refresh_token', message: '刷新 token 不能为空' }]
    ));
  }

  try {
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
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'AUTH_TOKEN_INVALID', message: error.message }
    });
  }
}));

// 登出（撤销刷新 token）
router.post('/logout', asyncHandler(async (req, res) => {
  // 兼容 snake_case 与 camelCase
  const refresh_token = req.body.refresh_token || req.body.refreshToken;

  if (!refresh_token) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'refresh_token', message: '刷新 token 不能为空' }]
    ));
  }

  try {
    await auth.logout(refresh_token);
    res.json({ success: true, message: '登出成功' });
  } catch (error) {
    // 即使 token 无效也认为登出成功（幂等）
    res.json({ success: true, message: '登出成功' });
  }
}));

// 注册（默认仅创建普通用户，role 不信任前端）
router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'credentials', message: '用户名、邮箱和密码不能为空' }]
    ));
  }

  try {
    // 出于安全考虑，公开注册只创建 user 角色，忽略前端传入的 role
    const user = await auth.register(username, email, password, 'user');
    res.json({ success: true, data: user });
  } catch (error) {
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
}));

// ============== 需要登录的接口 ==============

// 获取当前用户信息
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const user = await auth.getUserById(req.user.userId || req.user.id);

  if (!user) {
    return res.status(404).json(createErrorResponse(ErrorCodes.RESOURCE.NOT_FOUND));
  }

  res.json({
    success: true,
    data: user,
    meta: { timestamp: new Date().toISOString() }
  });
}));

// 修改自己的密码
router.post('/change-password', authenticateToken, asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'passwords', message: '旧密码和新密码不能为空' }]
    ));
  }

  const userId = req.user.userId || req.user.id;
  const ip = req.ip || req.connection?.remoteAddress || '';
  const userAgent = req.get('User-Agent') || '';

  try {
    await auth.changePassword(userId, oldPassword, newPassword, ip, userAgent);
    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
}));

// 撤销自己的所有刷新 token（强制其他设备下线）
router.post('/revoke-all', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.userId || req.user.id;
  await auth.revokeAllTokens(userId);
  res.json({ success: true, message: '所有会话已撤销' });
}));

// ============== 仅管理员可用的接口 ==============

// 获取所有用户
router.get('/users', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const users = await auth.getAllUsers();
  res.json({ success: true, data: users });
}));

// 获取指定用户
router.get('/users/:id', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = await auth.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json(createErrorResponse(ErrorCodes.RESOURCE.NOT_FOUND));
  }
  res.json({ success: true, data: user });
}));

// 更新用户信息（角色、激活状态等）
router.put('/users/:id', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    const user = await auth.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
}));

// 管理员重置用户密码
router.post('/users/:id/reset-password', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json(createErrorResponse(
      ErrorCodes.VALIDATION.MISSING_REQUIRED_FIELD,
      [{ field: 'newPassword', message: '新密码不能为空' }]
    ));
  }

  try {
    await auth.resetPassword(req.params.id, newPassword);
    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
}));

// 删除用户
router.delete('/users/:id', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  try {
    await auth.deleteUser(req.params.id);
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    return res.status(400).json({ success: false, error: { message: error.message } });
  }
}));

// 获取审计日志
router.get('/audit-logs', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const userId = req.query.userId || null;
  const logs = await auth.getAuditLogs(limit, userId);
  res.json({ success: true, data: logs });
}));

// 清理过期 token（管理员手动触发）
router.post('/cleanup-tokens', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  await auth.cleanupExpiredTokens();
  res.json({ success: true, message: '过期 token 清理完成' });
}));

module.exports = router;
