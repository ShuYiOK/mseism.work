/**
 * 速率限制中间件 - 支持分布式
 * 限制 API 请求频率
 * 支持 Redis 存储（分布式部署）和内存存储（单实例部署）
 */

const config = require('../config');
const { getRedisClient, isRedisConnected } = require('../redis');

// 内存存储的速率限制数据（降级方案）
const rateLimitStore = {
  api: new Map(),
  sync: new Map()
};

// Redis 键前缀
const REDIS_PREFIX = 'ratelimit:';

/**
 * 清理过期的速率限制数据（内存存储）
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
 * 使用 Redis 进行速率限制检查
 * @param {string} key Redis 键
 * @param {number} windowMs 时间窗口（毫秒）
 * @param {number} max 最大请求数
 * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
 */
async function checkRateLimitRedis(key, windowMs, max) {
  const redis = getRedisClient();
  if (!redis) {
    throw new Error('Redis 未连接');
  }

  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = REDIS_PREFIX + key;

  try {
    // 使用 Redis 事务确保原子性
    const result = await redis
      .multi()
      .zremrangebyscore(redisKey, 0, windowStart)
      .zcard(redisKey)
      .zadd(redisKey, now, `${now}-${Math.random().toString(36).substr(2, 9)}`)
      .expire(redisKey, Math.ceil(windowMs / 1000))
      .exec();

    const count = result[1][1]; // zcard 结果
    const remaining = Math.max(0, max - count - 1);
    const resetTime = now + windowMs;

    return {
      allowed: count < max,
      remaining,
      resetTime
    };
  } catch (error) {
    console.error('[RateLimit] Redis 操作失败:', error.message);
    throw error;
  }
}

/**
 * 使用内存进行速率限制检查
 * @param {string} key 标识键
 * @param {number} windowMs 时间窗口（毫秒）
 * @param {number} max 最大请求数
 * @param {Map} store 存储映射
 * @returns {{allowed: boolean, remaining: number, resetTime: number}}
 */
function checkRateLimitMemory(key, windowMs, max, store) {
  const now = Date.now();
  const data = store.get(key);

  if (data) {
    // 检查是否在时间窗口内
    if (now - data.timestamp > windowMs) {
      // 重置计数
      store.set(key, { count: 1, timestamp: now });
      return {
        allowed: true,
        remaining: max - 1,
        resetTime: now + windowMs
      };
    }

    if (data.count >= max) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: data.timestamp + windowMs
      };
    }

    // 更新计数
    data.count++;
    store.set(key, data);
    return {
      allowed: true,
      remaining: max - data.count,
      resetTime: data.timestamp + windowMs
    };
  }

  // 新的请求
  store.set(key, { count: 1, timestamp: now });
  return {
    allowed: true,
    remaining: max - 1,
    resetTime: now + windowMs
  };
}

/**
 * 创建速率限制中间件
 * @param {object} options 配置选项
 * @param {number} options.windowMs 时间窗口（毫秒）
 * @param {number} options.max 最大请求数
 * @param {string} options.type 类型标识
 * @param {string} options.message 错误消息
 * @param {Map} options.store 内存存储
 * @returns {Function} 中间件函数
 */
function createRateLimitMiddleware(options) {
  const { windowMs, max, type, message, store } = options;

  return async (req, res, next) => {
    const key = `${type}:${req.ip}`;
    let result;

    // 优先使用 Redis（分布式支持）
    if (isRedisConnected()) {
      try {
        result = await checkRateLimitRedis(key, windowMs, max);
      } catch (error) {
        // Redis 失败时降级到内存存储
        console.warn('[RateLimit] Redis 失败，降级到内存存储');
        cleanupExpired(store, windowMs);
        result = checkRateLimitMemory(req.ip, windowMs, max, store);
      }
    } else {
      // 使用内存存储
      cleanupExpired(store, windowMs);
      result = checkRateLimitMemory(req.ip, windowMs, max, store);
    }

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', result.resetTime);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      });
    }

    next();
  };
}

/**
 * API 速率限制中间件
 * @returns {Function} 中间件函数
 */
function apiRateLimit() {
  return createRateLimitMiddleware({
    windowMs: config.rateLimit.api.windowMs,
    max: config.rateLimit.api.max,
    type: 'api',
    message: '请求过于频繁，请稍后再试',
    store: rateLimitStore.api
  });
}

/**
 * 同步速率限制中间件
 * @returns {Function} 中间件函数
 */
function syncRateLimit() {
  return createRateLimitMiddleware({
    windowMs: config.rateLimit.sync.windowMs,
    max: config.rateLimit.sync.max,
    type: 'sync',
    message: '同步请求过于频繁，请稍后再试',
    store: rateLimitStore.sync
  });
}

/**
 * 获取限流统计信息
 * @returns {object} 统计信息
 */
function getStats() {
  return {
    memory: {
      api: rateLimitStore.api.size,
      sync: rateLimitStore.sync.size
    },
    redis: {
      enabled: isRedisConnected()
    }
  };
}

module.exports = {
  apiRateLimit,
  syncRateLimit,
  getStats
};
