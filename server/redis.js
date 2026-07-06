/**
 * Redis 连接模块
 * 提供单例 Redis 客户端，支持分布式限流和缓存
 */

const Redis = require('ioredis');
const config = require('./config');

let redisClient = null;
let isConnected = false;

/**
 * 初始化 Redis 连接
 * @returns {Promise<Redis|null>} Redis 客户端或 null
 */
async function initRedis() {
  if (!config.redis?.enabled) {
    console.log('[Redis] Redis 未启用，使用内存存储');
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[Redis] 连接重试次数过多，停止重试');
          return null;
        }
        console.log(`[Redis] 正在重试连接... (${times})`);
        return Math.min(times * 1000, 5000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on('connect', () => {
      console.log('[Redis] 正在连接...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      console.log('[Redis] 连接成功');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] 连接错误:', err.message);
    });

    redisClient.on('close', () => {
      isConnected = false;
      console.log('[Redis] 连接已关闭');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] 正在重新连接...');
    });

    await redisClient.ping();
    return redisClient;
  } catch (error) {
    console.error('[Redis] 初始化失败:', error.message);
    redisClient = null;
    return null;
  }
}

/**
 * 获取 Redis 客户端
 * @returns {Redis|null}
 */
function getRedisClient() {
  return redisClient;
}

/**
 * 检查 Redis 是否已连接
 * @returns {boolean}
 */
function isRedisConnected() {
  return isConnected && redisClient !== null;
}

/**
 * 关闭 Redis 连接
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    console.log('[Redis] 连接已关闭');
  }
}

/**
 * Redis 健康检查
 * @returns {Promise<{connected: boolean, latency?: number}>}
 */
async function healthCheck() {
  if (!redisClient) {
    return { connected: false };
  }

  try {
    const start = Date.now();
    await redisClient.ping();
    return {
      connected: true,
      latency: Date.now() - start
    };
  } catch (error) {
    return { connected: false };
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  isRedisConnected,
  closeRedis,
  healthCheck
};
