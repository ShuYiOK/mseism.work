/**
 * 性能监控模块
 * 用于监控服务器性能、API响应时间、WebSocket连接等
 */

// 性能数据存储
const performanceData = {
  // API 请求统计
  apiRequests: {
    total: 0,
    success: 0,
    failed: 0,
    totalTime: 0,
    paths: {}, // 按路径统计
  },
  // 数据同步统计
  syncs: {
    total: 0,
    success: 0,
    failed: 0,
    totalTime: 0,
    deviceCount: 0,
  },
  // WebSocket 统计
  websocket: {
    connections: 0,
    messages: 0,
    errors: 0,
  },
  // 系统资源使用
  system: {
    memory: {
      used: 0,
      total: 0,
      percentage: 0,
    },
    cpu: {
      usage: 0,
    },
  },
  // 时间戳
  timestamps: {
    start: Date.now(),
    lastReset: Date.now(),
  },
};

/**
 * 记录 API 请求
 * @param {string} path - API 路径
 * @param {number} duration - 响应时间（毫秒）
 * @param {boolean} success - 是否成功
 */
function recordApiRequest(path, duration, success) {
  performanceData.apiRequests.total++;
  performanceData.apiRequests.totalTime += duration;
  
  if (success) {
    performanceData.apiRequests.success++;
  } else {
    performanceData.apiRequests.failed++;
  }
  
  // 按路径统计
  if (!performanceData.apiRequests.paths[path]) {
    performanceData.apiRequests.paths[path] = {
      total: 0,
      success: 0,
      failed: 0,
      totalTime: 0,
    };
  }
  
  performanceData.apiRequests.paths[path].total++;
  performanceData.apiRequests.paths[path].totalTime += duration;
  
  if (success) {
    performanceData.apiRequests.paths[path].success++;
  } else {
    performanceData.apiRequests.paths[path].failed++;
  }
}

/**
 * 记录数据同步
 * @param {number} duration - 同步时间（毫秒）
 * @param {boolean} success - 是否成功
 * @param {number} deviceCount - 设备数量
 */
function recordSync(duration, success, deviceCount) {
  performanceData.syncs.total++;
  performanceData.syncs.totalTime += duration;
  performanceData.syncs.deviceCount += deviceCount;
  
  if (success) {
    performanceData.syncs.success++;
  } else {
    performanceData.syncs.failed++;
  }
}

/**
 * 记录 WebSocket 连接
 * @param {string} type - 连接类型（connect/disconnect）
 */
function recordWebSocketConnection(type) {
  if (type === 'connect') {
    performanceData.websocket.connections++;
  } else if (type === 'disconnect') {
    performanceData.websocket.connections = Math.max(0, performanceData.websocket.connections - 1);
  }
}

/**
 * 记录 WebSocket 消息
 * @param {boolean} success - 是否成功
 */
function recordWebSocketMessage(success) {
  performanceData.websocket.messages++;
  if (!success) {
    performanceData.websocket.errors++;
  }
}

/**
 * 更新系统资源使用情况
 */
function updateSystemResources() {
  const memory = process.memoryUsage();
  performanceData.system.memory = {
    used: memory.heapUsed,
    total: memory.heapTotal,
    percentage: (memory.heapUsed / memory.heapTotal) * 100,
  };
  
  // CPU 使用率获取需要依赖第三方库，这里暂时使用占位符
  performanceData.system.cpu.usage = 0;
}

/**
 * 获取性能统计数据
 * @returns {object} 性能统计数据
 */
function getStats() {
  // 更新系统资源使用情况
  updateSystemResources();
  
  // 计算平均响应时间
  const avgApiResponseTime = performanceData.apiRequests.total > 0 
    ? performanceData.apiRequests.totalTime / performanceData.apiRequests.total 
    : 0;
  
  const avgSyncTime = performanceData.syncs.total > 0 
    ? performanceData.syncs.totalTime / performanceData.syncs.total 
    : 0;
  
  // 计算成功率
  const apiSuccessRate = performanceData.apiRequests.total > 0 
    ? (performanceData.apiRequests.success / performanceData.apiRequests.total) * 100 
    : 0;
  
  const syncSuccessRate = performanceData.syncs.total > 0 
    ? (performanceData.syncs.success / performanceData.syncs.total) * 100 
    : 0;
  
  return {
    api: {
      totalRequests: performanceData.apiRequests.total,
      successRate: apiSuccessRate,
      averageResponseTime: avgApiResponseTime,
      paths: performanceData.apiRequests.paths,
    },
    sync: {
      totalSyncs: performanceData.syncs.total,
      successRate: syncSuccessRate,
      averageSyncTime: avgSyncTime,
      totalDevices: performanceData.syncs.deviceCount,
    },
    websocket: {
      currentConnections: performanceData.websocket.connections,
      totalMessages: performanceData.websocket.messages,
      errorRate: performanceData.websocket.messages > 0 
        ? (performanceData.websocket.errors / performanceData.websocket.messages) * 100 
        : 0,
    },
    system: performanceData.system,
    uptime: Date.now() - performanceData.timestamps.start,
  };
}

/**
 * 重置性能监控数据
 */
function reset() {
  performanceData.apiRequests = {
    total: 0,
    success: 0,
    failed: 0,
    totalTime: 0,
    paths: {},
  };
  
  performanceData.syncs = {
    total: 0,
    success: 0,
    failed: 0,
    totalTime: 0,
    deviceCount: 0,
  };
  
  performanceData.websocket = {
    connections: 0,
    messages: 0,
    errors: 0,
  };
  
  performanceData.timestamps.lastReset = Date.now();
}

module.exports = {
  recordApiRequest,
  recordSync,
  recordWebSocketConnection,
  recordWebSocketMessage,
  getStats,
  reset,
};