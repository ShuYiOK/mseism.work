/**
 * 优化模块索引
 * 导出所有性能优化相关的模块
 */

const dbOptimizer = require('./dbOptimizer');
const performanceOptimizer = require('./performanceOptimizer');
const batchProcessor = require('./batchProcessor');
const wsOptimizer = require('./wsOptimizer');
const cacheOptimizer = require('./cacheOptimizer');
const resourceOptimizer = require('./resourceOptimizer');

module.exports = {
  dbOptimizer,
  performanceOptimizer,
  batchProcessor,
  wsOptimizer,
  cacheOptimizer,
  resourceOptimizer
};
