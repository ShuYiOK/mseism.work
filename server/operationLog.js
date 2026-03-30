/**
 * 操作日志模块
 * 用于记录系统操作日志，包括API请求、系统事件等
 */

// 日志存储
const logs = [];

// 日志类型
const LOG_TYPES = {
  API_REQUEST: 'api_request',
  SYSTEM_EVENT: 'system_event',
  SYNC_EVENT: 'sync_event',
  ERROR: 'error',
};

// 日志级别
const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

/**
 * 记录API请求
 * @param {string} method - HTTP方法
 * @param {string} url - 请求URL
 * @param {number} statusCode - 状态码
 * @param {number} duration - 响应时间（毫秒）
 */
function apiRequest(method, url, statusCode, duration) {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type: LOG_TYPES.API_REQUEST,
    level: statusCode >= 500 ? LOG_LEVELS.ERROR : statusCode >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO,
    method,
    url,
    statusCode,
    duration,
    timestamp: new Date(),
  };
  
  logs.push(log);
  
  // 限制日志数量，防止内存溢出
  if (logs.length > 10000) {
    logs.shift();
  }
  
  // 控制台输出
  console.log(`${log.timestamp.toISOString()} - ${log.level.toUpperCase()} - ${log.method} ${log.url} - ${log.statusCode} - ${log.duration}ms`);
  
  return log;
}

/**
 * 记录系统事件
 * @param {string} event - 事件名称
 * @param {string} message - 事件消息
 * @param {string} level - 日志级别
 * @param {object} data - 附加数据
 */
function systemEvent(event, message, level = LOG_LEVELS.INFO, data = {}) {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type: LOG_TYPES.SYSTEM_EVENT,
    level,
    event,
    message,
    data,
    timestamp: new Date(),
  };
  
  logs.push(log);
  
  // 限制日志数量，防止内存溢出
  if (logs.length > 10000) {
    logs.shift();
  }
  
  // 控制台输出
  console.log(`${log.timestamp.toISOString()} - ${log.level.toUpperCase()} - [SYSTEM] ${log.event}: ${log.message}`);
  
  return log;
}

/**
 * 记录同步事件
 * @param {boolean} success - 是否成功
 * @param {number} duration - 同步时间（毫秒）
 * @param {number} deviceCount - 设备数量
 * @param {string} error - 错误信息
 */
function syncEvent(success, duration, deviceCount, error = '') {
  const log = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type: LOG_TYPES.SYNC_EVENT,
    level: success ? LOG_LEVELS.INFO : LOG_LEVELS.ERROR,
    success,
    duration,
    deviceCount,
    error,
    timestamp: new Date(),
  };
  
  logs.push(log);
  
  // 限制日志数量，防止内存溢出
  if (logs.length > 10000) {
    logs.shift();
  }
  
  // 控制台输出
  if (success) {
    console.log(`${log.timestamp.toISOString()} - INFO - [SYNC] 同步完成，耗时 ${log.duration}ms，设备数量 ${log.deviceCount}`);
  } else {
    console.error(`${log.timestamp.toISOString()} - ERROR - [SYNC] 同步失败，耗时 ${log.duration}ms，错误: ${log.error}`);
  }
  
  return log;
}

/**
 * 记录系统启动
 */
function systemStart() {
  return systemEvent('system_start', '系统启动', LOG_LEVELS.INFO, {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  });
}

/**
 * 记录系统关闭
 */
function systemShutdown() {
  return systemEvent('system_shutdown', '系统关闭', LOG_LEVELS.INFO);
}

/**
 * 查询日志
 * @param {object} options - 查询选项
 * @returns {array} 日志列表
 */
function queryLogs(options = {}) {
  let filteredLogs = [...logs];
  
  // 按类型过滤
  if (options.type) {
    filteredLogs = filteredLogs.filter(log => log.type === options.type);
  }
  
  // 按级别过滤
  if (options.level) {
    filteredLogs = filteredLogs.filter(log => log.level === options.level);
  }
  
  // 按用户ID过滤（如果有）
  if (options.userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === options.userId);
  }
  
  // 按时间范围过滤
  if (options.startTime) {
    filteredLogs = filteredLogs.filter(log => log.timestamp >= options.startTime);
  }
  
  if (options.endTime) {
    filteredLogs = filteredLogs.filter(log => log.timestamp <= options.endTime);
  }
  
  // 按时间倒序排序
  filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
  
  // 分页
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  
  return {
    total: filteredLogs.length,
    logs: filteredLogs.slice(offset, offset + limit),
  };
}

/**
 * 获取日志统计
 * @returns {object} 日志统计数据
 */
function getLogStats() {
  const stats = {
    total: logs.length,
    byType: {},
    byLevel: {},
    recent: logs.slice(-10),
  };
  
  // 按类型统计
  logs.forEach(log => {
    stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
  });
  
  // 按级别统计
  logs.forEach(log => {
    stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
  });
  
  return stats;
}

module.exports = {
  apiRequest,
  systemEvent,
  syncEvent,
  systemStart,
  systemShutdown,
  queryLogs,
  getLogStats,
  LOG_TYPES,
  LOG_LEVELS,
};