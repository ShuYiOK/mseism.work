/**
 * 监控和可观测性模块
 * 提供全面的指标收集、分布式追踪和日志管理功能
 */

const { performanceOptimizer } = require('./performanceOptimizer');

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.intervals = new Map();
  }

  counter(name, labels = {}) {
    const key = this.getKey(name, labels);

    if (!this.counters.has(key)) {
      this.counters.set(key, {
        name,
        labels,
        value: 0,
        createdAt: Date.now()
      });
    }

    return {
      inc: (value = 1) => {
        const counter = this.counters.get(key);
        counter.value += value;
      },
      dec: (value = 1) => {
        const counter = this.counters.get(key);
        counter.value -= value;
      },
      get: () => this.counters.get(key).value
    };
  }

  gauge(name, labels = {}) {
    const key = this.getKey(name, labels);

    if (!this.gauges.has(key)) {
      this.gauges.set(key, {
        name,
        labels,
        value: 0,
        createdAt: Date.now()
      });
    }

    return {
      set: (value) => {
        const gauge = this.gauges.get(key);
        gauge.value = value;
      },
      inc: (value = 1) => {
        const gauge = this.gauges.get(key);
        gauge.value += value;
      },
      dec: (value = 1) => {
        const gauge = this.gauges.get(key);
        gauge.value -= value;
      },
      get: () => this.gauges.get(key).value
    };
  }

  histogram(name, labels = {}) {
    const key = this.getKey(name, labels);

    if (!this.histograms.has(key)) {
      this.histograms.set(key, {
        name,
        labels,
        values: [],
        buckets: {
          5: 0,
          10: 0,
          25: 0,
          50: 0,
          100: 0,
          250: 0,
          500: 0,
          1000: 0,
          2500: 0,
          5000: 0
        },
        createdAt: Date.now()
      });
    }

    return {
      observe: (value) => {
        const histogram = this.histograms.get(key);
        histogram.values.push(value);

        for (const threshold of Object.keys(histogram.buckets)) {
          if (value <= parseInt(threshold)) {
            histogram.buckets[threshold]++;
          }
        }
      },
      get: () => {
        const histogram = this.histograms.get(key);
        const sorted = [...histogram.values].sort((a, b) => a - b);
        const sum = histogram.values.reduce((a, b) => a + b, 0);

        return {
          count: histogram.values.length,
          sum,
          avg: sum / histogram.values.length,
          min: sorted[0] || 0,
          max: sorted[sorted.length - 1] || 0,
          p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
          p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
          p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
          p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
          buckets: histogram.buckets
        };
      }
    };
  }

  getKey(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${name}{${labelStr}}`;
  }

  getAllMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(this.histograms)
    };
  }

  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

class DistributedTracer {
  constructor() {
    this.traces = new Map();
    this.spans = [];
    this.maxTraces = 1000;
  }

  createTrace(traceId) {
    const trace = {
      id: traceId || this.generateId('trace'),
      spans: [],
      startTime: Date.now(),
      endTime: null,
      status: 'running'
    };

    this.traces.set(trace.id, trace);

    if (this.traces.size > this.maxTraces) {
      const oldestKey = this.traces.keys().next().value;
      this.traces.delete(oldestKey);
    }

    return trace;
  }

  createSpan(traceId, name, parentSpanId = null) {
    const trace = this.traces.get(traceId) || this.createTrace(traceId);

    const span = {
      id: this.generateId('span'),
      traceId: trace.id,
      name,
      parentSpanId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'running',
      annotations: [],
      tags: {}
    };

    trace.spans.push(span);
    this.spans.push(span);

    if (this.spans.length > this.maxTraces * 10) {
      this.spans = this.spans.slice(-this.maxTraces * 5);
    }

    return span;
  }

  finishSpan(spanId, annotations = {}) {
    const span = this.spans.find(s => s.id === spanId);

    if (span) {
      span.endTime = Date.now();
      span.duration = span.endTime - span.startTime;
      span.status = 'completed';

      for (const [key, value] of Object.entries(annotations)) {
        span.annotations.push({
          key,
          value,
          timestamp: Date.now()
        });
      }
    }

    return span;
  }

  addTag(spanId, key, value) {
    const span = this.spans.find(s => s.id === spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  getTrace(traceId) {
    return this.traces.get(traceId);
  }

  getAllTraces(limit = 100) {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.lastCheckResults = new Map();
  }

  register(name, checkFn, options = {}) {
    this.checks.set(name, {
      checkFn,
      interval: options.interval || 60000,
      timeout: options.timeout || 5000,
      critical: options.critical || false
    });
  }

  async check(name) {
    const check = this.checks.get(name);
    if (!check) {
      return { status: 'unknown', error: 'Check not found' };
    }

    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Check timeout')), check.timeout);
      });

      const result = await Promise.race([check.checkFn(), timeoutPromise]);

      const checkResult = {
        status: result === true ? 'healthy' : 'unhealthy',
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        details: result
      };

      this.lastCheckResults.set(name, checkResult);

      return checkResult;

    } catch (error) {
      const checkResult = {
        status: 'error',
        duration: Date.now() - startTime,
        timestamp: Date.now(),
        error: error.message
      };

      this.lastCheckResults.set(name, checkResult);

      return checkResult;
    }
  }

  async checkAll() {
    const results = {};

    for (const name of this.checks.keys()) {
      results[name] = await this.check(name);
    }

    return {
      overall: this.calculateOverallStatus(results),
      checks: results,
      timestamp: Date.now()
    };
  }

  calculateOverallStatus(results) {
    const statuses = Object.values(results).map(r => r.status);

    if (statuses.includes('error')) return 'unhealthy';
    if (statuses.includes('unhealthy')) return 'degraded';
    if (statuses.every(s => s === 'healthy')) return 'healthy';
    return 'unknown';
  }

  getLastResult(name) {
    return this.lastCheckResults.get(name);
  }
}

const metricsCollector = new MetricsCollector();
const distributedTracer = new DistributedTracer();
const healthChecker = new HealthChecker();

healthChecker.register('database', async () => {
  try {
    const db = require('../database');
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}, { critical: true });

healthChecker.register('redis', async () => {
  try {
    const cache = require('../cache');
    return cache.getStats ? true : false;
  } catch {
    return false;
  }
}, { critical: true });

module.exports = {
  MetricsCollector,
  DistributedTracer,
  HealthChecker,
  metricsCollector,
  distributedTracer,
  healthChecker
};
