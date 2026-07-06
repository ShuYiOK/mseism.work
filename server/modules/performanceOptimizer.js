/**
 * 性能监控与优化模块
 * 提供全面的性能监控、告警和调优功能
 */

const os = require('os');

class PerformanceOptimizer {
  constructor() {
    this.metrics = {
      api: new Map(),
      db: new Map(),
      cache: new Map(),
      ws: new Map(),
      system: {
        cpu: [],
        memory: [],
        eventLoop: []
      }
    };
    
    this.alerts = [];
    this.thresholds = {
      apiResponseTime: 1000,
      dbQueryTime: 500,
      cacheHitRate: 0.8,
      memoryUsage: 0.8,
      cpuUsage: 0.8,
      eventLoopLag: 100
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }
  
  startMonitoring(intervalMs = 5000) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
    
    console.log('[性能监控] 已启动');
  }
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('[性能监控] 已停止');
  }
  
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const systemMemory = os.freemem() / os.totalmem();
    
    // 记录内存指标
    this.metrics.system.memory.push({
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      heapUsage: memoryUsage.heapUsed / memoryUsage.heapTotal,
      systemFree: systemMemory,
      timestamp: Date.now()
    });
    
    // 保持最近的数据点
    if (this.metrics.system.memory.length > 100) {
      this.metrics.system.memory.shift();
    }
    
    // CPU 指标
    const cpuUsage = this.getCpuUsage();
    this.metrics.system.cpu.push({
      usage: cpuUsage,
      timestamp: Date.now()
    });
    
    if (this.metrics.system.cpu.length > 100) {
      this.metrics.system.cpu.shift();
    }
    
    // 检查告警阈值
    this.checkThresholds();
  }
  
  getCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 1 - idle / total;
    
    return usage * 100;
  }
  
  recordApi(path, duration, status) {
    const key = `${path}_${status}`;
    const current = this.metrics.api.get(key) || { count: 0, totalTime: 0, maxTime: 0, times: [] };
    
    current.count++;
    current.totalTime += duration;
    current.maxTime = Math.max(current.maxTime, duration);
    current.avgTime = current.totalTime / current.count;
    current.times.push({ duration, timestamp: Date.now() });
    
    // 保持最近 1000 条记录
    if (current.times.length > 1000) {
      current.times.shift();
    }
    
    this.metrics.api.set(key, current);
    
    if (duration > this.thresholds.apiResponseTime) {
      this.alert('API_RESPONSE_SLOW', { path, duration, threshold: this.thresholds.apiResponseTime });
    }
  }
  
  recordDb(query, duration) {
    const key = query.substring(0, 50);
    const current = this.metrics.db.get(key) || { count: 0, totalTime: 0, maxTime: 0 };
    
    current.count++;
    current.totalTime += duration;
    current.maxTime = Math.max(current.maxTime, duration);
    current.avgTime = current.totalTime / current.count;
    
    this.metrics.db.set(key, current);
    
    if (duration > this.thresholds.dbQueryTime) {
      this.alert('DB_QUERY_SLOW', { query: key, duration, threshold: this.thresholds.dbQueryTime });
    }
  }
  
  recordCacheHit(hit) {
    const current = this.metrics.cache.get('hitRate') || { hits: 0, misses: 0 };
    if (hit) {
      current.hits++;
    } else {
      current.misses++;
    }
    this.metrics.cache.set('hitRate', current);
    
    const hitRate = current.hits / (current.hits + current.misses);
    if (hitRate < this.thresholds.cacheHitRate && (current.hits + current.misses) > 100) {
      this.alert('CACHE_HIT_RATE_LOW', { hitRate, threshold: this.thresholds.cacheHitRate });
    }
  }
  
  recordWs(type, data) {
    const current = this.metrics.ws.get(type) || { count: 0 };
    current.count++;
    this.metrics.ws.set(type, current);
  }
  
  alert(type, data) {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      level: this.getAlertLevel(type, data)
    };
    
    this.alerts.push(alert);
    console.warn(`[性能告警] ${type}:`, data);
    
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
  }
  
  getAlertLevel(type, data) {
    switch (type) {
      case 'MEMORY_CRITICAL':
      case 'CPU_CRITICAL':
        return 'critical';
      case 'API_RESPONSE_SLOW':
      case 'DB_QUERY_SLOW':
        return 'warning';
      default:
        return 'info';
    }
  }
  
  checkThresholds() {
    const memory = process.memoryUsage();
    const heapUsage = memory.heapUsed / memory.heapTotal;
    
    if (heapUsage > this.thresholds.memoryUsage) {
      this.alert('MEMORY_HIGH', { usage: heapUsage, threshold: this.thresholds.memoryUsage });
    }
    
    if (heapUsage > 0.9) {
      this.alert('MEMORY_CRITICAL', { usage: heapUsage });
    }
    
    const cpuUsage = this.getCpuUsage();
    if (cpuUsage > this.thresholds.cpuUsage * 100) {
      this.alert('CPU_HIGH', { usage: cpuUsage, threshold: this.thresholds.cpuUsage * 100 });
    }
  }
  
  getReport() {
    const memory = process.memoryUsage();
    const systemMemory = os.freemem() / os.totalmem();
    
    // 计算 API 统计
    let apiStats = {
      totalRequests: 0,
      totalTime: 0,
      avgTime: 0,
      slowRequests: 0
    };
    
    for (const [key, stats] of this.metrics.api) {
      apiStats.totalRequests += stats.count;
      apiStats.totalTime += stats.totalTime;
      if (stats.maxTime > this.thresholds.apiResponseTime) {
        apiStats.slowRequests += stats.count;
      }
    }
    apiStats.avgTime = apiStats.totalRequests > 0 
      ? apiStats.totalTime / apiStats.totalRequests 
      : 0;
    
    // 计算缓存命中率
    const cacheStats = this.metrics.cache.get('hitRate') || { hits: 0, misses: 0 };
    const cacheHitRate = (cacheStats.hits + cacheStats.misses) > 0
      ? cacheStats.hits / (cacheStats.hits + cacheStats.misses)
      : 0;
    
    // 最近告警
    const recentAlerts = this.alerts.slice(-20);
    
    return {
      timestamp: Date.now(),
      uptime: process.uptime(),
      api: apiStats,
      db: {
        queries: this.metrics.db.size,
        slowQueries: Array.from(this.metrics.db.entries())
          .filter(([_, stats]) => stats.avgTime > this.thresholds.dbQueryTime)
          .map(([query, stats]) => ({ query, ...stats }))
      },
      cache: {
        hitRate: cacheHitRate,
        hits: cacheStats.hits,
        misses: cacheStats.misses
      },
      websocket: {
        connections: this.metrics.ws.get('connect')?.count || 0,
        messages: this.metrics.ws.get('message')?.count || 0
      },
      system: {
        memory: {
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          heapUsage: heapUsage,
          systemFree: systemMemory
        },
        cpu: {
          usage: this.getCpuUsage()
        },
        eventLoop: {
          lag: this.measureEventLoopLag()
        }
      },
      alerts: recentAlerts
    };
  }
  
  measureEventLoopLag() {
    const start = Date.now();
    setImmediate(() => {
      // 测量事件循环延迟
    });
    return Date.now() - start;
  }
  
  getSlowestApis(limit = 10) {
    const entries = Array.from(this.metrics.api.entries())
      .map(([key, stats]) => ({ path: key, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
    
    return entries;
  }
  
  getSlowestQueries(limit = 10) {
    return Array.from(this.metrics.db.entries())
      .map(([query, stats]) => ({ query, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }
  
  getAlertsByLevel(level) {
    return this.alerts.filter(a => a.level === level);
  }
  
  clearAlerts() {
    this.alerts = [];
  }
  
  getRecommendations() {
    const recommendations = [];
    const report = this.getReport();
    
    // 基于 API 性能的建议
    if (report.api.avgTime > 500) {
      recommendations.push({
        type: 'API_PERFORMANCE',
        priority: 'high',
        message: `API 平均响应时间过高: ${report.api.avgTime.toFixed(2)}ms`,
        suggestion: '考虑添加缓存、优化查询或增加服务器资源'
      });
    }
    
    // 基于缓存命中率的建议
    if (report.cache.hitRate < 0.7) {
      recommendations.push({
        type: 'CACHE_EFFICIENCY',
        priority: 'high',
        message: `缓存命中率较低: ${(report.cache.hitRate * 100).toFixed(2)}%`,
        suggestion: '增加缓存容量或延长 TTL'
      });
    }
    
    // 基于内存使用的建议
    if (report.system.memory.heapUsage > 0.8) {
      recommendations.push({
        type: 'MEMORY_USAGE',
        priority: 'high',
        message: `内存使用率过高: ${(report.system.memory.heapUsage * 100).toFixed(2)}%`,
        suggestion: '增加缓存清理频率或扩展内存'
      });
    }
    
    // 基于慢查询的建议
    if (report.db.slowQueries.length > 0) {
      recommendations.push({
        type: 'SLOW_QUERIES',
        priority: 'medium',
        message: `存在 ${report.db.slowQueries.length} 个慢查询`,
        suggestion: '优化查询语句或添加索引'
      });
    }
    
    return recommendations;
  }
  
  reset() {
    this.metrics.api.clear();
    this.metrics.db.clear();
    this.metrics.cache.clear();
    this.metrics.ws.clear();
    this.metrics.system.cpu = [];
    this.metrics.system.memory = [];
    this.alerts = [];
    console.log('[性能监控] 数据已重置');
  }
}

// 创建单例实例
const performanceOptimizer = new PerformanceOptimizer();

module.exports = {
  performanceOptimizer,
  PerformanceOptimizer
};
