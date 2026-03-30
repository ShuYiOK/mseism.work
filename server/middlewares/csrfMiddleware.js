/**
 * CSRF 保护中间件
 * 防止 CSRF 攻击
 */

const SecurityUtils = require('../utils/security');

// 存储 CSRF token 的映射
const csrfTokens = new Map();

/**
 * 生成 CSRF token 并存储
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function generateCsrfToken(req, res, next) {
  // 存储 token，关联到用户会话
  const sessionId = req.headers['x-session-id'] || 'test-session'; // 简化测试
  // 只有当会话ID不存在时才生成新的CSRF token
  let token = csrfTokens.get(sessionId);
  if (!token) {
    token = SecurityUtils.generateCsrfToken();
    csrfTokens.set(sessionId, token);
  }
  // 设置响应头
  res.setHeader('X-CSRF-Token', token);
  next();
}

/**
 * 验证 CSRF token
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function validateCsrfToken(req, res, next) {
  // 只验证修改操作
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionId = req.headers['x-session-id'] || 'test-session'; // 简化测试
    const storedToken = csrfTokens.get(sessionId);

    if (!token || !storedToken || !SecurityUtils.verifyCsrfToken(token, storedToken)) {
      return res.status(403).json({ success: false, error: 'CSRF token 无效' });
    }

    // 验证成功后，生成新的 token
    const newToken = SecurityUtils.generateCsrfToken();
    csrfTokens.set(sessionId, newToken);
    res.setHeader('X-CSRF-Token', newToken);
  }
  next();
}

/**
 * 清理 CSRF token
 * @param {string} sessionId 会话 ID
 */
function clearCsrfToken(sessionId) {
  csrfTokens.delete(sessionId);
}

module.exports = {
  generateCsrfToken,
  validateCsrfToken,
  clearCsrfToken
};
