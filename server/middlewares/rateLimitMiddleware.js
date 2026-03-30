/**
 * 速率限制中间件
 * 限制 API 请求频率
 */

const config = require('../config');

// 内存存储的速率限制数据
const rateLimitStore = {
  api: new Map(),
  sync: new Map()
};

/**
 * 清理过期的速率限制数据
 * @param {Map} store 速率限制存储
 * @param {number} windowMs 时间窗口（毫秒）
 */
function cleanupExpired(store, windowMs) {
  const now = Date.now();
  for (const [key, data] of store.entries()) {
    if (now - data.timestamp > windowMs) {
      store.delete(key);
    }
  }
}

/**
 * API 速率限制中间件
 * @returns {Function} 中间件函数
 */
function apiRateLimit() {
  const windowMs = config.rateLimit.api.windowMs;
  const max = config.rateLimit.api.max;

  return (req, res, next) => {
    // 清理过期数据
    cleanupExpired(rateLimitStore.api, windowMs);

    const key = req.ip;
    const now = Date.now();
    const data = rateLimitStore.api.get(key);

    if (data) {
      if (data.count >= max) {
        return res.status(429).json({
          success: false,
          error: '请求过于频繁，请稍后再试'
        });
      }
      // 更新计数
      data.count++;
      rateLimitStore.api.set(key, data);
    } else {
      // 新的请求
      rateLimitStore.api.set(key, {
        count: 1,
        timestamp: now
      });
    }

    next();
  };
}

/**
 * 同步速率限制中间件
 * @returns {Function} 中间件函数
 */
function syncRateLimit() {
  const windowMs = config.rateLimit.sync.windowMs;
  const max = config.rateLimit.sync.max;

  return (req, res, next) => {
    // 清理过期数据
    cleanupExpired(rateLimitStore.sync, windowMs);

    const key = req.ip;
    const now = Date.now();
    const data = rateLimitStore.sync.get(key);

    if (data) {
      if (data.count >= max) {
        return res.status(429).json({
          success: false,
          error: '同步请求过于频繁，请稍后再试'
        });
      }
      // 更新计数
      data.count++;
      rateLimitStore.sync.set(key, data);
    } else {
      // 新的请求
      rateLimitStore.sync.set(key, {
        count: 1,
        timestamp: now
      });
    }

    next();
  };
}

module.exports = {
  apiRateLimit,
  syncRateLimit
};
