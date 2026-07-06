/**
 * 缓存优化模块
 * 提供多级缓存、Redis支持、智能缓存失效等功能
 */

const { performanceOptimizer } = require('./performanceOptimizer');

class MultiLevelCache {
  constructor() {
    this.l1Cache = new Map();
    this.l1Expiry = new Map();
    this.l1Ttl = 5000;
    this.redisClient = null;
    this.redisEnabled = false;
    this.hitCount = 0;
    this.missCount = 0;
  }
  
  async initRedis(options = {}) {
    if (options.enabled && options.client) {
      this.redisClient = options.client;
      this.redisEnabled = true;
      console.log('[缓存] Redis已启用');
    }
  }
  
  set(key, value, ttl = 60000) {
    this.l1Cache.set(key, value);
    this.l1Expiry.set(key, Date.now() + this.l1Ttl);
    
    if (this.redisEnabled && this.redisClient) {
      this.redisClient.setEx(key, ttl / 1000, JSON.stringify(value)).catch(err => {
        console.warn('[缓存] Redis写入失败:', err.message);
      });
    }
  }
  
  async get(key) {
    const l1Value = this.getFromL1(key);
    if (l1Value !== null) {
      this.hitCount++;
      performanceOptimizer.recordCacheHit(true);
      return l1Value;
    }
    
    if (this.redisEnabled && this.redisClient) {
      try {
        const l2Value = await this.redisClient.get(key);
        if (l2Value) {
          const parsed = JSON.parse(l2Value);
          this.setToL1(key, parsed);
          this.hitCount++;
          performanceOptimizer.recordCacheHit(true);
          return parsed;
        }
      } catch (err) {
        console.warn('[缓存] Redis读取失败:', err.message);
      }
    }
    
    this.missCount++;
    performanceOptimizer.recordCacheHit(false);
    return null;
  }
  
  getFromL1(key) {
    const value = this.l1Cache.get(key);
    if (!value) return null;
    
    const expiry = this.l1Expiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.l1Cache.delete(key);
      this.l1Expiry.delete(key);
      return null;
    }
    return value;
  }
  
  setToL1(key, value) {
    this.l1Cache.set(key, value);
    this.l1Expiry.set(key, Date.now() + this.l1Ttl);
  }
  
  del(key) {
    this.l1Cache.delete(key);
    this.l1Expiry.delete(key);
    
    if (this.redisEnabled && this.redisClient) {
      this.redisClient.del(key).catch(err => {
        console.warn('[缓存] Redis删除失败:', err.message);
      });
    }
  }
  
  clear() {
    this.l1Cache.clear();
    this.l1Expiry.clear();
    
    if (this.redisEnabled && this.redisClient) {
      this.redisClient.flushDb().catch(err => {
        console.warn('[缓存] Redis清空失败:', err.message);
      });
    }
  }
  
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      l1Size: this.l1Cache.size
    };
  }
  
  reset() {
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// 缓存键生成器
class CacheKeyBuilder {
  static PREFIX = 'mseism';
  
  static devices() {
    return `${this.PREFIX}:devices`;
  }
  
  static device(id) {
    return `${this.PREFIX}:device:${id}`;
  }
  
  static deviceStats() {
    return `${this.PREFIX}:devices:stats`;
  }
  
  static onlineDevices() {
    return `${this.PREFIX}:devices:online`;
  }
  
  static offlineDevices() {
    return `${this.PREFIX}:devices:offline`;
  }
  
  static groups() {
    return `${this.PREFIX}:groups`;
  }
  
  static group(id) {
    return `${this.PREFIX}:group:${id}`;
  }
  
  static groupsWithDevices() {
    return `${this.PREFIX}:groups:with_devices`;
  }
  
  static devicesWithGroups() {
    return `${this.PREFIX}:devices:with_groups`;
  }
  
  static user(id) {
    return `${this.PREFIX}:user:${id}`;
  }
  
  static session(id) {
    return `${this.PREFIX}:session:${id}`;
  }
  
  static pattern(prefix) {
    return `${this.PREFIX}:${prefix}:*`;
  }
}

// 缓存预热器
class CacheWarmer {
  constructor(cache, deviceService, groupService) {
    this.cache = cache;
    this.deviceService = deviceService;
    this.groupService = groupService;
    this.warmingInterval = null;
  }
  
  async warmAll() {
    console.log('[缓存预热] 开始预热缓存...');
    
    try {
      await Promise.all([
        this.warmDevices(),
        this.warmStats(),
        this.warmGroups()
      ]);
      
      console.log('[缓存预热] 缓存预热完成');
      return true;
    } catch (error) {
      console.error('[缓存预热] 预热失败:', error.message);
      return false;
    }
  }
  
  async warmDevices() {
    try {
      const devices = await this.deviceService.getAllDevices();
      this.cache.set(CacheKeyBuilder.devices(), devices, 60000);
      console.log(`[缓存预热] 设备列表已缓存，共 ${devices.length} 条`);
    } catch (error) {
      console.warn('[缓存预热] 设备列表预热失败:', error.message);
    }
  }
  
  async warmStats() {
    try {
      const stats = await this.deviceService.getDeviceStats();
      this.cache.set(CacheKeyBuilder.deviceStats(), stats, 30000);
      console.log('[缓存预热] 设备统计已缓存');
    } catch (error) {
      console.warn('[缓存预热] 设备统计预热失败:', error.message);
    }
  }
  
  async warmGroups() {
    try {
      const groups = await this.groupService.getAllGroups();
      this.cache.set(CacheKeyBuilder.groups(), groups, 300000);
      console.log(`[缓存预热] 分组列表已缓存，共 ${groups.length} 条`);
    } catch (error) {
      console.warn('[缓存预热] 分组列表预热失败:', error.message);
    }
  }
  
  startPeriodicWarming(intervalMs = 300000) {
    if (this.warmingInterval) return;
    
    this.warmingInterval = setInterval(() => {
      this.warmAll();
    }, intervalMs);
    
    console.log(`[缓存预热] 定期预热已启动，间隔: ${intervalMs / 1000}秒`);
  }
  
  stopPeriodicWarming() {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
    }
  }
}

// 缓存失效策略
class CacheInvalidator {
  constructor(cache) {
    this.cache = cache;
  }
  
  invalidateDevice(deviceId = null) {
    if (deviceId) {
      this.cache.del(CacheKeyBuilder.device(deviceId));
    }
    this.cache.del(CacheKeyBuilder.devices());
    this.cache.del(CacheKeyBuilder.onlineDevices());
    this.cache.del(CacheKeyBuilder.offlineDevices());
    this.cache.del(CacheKeyBuilder.devicesWithGroups());
  }
  
  invalidateStats() {
    this.cache.del(CacheKeyBuilder.deviceStats());
  }
  
  invalidateGroup(groupId = null) {
    if (groupId) {
      this.cache.del(CacheKeyBuilder.group(groupId));
    }
    this.cache.del(CacheKeyBuilder.groups());
    this.cache.del(CacheKeyBuilder.groupsWithDevices());
    this.cache.del(CacheKeyBuilder.devicesWithGroups());
  }
  
  invalidateAll() {
    this.cache.clear();
  }
}

// 创建单例实例
const multiLevelCache = new MultiLevelCache();

module.exports = {
  multiLevelCache,
  MultiLevelCache,
  CacheKeyBuilder,
  CacheWarmer,
  CacheInvalidator
};
