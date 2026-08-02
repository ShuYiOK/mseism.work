/**
 * 批处理API模块
 * 提供高效的批量请求处理能力
 */

const deviceService = require('../services/deviceService');
const groupService = require('../services/groupService');

const CONFIG = {
  MAX_BATCH_SIZE: 10,
  TIMEOUT: 30000,
  ENABLE_PARALLEL: true,
  ENABLE_RESULT_CACHE: true
};

class BatchProcessor {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5000;
  }
  
  async processBatch(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('请求列表不能为空');
    }
    
    if (requests.length > CONFIG.MAX_BATCH_SIZE) {
      throw new Error(`批量请求数量不能超过 ${CONFIG.MAX_BATCH_SIZE}`);
    }
    
    const startTime = Date.now();
    const results = [];
    
    if (CONFIG.ENABLE_PARALLEL) {
      // 并行处理
      const promises = requests.map(req => this.processRequest(req));
      results.push(...await Promise.all(promises));
    } else {
      // 串行处理
      for (const req of requests) {
        results.push(await this.processRequest(req));
      }
    }
    
    const duration = Date.now() - startTime;
    
    return {
      results,
      meta: {
        count: requests.length,
        duration,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    };
  }
  
  async processRequest(req) {
    // 在 try 外部解构，确保 catch 块也能访问 id（否则 ReferenceError 会掩盖真正错误）
    const { type, params = {}, id } = req;

    try {
      // 检查缓存
      if (CONFIG.ENABLE_RESULT_CACHE) {
        const cached = this.getCachedResult(type, params);
        if (cached) {
          return { id, success: true, data: cached, cached: true };
        }
      }

      let data;

      switch (type) {
        case 'getDevices':
          data = await deviceService.getAllDevices();
          break;

        case 'getDevice':
          if (!params.id) {
            throw new Error('缺少设备ID参数');
          }
          data = await deviceService.getDeviceById(params.id);
          break;

        case 'getDeviceStats':
          data = await deviceService.getDeviceStats();
          break;

        case 'getOnlineDevices':
          data = await deviceService.getOnlineDevices(params.limit);
          break;

        case 'getOfflineDevices':
          data = await deviceService.getOfflineDevices(params.limit);
          break;

        case 'getDevicesByStatus':
          if (!params.status) {
            throw new Error('缺少状态参数');
          }
          data = await deviceService.getDevicesByStatus(params.status, params.limit);
          break;

        case 'getDevicesWithGroups':
          data = await deviceService.getAllDevicesWithGroups();
          break;

        case 'getGroups':
          data = await groupService.getAllGroups();
          break;

        case 'getGroup':
          if (!params.id) {
            throw new Error('缺少分组ID参数');
          }
          data = await groupService.getGroupById(params.id);
          break;

        case 'getGroupsWithDevices':
          data = await groupService.getAllGroupsWithDevices();
          break;

        default:
          throw new Error(`未知的请求类型: ${type}`);
      }

      // 缓存结果
      if (CONFIG.ENABLE_RESULT_CACHE) {
        this.cacheResult(type, params, data);
      }

      return { id, success: true, data, cached: false };

    } catch (error) {
      return {
        id,
        success: false,
        error: error.message
      };
    }
  }
  
  getCacheKey(type, params) {
    return `${type}:${JSON.stringify(params)}`;
  }
  
  getCachedResult(type, params) {
    const key = this.getCacheKey(type, params);
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    
    return null;
  }
  
  cacheResult(type, params, data) {
    const key = this.getCacheKey(type, params);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // 限制缓存大小
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
  
  clearCache() {
    this.cache.clear();
  }
  
  setCacheTTL(ttl) {
    this.cacheTTL = ttl;
  }
}

// 批量查询优化：支持字段选择和分页
class QueryOptimizer {
  static ALLOWED_FIELDS = new Set([
    'id', 'name', 'ip_address', 'mac_address', 'status', 'online',
    'cpu_usage', 'memory_usage', 'storage_usage', 'temperature',
    'volt', 'delay', 'delay2', 'coodX', 'coodY', 'coodZ',
    'last_heartbeat', 'created_at', 'updated_at'
  ]);
  
  static sanitizeFields(fields) {
    if (!fields) return null;
    
    const requestedFields = fields.split(',')
      .map(f => f.trim())
      .filter(f => this.ALLOWED_FIELDS.has(f));
    
    return requestedFields.length > 0 ? requestedFields : null;
  }
  
  static validateLimit(limit, maxLimit = 1000) {
    const parsed = parseInt(limit);
    if (isNaN(parsed) || parsed < 1) {
      return 100;
    }
    return Math.min(parsed, maxLimit);
  }
  
  static validateOffset(offset) {
    const parsed = parseInt(offset);
    if (isNaN(parsed) || parsed < 0) {
      return 0;
    }
    return parsed;
  }
}

// 创建单例实例
const batchProcessor = new BatchProcessor();

module.exports = {
  batchProcessor,
  BatchProcessor,
  QueryOptimizer,
  CONFIG
};
