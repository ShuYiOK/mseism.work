/**
 * 分组路由
 * 处理分组相关的 API 请求
 * 支持多设备数据同步 - 事件携带完整映射数据
 */

const express = require('express');
const router = express.Router();
const wsManager = require('../utils/websocketManager');
const groupService = require('../services/groupService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { groupSchemas, validateBody } = require('../utils/validators');
const { ErrorCodes, createErrorResponse } = require('../utils/errorCodes');
const { asyncHandler } = require('../middlewares/errorHandler');

// 获取广播消息（包含完整数据）
async function getBroadcastData(eventType, extraData = {}) {
  const mappings = await groupService.getDeviceGroupMappings();
  return {
    eventType,
    timestamp: Date.now(),
    mappings,
    ...extraData
  };
}

// 获取所有分组
router.get('/', apiRateLimit(), asyncHandler(async (req, res) => {
  const groups = await groupService.getAllGroups();
  res.json({ success: true, data: groups });
}));

// 获取所有分组及其设备（放在 /:id 之前）
router.get('/with-devices', apiRateLimit(), asyncHandler(async (req, res) => {
  const groups = await groupService.getAllGroupsWithDevices();
  res.json({ success: true, data: groups });
}));

// 获取设备分组映射（放在 /:id 之前）
router.get('/mappings', apiRateLimit(), asyncHandler(async (req, res) => {
  const mappings = await groupService.getDeviceGroupMappings();
  res.json({ success: true, data: mappings });
}));

// 获取分组设备统计（放在 /:id 之前）
router.get('/stats', apiRateLimit(), asyncHandler(async (req, res) => {
  const stats = await groupService.getGroupDeviceStats();
  res.json({ success: true, data: stats });
}));

// 获取单个分组（放在具体路径路由之后）
router.get('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  const group = await groupService.getGroupById(req.params.id);
  if (!group) {
    return res.status(404).json({ success: false, error: '分组不存在' });
  }
  res.json({ success: true, data: group });
}));

// 创建分组
router.post('/', apiRateLimit(), validateBody(groupSchemas.create), asyncHandler(async (req, res) => {
  const { name, description, color, sort_order } = req.body;
  const group = await groupService.createGroup(name, description, color, sort_order);
  const broadcastData = await getBroadcastData('group:create', { group });
  wsManager.broadcastMessage('group:sync', broadcastData);
  console.log('[WS] 广播分组创建事件（携带完整数据）: ' + group.name);
  res.json({
    success: true,
    data: group,
    meta: { timestamp: new Date().toISOString() }
  });
}));

// 更新分组
router.put('/:id', apiRateLimit(), validateBody(groupSchemas.update), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, color, sort_order } = req.body;
  const group = await groupService.updateGroup(id, name, description, color, sort_order);
  const broadcastData = await getBroadcastData('group:update', { group });
  wsManager.broadcastMessage('group:sync', broadcastData);
  console.log('[WS] 广播分组更新事件（携带完整数据）: ' + group.name);
  res.json({
    success: true,
    data: group,
    meta: { timestamp: new Date().toISOString() }
  });
}));

// 删除分组
router.delete('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  await groupService.deleteGroup(groupId);
  const broadcastData = await getBroadcastData('group:delete', { groupId });
  wsManager.broadcastMessage('group:sync', broadcastData);
  console.log('[WS] 广播分组删除事件（携带完整数据）: ' + groupId);
  res.json({ success: true, message: '删除成功' });
}));

// 获取分组的设备
// 获取可用于添加到分组的设备（排除已归属其他自定义分组的设备）
router.get('/:id/available-devices', apiRateLimit(), asyncHandler(async (req, res) => {
  const { id: groupId } = req.params;
  const availableDevices = await groupService.getAvailableDevicesForGroup(groupId);
  res.json({ success: true, data: availableDevices });
}));

router.get('/:id/devices', apiRateLimit(), asyncHandler(async (req, res) => {
  const devices = await groupService.getGroupDevices(req.params.id);
  res.json({ success: true, data: devices });
}));

// 批量添加设备到分组（含唯一性校验）
router.post('/:id/devices', apiRateLimit(), validateBody(groupSchemas.addDevice), asyncHandler(async (req, res) => {
  const { id: groupId } = req.params;
  const { deviceId } = req.body;

  try {
    const result = await groupService.addDeviceToGroup(deviceId, groupId);
    if (!result) {
      return res.status(400).json({ success: false, error: '设备已在分组中' });
    }
  } catch (err) {
    if (err.code === 'DEVICE_ALREADY_GROUPED') {
      return res.status(409).json({
        success: false,
        error: err.message,
        code: 'DEVICE_ALREADY_GROUPED',
        existingGroup: err.existingGroup
      });
    }
    throw err;
  }

  const group = await groupService.getGroupById(groupId);
  const broadcastData = await getBroadcastData('group:device_added', {
    deviceId,
    groupId,
    group
  });
  wsManager.broadcastMessage('group:sync', broadcastData);
  console.log('[WS] 广播设备添加到分组事件（携带完整数据）: ' + deviceId + ' -> ' + groupId);
  res.json({
    success: true,
    message: '添加成功',
    meta: { timestamp: new Date().toISOString() }
  });
}));

// 从分组移除设备
router.delete('/:id/devices/:deviceId', apiRateLimit(), asyncHandler(async (req, res) => {
  const { id: groupId, deviceId } = req.params;
  await groupService.removeDeviceFromGroup(deviceId, groupId);
  const group = await groupService.getGroupById(groupId);
  const broadcastData = await getBroadcastData('group:device_removed', {
    deviceId,
    groupId,
    group
  });
  wsManager.broadcastMessage('group:sync', broadcastData);
  console.log('[WS] 广播设备从分组移除事件（携带完整数据）: ' + deviceId + ' <- ' + groupId);
  res.json({ success: true, message: '移除成功' });
}));

module.exports = router;
