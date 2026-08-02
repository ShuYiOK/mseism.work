/**
 * 错误处理中间件（统一入口）
 *
 * 历史问题：本文件曾用字符串匹配（err.message.includes('权限')）判断状态码，
 * 与中文错误消息强耦合且脆弱。middlewares/errorHandler.js 中已有基于
 * err.statusCode / err.code 的规范实现，这里直接委托，保持引用路径不变。
 *
 * errorMiddleware 对外暴露：
 *   - errorHandler:    统一错误处理（委托给 errorHandler.js 的规范版）
 *   - notFoundHandler: 404 处理
 */

const { errorHandler: standardErrorHandler, NotFoundError } = require('./errorHandler');

/**
 * 统一错误处理中间件
 * 委托给 errorHandler.js 的规范实现（基于 err.statusCode / err.code）。
 * 对没有 statusCode 的原生错误（如数据库驱动抛出的 Error），按 500 处理。
 */
function errorHandler(err, req, res, next) {
  return standardErrorHandler(err, req, res, next);
}

/**
 * 404 处理中间件
 * 抛出 NotFoundError，交由 errorHandler 统一响应。
 */
function notFoundHandler(req, res, next) {
  next(new NotFoundError(`路径 ${req.originalUrl}`));
}

module.exports = {
  errorHandler,
  notFoundHandler
};
