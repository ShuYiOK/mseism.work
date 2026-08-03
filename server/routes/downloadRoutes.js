/**
 * 记录下载路由
 * 提供「自定义分组变化记录」的列表查询、下载、删除、手动触发检测。
 *
 * 权限：全部接口仅 root 超级管理员可用。
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database');
const changeRecordService = require('../services/changeRecordService');
const { apiRateLimit } = require('../middlewares/rateLimitMiddleware');
const { authenticateToken, requireSuperAdmin } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../middlewares/errorHandler');

// 获取下载记录列表（按日期从新到旧，分页）
router.get('/', apiRateLimit(), authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const groupId = req.query.groupId || undefined;
  const groupName = req.query.groupName || undefined;
  const startDate = req.query.startDate || undefined;
  const endDate = req.query.endDate || undefined;

  const { rows, total } = await db.getDownloadRecords({ limit, offset, groupId, groupName, startDate, endDate });

  res.json({
    success: true,
    data: rows.map(r => ({
      id: r.id,
      group_id: r.group_id,
      group_name: r.group_name,
      file_name: r.file_name,
      file_size: r.file_size,
      device_count: r.device_count,
      change_summary: r.change_summary,
      map_status: r.map_status,
      snapshot_date: r.snapshot_date,
      created_at: r.created_at
    })),
    meta: { total, limit, offset }
  });
}));

// 获取单条记录元信息
router.get('/:id', apiRateLimit(), authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const record = await db.getDownloadRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({ success: true, data: record });
}));

// 下载 zip（流式）
router.get('/:id/download', apiRateLimit(), authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const record = await db.getDownloadRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  const absPath = path.join(changeRecordService.getDownloadsRoot(), record.file_path);
  if (!fs.existsSync(absPath)) {
    return res.status(410).json({ success: false, error: '文件已被移除或不存在' });
  }
  // 中文文件名兼容：filename* 用 UTF-8 编码
  const encodedName = encodeURIComponent(record.file_name);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
  res.download(absPath, record.file_name);
}));

// 删除记录（仅 root）
router.delete('/:id', apiRateLimit(), authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const record = await db.getDownloadRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  // 先删文件再删记录
  const absPath = path.join(changeRecordService.getDownloadsRoot(), record.file_path);
  try {
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (e) {
    console.warn('[downloads] 删除文件失败:', e.message);
  }
  await db.deleteDownloadRecord(record.id);
  res.json({ success: true, message: '记录已删除' });
}));

// 手动触发检测（仅 root）。可选 date=YYYY-MM-DD 补跑指定日期；forceAll=true 忽略变化全部导出
router.post('/check', apiRateLimit(), authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  let targetDate = new Date();
  if (req.body && req.body.date) {
    const d = new Date(req.body.date);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ success: false, error: 'date 格式无效，应为 YYYY-MM-DD' });
    }
    targetDate = d;
  }
  // 异步执行，立即返回（避免 HTTP 超时）
  const forceAll = !!(req.body && req.body.forceAll);
  res.json({ success: true, message: '检测已触发，请稍后刷新列表查看结果', data: { date: targetDate.toISOString().slice(0, 10), forceAll } });
  // 不 await，后台执行
  changeRecordService.runDailyChangeCheck(targetDate, { forceAll }).catch(err => {
    console.error('[downloads] 手动检测失败:', err.message);
  });
}));

module.exports = router;
