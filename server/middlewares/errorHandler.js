/**
 * 统一错误处理模块
 * 提供标准化的错误类型和错误处理机制
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = '认证失败') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = '权限不足') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(resource = '资源') {
    super(`${resource}不存在`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = '请求过于频繁') {
    super(message, 429, 'RATE_LIMIT');
  }
}

class DatabaseError extends AppError {
  constructor(message = '数据库错误') {
    super(message, 500, 'DB_ERROR');
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = '外部服务错误') {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

const errorHandler = (err, req, res, _next) => {
  const logger = require('./logger');

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || '服务器内部错误';

  if (statusCode === 500 && !err.isOperational) {
    logger.error('未处理的异常:', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  }

  const response = {
    success: false,
    error: {
      code,
      message: err.isOperational ? message : '服务器内部错误'
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const validateRequired = (obj, fields) => {
  const missing = [];
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    throw new ValidationError(`缺少必要字段: ${missing.join(', ')}`, { missing });
  }
};

const validateType = (value, type, fieldName) => {
  if (typeof value !== type) {
    throw new ValidationError(`${fieldName} 类型错误，期望 ${type}`, {
      field: fieldName,
      expected: type,
      actual: typeof value
    });
  }
};

const validateRange = (value, min, max, fieldName) => {
  if (value < min || value > max) {
    throw new ValidationError(`${fieldName} 超出范围 [${min}, ${max}]`, {
      field: fieldName,
      value,
      min,
      max
    });
  }
};

const validateEnum = (value, allowedValues, fieldName) => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} 无效，可选值: ${allowedValues.join(', ')}`, {
      field: fieldName,
      value,
      allowed: allowedValues
    });
  }
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  validateRequired,
  validateType,
  validateRange,
  validateEnum
};
