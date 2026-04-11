/**
 * 分组路由
 * 处理分组相关的 API 请求
 */

const express = require('express');
const router = express.Router();
const wsManager = require('../utils/websocketManager');
const groupService = require('../services/groupService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');

// 异步处理中间件
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 获取所有分组
router.get('/', apiRateLimit(), asyncHandler(async (req, res) => {
  const groups = await groupService.getAllGroups();
  res.json({ success: true, data: groups });
}));

// 获取单个分组
router.get('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  const group = await groupService.getGroupById(req.params.id);
  if (!group) {
    return res.status(404).json({ success: false, error: '分组不存在' });
  }
  res.json({ success: true, data: group });
}));

// 创建分组
router.post('/', apiRateLimit(), asyncHandler(async (req, res) => {
  const { name, description, color, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: '分组名称不能为空' });
  }
  const group = await groupService.createGroup(name, description, color, sort_order);
  wsManager.broadcastMessage('group:create', group);
  console.log('[WS] 广播分组创建事件: ' + group.name);
  res.json({ success: true, data: group });
}));

// 更新分组
router.put('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, color, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: '分组名称不能为空' });
  }
  const group = await groupService.updateGroup(id, name, description, color, sort_order);
  wsManager.broadcastMessage('group:update', group);
  console.log('[WS] 广播分组更新事件: ' + group.name);
  res.json({ success: true, data: group });
}));

// 删除分组
router.delete('/:id', apiRateLimit(), asyncHandler(async (req, res) => {
  await groupService.deleteGroup(req.params.id);
  res.json({ success: true, message: '删除成功' });
  wsManager.broadcastMessage('group:delete', { id: req.params.id });
  console.log('[WS] 广播分组删除事件: ' + req.params.id);
}));

// 获取分组的设备
router.get('/:id/devices', apiRateLimit(), asyncHandler(async (req, res) => {
  const devices = await groupService.getGroupDevices(req.params.id);
  res.json({ success: true, data: devices });
}));

// 添加设备到分组
router.post('/:id/devices', apiRateLimit(), asyncHandler(async (req, res) => {
  const { id: groupId } = req.params;
  const { deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, error: '设备 ID 不能为空' });
  }
  const result = await groupService.addDeviceToGroup(deviceId, groupId);
  if (!result) {
    return res.status(400).json({ success: false, error: '设备已在分组中' });
  }
  const group = await groupService.getGroupById(groupId);
  wsManager.broadcastMessage('group:device_added', { deviceId, groupId, group });
  console.log('[WS] 广播设备添加到分组事件: ' + deviceId + ' -> ' + groupId);
  res.json({ success: true, message: '添加成功' });
}));

// 从分组移除设备
router.delete('/:id/devices/:deviceId', apiRateLimit(), asyncHandler(async (req, res) => {
  const { id: groupId, deviceId } = req.params;
  await groupService.removeDeviceFromGroup(deviceId, groupId);
  const group = await groupService.getGroupById(groupId);
  wsManager.broadcastMessage('group:device_removed', { deviceId, groupId, group });
  console.log('[WS] 广播设备从分组移除事件: ' + deviceId + ' <- ' + groupId);
  res.json({ success: true, message: '移除成功' });
}));

// 获取所有分组及其设备
router.get('/with-devices', apiRateLimit(), asyncHandler(async (req, res) => {
  const groups = await groupService.getAllGroupsWithDevices();
  res.json({ success: true, data: groups });
}));

// 获取设备分组映射
router.get('/mappings', apiRateLimit(), asyncHandler(async (req, res) => {
  const mappings = await groupService.getDeviceGroupMappings();
  res.json({ success: true, data: mappings });
}));

// 获取分组设备统计
router.get('/stats', apiRateLimit(), asyncHandler(async (req, res) => {
  const stats = await groupService.getGroupDeviceStats();
  res.json({ success: true, data: stats });
}));

module.exports = router;
