/**
 * 设备路由
 * 处理设备相关的 API 请求
 */

const express = require('express');
const router = express.Router();
const deviceService = require('../services/deviceService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');

// 异步处理中间件
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 获取所有设备
router.get('/', apiRateLimit(), asyncHandler(async (req, res) => {
  const devices = await deviceService.getAllDevices();
  res.json({ success: true, data: devices });
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

// 删除设备
router.delete('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  await deviceService.deleteDevice(req.params.id);
  res.json({ success: true, message: '设备删除成功' });
}));

module.exports = router;
