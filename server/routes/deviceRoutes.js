/**
 * 设备路由
 * 处理设备相关的 API 请求
 * 包含性能优化：字段选择、分页、批处理等
 */

const express = require('express');
const router = express.Router();
const deviceService = require('../services/deviceService');
const { batchProcessor, QueryOptimizer } = require('../modules/batchProcessor');
const { performanceOptimizer } = require('../modules/performanceOptimizer');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { authenticateToken, requireAdmin } = require('../middlewares/authMiddleware');
const { deviceSchemas, validateBody, validateQuery } = require('../utils/validators');
const { ErrorCodes, createErrorResponse } = require('../utils/errorCodes');
const { asyncHandler } = require('../middlewares/errorHandler');

// 性能记录中间件
function recordPerformance(req, res, next) {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    performanceOptimizer.recordApi(req.path, duration, res.statusCode);
  });
  next();
}

// 获取所有设备（优化版：支持字段选择和分页）
router.get('/', recordPerformance, apiRateLimit(), asyncHandler(async (req, res) => {
  const { fields, limit, offset, sort } = req.query;
  
  // 字段选择优化
  const selectFields = QueryOptimizer.sanitizeFields(fields);
  
  // 分页优化
  const effectiveLimit = QueryOptimizer.validateLimit(limit, 1000);
  const effectiveOffset = QueryOptimizer.validateOffset(offset);
  
  const devices = await deviceService.getAllDevices();
  
  // 在应用层处理字段选择
  let result = devices;
  if (selectFields) {
    result = devices.map(d => {
      const filtered = {};
      selectFields.forEach(f => {
        if (d.hasOwnProperty(f)) {
          filtered[f] = d[f];
        }
      });
      return filtered;
    });
  }
  
  // 处理排序
  if (sort) {
    const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
    const sortOrder = sort.startsWith('-') ? -1 : 1;
    result.sort((a, b) => {
      if (a[sortField] < b[sortField]) return -sortOrder;
      if (a[sortField] > b[sortField]) return sortOrder;
      return 0;
    });
  }
  
  // 处理分页
  if (effectiveOffset > 0 || limit) {
    result = result.slice(effectiveOffset, effectiveOffset + effectiveLimit);
  }
  
  res.json({ 
    success: true, 
    data: result,
    meta: {
      total: devices.length,
      limit: effectiveLimit,
      offset: effectiveOffset,
      fields: selectFields ? selectFields.join(',') : '*'
    }
  });
}));

// 批处理API
router.post('/batch', recordPerformance, apiRateLimit({
  windowMs: 60000,
  max: 20
}), validateBody(deviceSchemas.batch), asyncHandler(async (req, res) => {
  const { requests } = req.body;

  const result = await batchProcessor.processBatch(requests);

  res.json({
    success: true,
    data: result.results,
    meta: {
      ...result.meta,
      timestamp: new Date().toISOString()
    }
  });
}));

// 获取设备统计
router.get('/stats', apiRateLimit(), asyncHandler(async (req, res) => {
  const stats = await deviceService.getDeviceStats();
  res.json({ success: true, data: stats });
}));

// 获取在线设备
router.get('/online', apiRateLimit(), asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const devices = await deviceService.getOnlineDevices(limit);
  res.json({ success: true, data: devices });
}));

// 获取离线设备
router.get('/offline', apiRateLimit(), asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const devices = await deviceService.getOfflineDevices(limit);
  res.json({ success: true, data: devices });
}));

// 按状态获取设备
router.get('/status/:status', apiRateLimit(), asyncHandler(async (req, res) => {
  const { status } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit) : null;
  const devices = await deviceService.getDevicesByStatus(status, limit);
  res.json({ success: true, data: devices });
}));

// 获取带分组信息的设备列表
router.get('/with-groups', apiRateLimit(), asyncHandler(async (req, res) => {
  const devices = await deviceService.getAllDevicesWithGroups();
  res.json({ success: true, data: devices });
}));

// 获取单个设备
router.get('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  const device = await deviceService.getDeviceById(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, error: '设备不存在' });
  }
  res.json({ success: true, data: device });
}));

// 删除设备（破坏性操作，需要管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, apiRateLimit(), asyncHandler(async (req, res) => {
  await deviceService.deleteDevice(req.params.id);
  res.json({ success: true, message: '设备删除成功' });
}));

module.exports = router;
