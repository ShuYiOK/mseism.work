/**
 * 设备异常监控 API 路由
 */

const express = require('express');
const router = express.Router();
const anomalyService = require('../services/anomalyService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * 获取异常设备列表
 * GET /api/anomalies
 */
router.get('/', apiRateLimit(), asyncHandler(async (req, res) => {
  const devices = await anomalyService.getAnomalousDevices();
  res.json({
    success: true,
    data: devices,
    meta: {
      count: devices.length,
      threshold: anomalyService.ANOMALY_THRESHOLD,
      timeWindow: anomalyService.TIME_WINDOW_HOURS
    }
  });
}));

/**
 * 手动触发异常检测
 * POST /api/anomalies/detect
 */
router.post('/detect', apiRateLimit(), asyncHandler(async (req, res) => {
  const anomalies = await anomalyService.detectAnomalousDevices();
  
  res.json({
    success: true,
    message: `检测完成，发现 ${anomalies.length} 个异常设备`,
    data: anomalies
  });
}));

/**
 * 获取异常设备详细信息
 * GET /api/anomalies/:deviceId
 */
router.get('/:deviceId', apiRateLimit(), asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const details = await anomalyService.getDeviceAnomalyDetails(deviceId);
  
  if (!details) {
    res.status(404).json({
      success: false,
      error: '未找到该设备的异常记录'
    });
    return;
  }
  
  res.json({
    success: true,
    data: details
  });
}));

/**
 * 获取设备状态变化历史
 * GET /api/anomalies/:deviceId/status-history
 */
router.get('/:deviceId/status-history', apiRateLimit(), asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const hoursAgo = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 720);
  
  const db = require('../database');
  const history = await db.getDeviceStatusHistory(deviceId, hoursAgo);
  
  res.json({
    success: true,
    data: history.map(log => ({
      status: log.status,
      timestamp: log.timestamp,
      ipAddress: log.ip_address,
      formattedTime: new Date(log.timestamp * 1000).toLocaleString('zh-CN')
    }))
  });
}));

/**
 * 获取设备坐标变化历史
 * GET /api/anomalies/:deviceId/coordinate-history
 */
router.get('/:deviceId/coordinate-history', apiRateLimit(), asyncHandler(async (req, res) => {
  const { deviceId } = req.params;
  const hoursAgo = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 720);
  
  const db = require('../database');
  const history = await db.getCoordinateHistory(deviceId, hoursAgo);
  
  res.json({
    success: true,
    data: history.map(log => ({
      coordinates: {
        x: log.coodX,
        y: log.coodY,
        z: log.coodZ
      },
      timestamp: log.timestamp,
      changeType: log.change_type,
      formattedTime: new Date(log.timestamp * 1000).toLocaleString('zh-CN')
    }))
  });
}));

module.exports = router;
