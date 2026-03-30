/**
 * 错误处理中间件
 * 统一处理错误响应格式
 */

/**
 * 错误处理中间件
 * @param {Error} err 错误对象
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function errorHandler(err, req, res, next) {
  console.error('错误:', err);

  // 统一错误响应格式
  const errorResponse = {
    success: false,
    error: err.message || '服务器内部错误'
  };

  // 根据错误类型设置不同的状态码
  if (err.name === 'ValidationError') {
    return res.status(400).json(errorResponse);
  }

  if (err.message.includes('未提供认证')) {
    return res.status(401).json(errorResponse);
  }

  if (err.message.includes('权限')) {
    return res.status(403).json(errorResponse);
  }

  if (err.message.includes('不存在')) {
    return res.status(404).json(errorResponse);
  }

  // 默认 500 服务器内部错误
  res.status(500).json(errorResponse);
}

/**
 * 404 处理中间件
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 * @param {Function} next 下一个中间件
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`请求的路径 ${req.originalUrl} 不存在`);
  error.status = 404;
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
