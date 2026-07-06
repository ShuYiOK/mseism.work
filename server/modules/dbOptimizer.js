/**
 * 数据库性能优化模块
 * 提供索引优化、查询优化、连接池优化等功能
 */

const db = require('../database');
const cache = require('../cache');

const CONFIG = {
  // 查询优化配置
  QUERY: {
    DEFAULT_LIMIT: 100,
    MAX_LIMIT: 1000,
    ENABLE_SLOW_QUERY_LOG: true,
    SLOW_QUERY_THRESHOLD: 100, // 毫秒
  },
  
  // 连接池优化配置
  POOL: {
    MIN_CONNECTIONS: 5,
    MAX_CONNECTIONS: 20,
    IDLE_TIMEOUT: 60000,
    CONNECTION_TIMEOUT: 10000,
    QUEUE_LIMIT: 100,
  },
  
  // 缓存优化配置
  CACHE: {
    DEVICES_TTL: 60000,
    STATS_TTL: 30000,
    GROUPS_TTL: 300000,
  }
};

// 性能监控
const slowQueryLog = [];
const MAX_SLOW_QUERIES = 100;

function logSlowQuery(sql, duration, params) {
  if (duration > CONFIG.QUERY.SLOW_QUERY_THRESHOLD) {
    slowQueryLog.push({
      sql,
      duration,
      params,
      timestamp: Date.now()
    });
    if (slowQueryLog.length > MAX_SLOW_QUERIES) {
      slowQueryLog.shift();
    }
    console.warn(`[慢查询] ${duration}ms: ${sql.substring(0, 100)}`);
  }
}

// 优化查询：只选择必要字段
async function queryOptimized(sql, params = [], options = {}) {
  const startTime = Date.now();
  
  try {
    const result = await db.query(sql, params);
    const duration = Date.now() - startTime;
    logSlowQuery(sql, duration, params);
    return result;
  } catch (error) {
    console.error('[查询优化] 查询失败:', error.message);
    throw error;
  }
}

// 优化获取所有设备 - 只选择必要字段
async function getAllDevicesOptimized() {
  const cacheKey = cache.KEYS.ALL_DEVICES;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // 只查询必要字段，避免返回内部字段
  const sql = `
    SELECT id, name, ip_address, mac_address, status, online,
           cpu_usage, memory_usage, storage_usage, temperature,
           volt, delay, delay2, coodX, coodY, coodZ, last_heartbeat,
           created_at, updated_at
    FROM devices
    ORDER BY name
  `;
  
  const startTime = Date.now();
  const devices = await db.query(sql);
  const duration = Date.now() - startTime;
  logSlowQuery(sql, duration);
  
  const processedDevices = devices.map(d => ({
    ...d,
    online: d.online === 1
  }));
  
  cache.set(cacheKey, processedDevices, CONFIG.CACHE.DEVICES_TTL);
  
  return processedDevices;
}

// 优化获取在线设备
async function getOnlineDevicesOptimized(limit = null) {
  const effectiveLimit = Math.min(limit || CONFIG.QUERY.DEFAULT_LIMIT, CONFIG.QUERY.MAX_LIMIT);
  const cacheKey = limit ? `${cache.KEYS.ONLINE_DEVICES}:${limit}` : cache.KEYS.ONLINE_DEVICES;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const sql = `
    SELECT id, name, ip_address, status, online, cpu_usage, memory_usage,
           storage_usage, temperature, last_heartbeat
    FROM devices
    WHERE online = 1
    ORDER BY last_heartbeat DESC
    LIMIT ?
  `;
  
  const startTime = Date.now();
  const devices = await db.query(sql, [effectiveLimit]);
  const duration = Date.now() - startTime;
  logSlowQuery(sql, duration);
  
  cache.set(cacheKey, devices, CONFIG.CACHE.DEVICES_TTL);
  
  return devices;
}

// 优化获取离线设备
async function getOfflineDevicesOptimized(limit = null) {
  const effectiveLimit = Math.min(limit || CONFIG.QUERY.DEFAULT_LIMIT, CONFIG.QUERY.MAX_LIMIT);
  const cacheKey = limit ? `${cache.KEYS.OFFLINE_DEVICES}:${limit}` : cache.KEYS.OFFLINE_DEVICES;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const sql = `
    SELECT id, name, ip_address, status, online, last_heartbeat
    FROM devices
    WHERE online = 0
    ORDER BY last_heartbeat DESC
    LIMIT ?
  `;
  
  const startTime = Date.now();
  const devices = await db.query(sql, [effectiveLimit]);
  const duration = Date.now() - startTime;
  logSlowQuery(sql, duration);
  
  cache.set(cacheKey, devices, CONFIG.CACHE.DEVICES_TTL);
  
  return devices;
}

// 优化获取设备统计
async function getDeviceStatsOptimized() {
  const cacheKey = cache.KEYS.DEVICE_STATS;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN online = 1 THEN 1 ELSE 0 END) as online,
      SUM(CASE WHEN online = 0 THEN 1 ELSE 0 END) as offline,
      AVG(cpu_usage) as avg_cpu,
      AVG(memory_usage) as avg_memory,
      AVG(storage_usage) as avg_storage,
      MAX(last_heartbeat) as last_heartbeat
    FROM devices
  `;
  
  const startTime = Date.now();
  const [stats] = await db.query(sql);
  const duration = Date.now() - startTime;
  logSlowQuery(sql, duration);
  
  cache.set(cacheKey, stats, CONFIG.CACHE.STATS_TTL);
  
  return stats;
}

// 优化按状态获取设备
async function getDevicesByStatusOptimized(status, limit = null) {
  const effectiveLimit = Math.min(limit || CONFIG.QUERY.DEFAULT_LIMIT, CONFIG.QUERY.MAX_LIMIT);
  
  const sql = `
    SELECT id, name, ip_address, status, online, cpu_usage, memory_usage,
           storage_usage, temperature, last_heartbeat
    FROM devices
    WHERE status = ?
    ORDER BY name
    LIMIT ?
  `;
  
  const startTime = Date.now();
  const devices = await db.query(sql, [status, effectiveLimit]);
  const duration = Date.now() - startTime;
  logSlowQuery(sql, duration);
  
  return devices.map(d => ({
    ...d,
    online: d.online === 1
  }));
}

// 优化获取带分组的设备
async function getAllDevicesWithGroupsOptimized() {
  const cacheKey = cache.KEYS.DEVICES_WITH_GROUPS;
  
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // 使用单次查询获取所有数据，避免 N+1 问题
  const sql = `
    SELECT 
      d.id, d.name, d.ip_address, d.mac_address, d.status, d.online,
      d.cpu_usage, d.memory_usage, d.storage_usage, d.temperature,
      d.volt, d.delay, d.delay2, d.coodX, d.coodY, d.coodZ, d.last_heartbeat,
      d.created_at, d.updated_at,
      GROUP_CONCAT(g.id ORDER BY g.name) as group_ids,
      GROUP_CONCAT(g.name ORDER BY g.name) as group_names
    FROM devices d
    LEFT JOIN device_group_mapping m ON d.id = m.device_id
    LEFT JOIN device_groups g ON m.group_id = g.id
    GROUP BY d.id
    ORDER BY d.name
  `;
  
  const startTime = Date.now();
  const devices = await db.query(sql);
  const duration = Date.now() - startTime;
  logSlowQuery(sql, duration);
  
  const result = devices.map(d => {
    const groups = [];
    if (d.group_ids) {
      const ids = d.group_ids.split(',');
      const names = d.group_names.split(',');
      ids.forEach((id, i) => {
        groups.push({ id, name: names[i] });
      });
    }
    
    const { group_ids, group_names, ...device } = d;
    return {
      ...device,
      online: device.online === 1,
      groups
    };
  });
  
  cache.set(cacheKey, result, CONFIG.CACHE.DEVICES_TTL);
  
  return result;
}

// 分页查询优化
async function getDevicesPaginated(page = 1, pageSize = 20, filters = {}) {
  const offset = (page - 1) * pageSize;
  const effectivePageSize = Math.min(pageSize, CONFIG.QUERY.MAX_LIMIT);
  
  let whereClause = '';
  const params = [];
  
  if (filters.status) {
    whereClause += ' WHERE status = ?';
    params.push(filters.status);
  }
  
  if (filters.online !== undefined) {
    whereClause += whereClause ? ' AND online = ?' : ' WHERE online = ?';
    params.push(filters.online ? 1 : 0);
  }
  
  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM devices ${whereClause}`;
  const [{ total }] = await db.query(countSql, params);
  
  // 获取分页数据
  const dataSql = `
    SELECT id, name, ip_address, status, online, cpu_usage, memory_usage,
           storage_usage, temperature, last_heartbeat
    FROM devices
    ${whereClause}
    ORDER BY name
    LIMIT ? OFFSET ?
  `;
  
  const startTime = Date.now();
  const devices = await db.query(dataSql, [...params, effectivePageSize, offset]);
  const duration = Date.now() - startTime;
  logSlowQuery(dataSql, duration);
  
  return {
    data: devices.map(d => ({ ...d, online: d.online === 1 })),
    pagination: {
      page,
      pageSize: effectivePageSize,
      total,
      totalPages: Math.ceil(total / effectivePageSize)
    }
  };
}

// 获取慢查询日志
function getSlowQueryLog() {
  return [...slowQueryLog];
}

// 获取优化统计
function getOptimizationStats() {
  return {
    slowQueries: slowQueryLog.length,
    avgQueryTime: slowQueryLog.length > 0
      ? slowQueryLog.reduce((sum, q) => sum + q.duration, 0) / slowQueryLog.length
      : 0,
    maxQueryTime: slowQueryLog.length > 0
      ? Math.max(...slowQueryLog.map(q => q.duration))
      : 0
  };
}

module.exports = {
  queryOptimized,
  getAllDevicesOptimized,
  getOnlineDevicesOptimized,
  getOfflineDevicesOptimized,
  getDeviceStatsOptimized,
  getDevicesByStatusOptimized,
  getAllDevicesWithGroupsOptimized,
  getDevicesPaginated,
  getSlowQueryLog,
  getOptimizationStats,
  CONFIG
};
