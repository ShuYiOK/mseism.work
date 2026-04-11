/**
 * 缓存模块 - 优化版
 * 本地内存缓存，用于优化数据库查询性能
 * 使用分组存储优化缓存清理效率
 * 注意：单实例部署使用。如需多实例共享缓存，需配置 Redis
 */

const cacheStore = new Map();
const cacheExpiry = new Map();

// 缓存分组 - 按类型存储键名，提高清理效率
const cacheGroups = {
  devices: new Set(),  // 设备相关缓存
  groups: new Set(),   // 分组相关缓存
  stats: new Set(),    // 统计相关缓存
  mappings: new Set()  // 映射相关缓存
};

const CONFIG = {
  DEVICES_TTL: 60 * 1000,
  GROUPS_TTL: 300 * 1000,
  STATS_TTL: 60 * 1000,
  MAPPINGS_TTL: 300 * 1000,
};

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

// 根据键名判断所属分组
function getKeyGroup(key) {
  if (key.includes('device') || key.includes('devices:')) {
    return 'devices';
  }
  if (key.includes('group') || key.includes('groups:')) {
    return 'groups';
  }
  if (key.includes('stats')) {
    return 'stats';
  }
  if (key.includes('mappings')) {
    return 'mappings';
  }
  return null;
}

function set(key, value, ttl = CONFIG.DEVICES_TTL) {
  cacheStore.set(key, value);
  cacheExpiry.set(key, Date.now() + ttl);
  
  // 添加到对应分组
  const group = getKeyGroup(key);
  if (group && cacheGroups[group]) {
    cacheGroups[group].add(key);
  }
}

function get(key) {
  const item = cacheStore.get(key);
  if (!item) {
    return null;
  }
  const expiry = cacheExpiry.get(key);
  if (expiry && Date.now() > expiry) {
    // 过期时同时从分组中移除
    const group = getKeyGroup(key);
    if (group && cacheGroups[group]) {
      cacheGroups[group].delete(key);
    }
    cacheStore.delete(key);
    cacheExpiry.delete(key);
    return null;
  }
  return item;
}

function del(key) {
  // 从分组中移除
  const group = getKeyGroup(key);
  if (group && cacheGroups[group]) {
    cacheGroups[group].delete(key);
  }
  cacheStore.delete(key);
  cacheExpiry.delete(key);
}

function clear() {
  cacheStore.clear();
  cacheExpiry.clear();
  // 清空所有分组
  Object.values(cacheGroups).forEach(group => group.clear());
}

// 优化版：直接使用分组清理设备缓存
function clearDeviceCache() {
  const keysToDelete = [...cacheGroups.devices];
  keysToDelete.forEach(key => {
    cacheStore.delete(key);
    cacheExpiry.delete(key);
  });
  cacheGroups.devices.clear();
}

// 优化版：直接使用分组清理分组缓存
function clearGroupCache() {
  const keysToDelete = [...cacheGroups.groups];
  keysToDelete.forEach(key => {
    cacheStore.delete(key);
    cacheExpiry.delete(key);
  });
  cacheGroups.groups.clear();
}

// 清理统计缓存
function clearStatsCache() {
  const keysToDelete = [...cacheGroups.stats];
  keysToDelete.forEach(key => {
    cacheStore.delete(key);
    cacheExpiry.delete(key);
  });
  cacheGroups.stats.clear();
}

// 清理映射缓存
function clearMappingsCache() {
  const keysToDelete = [...cacheGroups.mappings];
  keysToDelete.forEach(key => {
    cacheStore.delete(key);
    cacheExpiry.delete(key);
  });
  cacheGroups.mappings.clear();
}

// 获取缓存统计信息
function getStats() {
  return {
    totalKeys: cacheStore.size,
    groups: {
      devices: cacheGroups.devices.size,
      groups: cacheGroups.groups.size,
      stats: cacheGroups.stats.size,
      mappings: cacheGroups.mappings.size
    }
  };
}

// 清理过期缓存（可定时调用）
function cleanupExpired() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, expiry] of cacheExpiry.entries()) {
    if (now > expiry) {
      del(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

module.exports = {
  set,
  get,
  del,
  clear,
  clearDeviceCache,
  clearGroupCache,
  clearStatsCache,
  clearMappingsCache,
  getStats,
  cleanupExpired,
  KEYS,
  CONFIG,
};
