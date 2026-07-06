/**
 * 认证中间件
 * 处理用户认证和权限验证
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { ErrorCodes, createErrorResponse } = require('../utils/errorCodes');

/**
 * 验证 JWT token
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_MISSING));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_INVALID_FORMAT));
  }

  const token = parts[1];

  if (!token) {
    return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_MISSING));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_EXPIRED));
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_INVALID));
    }
    return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_INVALID));
  }
}

/**
 * 验证管理员权限
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json(createErrorResponse(ErrorCodes.AUTH.PERMISSION_DENIED));
  }
  next();
}

/**
 * 验证特定权限
 * @param {string} permission 所需权限
 * @returns {Function} 中间件函数
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_MISSING));
    }

    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json(createErrorResponse(ErrorCodes.AUTH.PERMISSION_DENIED));
    }

    next();
  };
}

/**
 * 验证资源所有权
 * @param {string} ownerField 所有者字段名
 * @returns {Function} 中间件函数
 */
function requireOwner(ownerField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(createErrorResponse(ErrorCodes.AUTH.TOKEN_MISSING));
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const resourceOwner = req.params[ownerField] || req.body[ownerField];

    if (resourceOwner && resourceOwner !== req.user.userId && resourceOwner !== req.user.id) {
      return res.status(403).json(createErrorResponse(ErrorCodes.AUTH.PERMISSION_DENIED));
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requirePermission,
  requireOwner
};
