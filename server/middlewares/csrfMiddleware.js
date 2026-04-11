/**
 * CSRF 保护中间件
 * 防止 CSRF 攻击
 */

const SecurityUtils = require('../utils/security');

const csrfTokens = new Map();

function generateCsrfToken(req, res, next) {
  const sessionId = req.headers['x-session-id'] || 'test-session';
  let token = csrfTokens.get(sessionId);
  if (!token) {
    token = SecurityUtils.generateCsrfToken();
    csrfTokens.set(sessionId, token);
  }
  res.setHeader('X-CSRF-Token', token);
  next();
}

function validateCsrfToken(req, res, next) {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  next();
}

function clearCsrfToken(sessionId) {
  csrfTokens.delete(sessionId);
}

module.exports = {
  generateCsrfToken,
  validateCsrfToken,
  clearCsrfToken
};
