/**
 * 资源优化模块
 * 提供内存优化、CPU优化、网络优化等功能
 */

const v8 = require('v8');

class ResourceOptimizer {
  constructor() {
    this.initialMemory = process.memoryUsage();
    this.gcEnabled = typeof global.gc === 'function';
    this.cleanupHandlers = [];
    this.monitoringInterval = null;
  }
  
  // 启动资源监控
  startMonitoring(intervalMs = 30000) {
    if (this.monitoringInterval) return;
    
    this.monitoringInterval = setInterval(() => {
      this.monitor();
    }, intervalMs);
    
    console.log('[资源优化] 资源监控已启动');
  }
  
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
  
  monitor() {
    const memory = this.getMemoryInfo();
    
    // 内存超过阈值时触发清理
    if (memory.heapUsagePercent > 0.85) {
      console.warn(`[资源优化] 内存使用率过高: ${(memory.heapUsagePercent * 100).toFixed(2)}%`);
      this.triggerCleanup();
    }
    
    return memory;
  }
  
  getMemoryInfo() {
    const heapUsed = process.memoryUsage().heapUsed;
    const heapTotal = process.memoryUsage().heapTotal;
    const heapUsagePercent = heapUsed / heapTotal;
    const rss = process.memoryUsage().rss;
    
    return {
      heapUsed: Math.round(heapUsed / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(heapTotal / 1024 / 1024 * 100) / 100,
      heapUsagePercent,
      rss: Math.round(rss / 1024 / 1024 * 100) / 100,
      external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
    };
  }
  
  triggerCleanup() {
    console.log('[资源优化] 开始执行资源清理...');
    
    for (const handler of this.cleanupHandlers) {
      try {
        handler();
      } catch (err) {
        console.warn('[资源优化] 清理执行失败:', err.message);
      }
    }
    
    if (this.gcEnabled) {
      console.log('[资源优化] 触发垃圾回收...');
      global.gc();
    }
  }
  
  registerCleanupHandler(name, handler) {
    this.cleanupHandlers.push(handler);
    console.log(`[资源优化] 已注册清理处理器: ${name}`);
  }
  
  forceGC() {
    if (this.gcEnabled) {
      global.gc();
      return true;
    }
    return false;
  }
}

// 内存泄漏检测器
class MemoryLeakDetector {
  constructor() {
    this.snapshots = [];
    this.maxSnapshots = 10;
  }
  
  takeSnapshot() {
    const heapSnapshot = v8.getHeapSnapshot();
    const stats = process.memoryUsage();
    
    const snapshot = {
      timestamp: Date.now(),
      heapUsed: stats.heapUsed,
      heapTotal: stats.heapTotal,
      external: stats.external,
      rss: stats.rss,
      snapshot: heapSnapshot
    };
    
    this.snapshots.push(snapshot);
    
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
    
    return snapshot;
  }
  
  compareSnapshots() {
    if (this.snapshots.length < 2) {
      return null;
    }
    
    const older = this.snapshots[0];
    const newer = this.snapshots[this.snapshots.length - 1];
    
    return {
      heapUsedDelta: newer.heapUsed - older.heapUsed,
      heapTotalDelta: newer.heapTotal - older.heapTotal,
      externalDelta: newer.external - older.external,
      rssDelta: newer.rss - older.rss,
      timeDelta: newer.timestamp - older.timestamp
    };
  }
  
  detectLeak() {
    const comparison = this.compareSnapshots();
    
    if (!comparison) return null;
    
    const leakDetected = 
      comparison.heapUsedDelta > 10 * 1024 * 1024 ||  // 10MB 增长
      comparison.heapTotalDelta > 10 * 1024 * 1024;
    
    return {
      detected: leakDetected,
      details: comparison
    };
  }
}

// CPU 优化器
class CpuOptimizer {
  constructor() {
    this.taskQueue = [];
    this.processing = false;
    this.concurrency = 5;
  }
  
  // 添加 CPU 密集型任务
  addTask(task, priority = 0) {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({
        task,
        priority,
        resolve,
        reject
      });
      
      this.taskQueue.sort((a, b) => b.priority - a.priority);
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }
  
  async processQueue() {
    if (this.processing || this.taskQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.taskQueue.length > 0) {
      const batch = this.taskQueue.splice(0, this.concurrency);
      
      await Promise.allSettled(
        batch.map(({ task, resolve, reject }) => 
          task()
            .then(resolve)
            .catch(reject)
        )
      );
    }
    
    this.processing = false;
  }
  
  getStats() {
    return {
      queueLength: this.taskQueue.length,
      processing: this.processing
    };
  }
}

// 网络优化器
class NetworkOptimizer {
  constructor() {
    this.requestCache = new Map();
    this.cacheTTL = 5000;
    this.deduplication = new Map();
  }
  
  // 请求去重
  deduplicate(key, promise) {
    if (this.deduplication.has(key)) {
      return this.deduplication.get(key);
    }
    
    const p = promise
      .finally(() => {
        setTimeout(() => {
          this.deduplication.delete(key);
        }, 1000);
      });
    
    this.deduplication.set(key, p);
    return p;
  }
  
  // 缓存请求结果
  cacheResponse(key, response, ttl) {
    this.requestCache.set(key, {
      data: response,
      expiry: Date.now() + (ttl || this.cacheTTL)
    });
    
    // 限制缓存大小
    if (this.requestCache.size > 1000) {
      const firstKey = this.requestCache.keys().next().value;
      this.requestCache.delete(firstKey);
    }
  }
  
  getCachedResponse(key) {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.requestCache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  clearCache() {
    this.requestCache.clear();
  }
}

// 对象池
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
    this.allocated = 0;
  }
  
  acquire() {
    this.allocated++;
    
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    
    return this.createFn();
  }
  
  release(obj) {
    this.allocated--;
    
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
  
  getStats() {
    return {
      poolSize: this.pool.length,
      allocated: this.allocated,
      maxSize: this.maxSize
    };
  }
}

// 创建单例实例
const resourceOptimizer = new ResourceOptimizer();
const memoryLeakDetector = new MemoryLeakDetector();
const cpuOptimizer = new CpuOptimizer();
const networkOptimizer = new NetworkOptimizer();

module.exports = {
  resourceOptimizer,
  memoryLeakDetector,
  cpuOptimizer,
  networkOptimizer,
  ObjectPool,
  ResourceOptimizer,
  MemoryLeakDetector,
  CpuOptimizer,
  NetworkOptimizer
};
