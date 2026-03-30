/**
 * 缓存模块
 * 提供内存缓存功能，用于优化数据库查询性能
 */

// 缓存存储
const cacheStore = new Map();

// 缓存配置
const CONFIG = {
  // 缓存过期时间（毫秒）
  DEVICES_TTL: 60 * 1000, // 1分钟
  GROUPS_TTL: 300 * 1000, // 5分钟
  STATS_TTL: 60 * 1000, // 1分钟
  MAPPINGS_TTL: 300 * 1000, // 5分钟
};

// 缓存键名
const KEYS = {
  ALL_DEVICES: 'devices:all',
  DEVICE_BY_ID: (id) => `device:${id}`,
  DEVICE_STATS: 'devices:stats',
  ALL_GROUPS: 'groups:all',
  GROUP_BY_ID: (id) => `group:${id}`,
  GROUPS_WITH_DEVICES: 'groups:with_devices',
  DEVICES_WITH_GROUPS: 'devices:with_groups',
  DEVICE_GROUP_MAPPINGS: 'mappings:device_group',
  GROUP_STATS: 'groups:stats',
  ONLINE_DEVICES: 'devices:online',
  OFFLINE_DEVICES: 'devices:offline',
};

/**
 * 设置缓存
 * @param {string} key 缓存键
 * @param {*} value 缓存值
 * @param {number} ttl 过期时间（毫秒）
 */
function set(key, value, ttl = CONFIG.DEVICES_TTL) {
  const item = {
    value,
    expiry: Date.now() + ttl,
  };
  cacheStore.set(key, item);
}

/**
 * 获取缓存
 * @param {string} key 缓存键
 * @returns {*} 缓存值，过期返回null
 */
function get(key) {
  const item = cacheStore.get(key);
  if (!item) {
    return null;
  }
  if (Date.now() > item.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return item.value;
}

/**
 * 删除缓存
 * @param {string} key 缓存键
 */
function del(key) {
  cacheStore.delete(key);
}

/**
 * 清除所有缓存
 */
function clear() {
  cacheStore.clear();
}

/**
 * 清除设备相关缓存
 */
function clearDeviceCache() {
  for (const key of cacheStore.keys()) {
    if (key.startsWith('device:') || key.startsWith('devices:')) {
      cacheStore.delete(key);
    }
  }
}

/**
 * 清除分组相关缓存
 */
function clearGroupCache() {
  for (const key of cacheStore.keys()) {
    if (key.startsWith('group:') || key.startsWith('groups:')) {
      cacheStore.delete(key);
    }
  }
}

module.exports = {
  set,
  get,
  del,
  clear,
  clearDeviceCache,
  clearGroupCache,
  KEYS,
  CONFIG,
};