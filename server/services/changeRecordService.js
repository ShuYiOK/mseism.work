/**
 * 分组变化记录服务
 *
 * 职责：每日 0 点（可手动触发）检测所有「自定义分组」的变化（名称/设备ID集合/设备坐标），
 *      对发生变化的分组导出「设备位置 CSV + 地图截图」打包为 zip，写入下载记录表，
 *      清理超过保留期的文件与记录。
 *
 * 监控范围约束：仅遍历 device_groups（getAllGroupsWithDevices），未加入任何分组的设备不参与。
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');

const config = require('../config');
const db = require('../database');
const groupService = require('./groupService');
const { renderGroupMapPng } = require('./mapRenderer');

const DOWNLOADS_ROOT = path.resolve(__dirname, '..', config.downloads.dir);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// 惰性加载 archiver（缺失时调用打包才报错，不阻断模块加载与其它纯函数使用）
function getArchiver() {
  return require('archiver');
}

// 运行状态：防止并发与重复执行
let _running = false;

/**
 * 计算成员设备ID集合签名（排序后 md5）
 */
function computeDeviceSignature(devices) {
  const ids = (devices || []).map(d => d.id).filter(Boolean).sort();
  return crypto.createHash('md5').update(ids.join(',')).digest('hex');
}

/**
 * 计算成员坐标集合签名（id:coodX:coodY:coodZ 排序后 md5）
 */
function computeCoordinateSignature(devices) {
  const items = (devices || [])
    .map(d => `${d.id}:${parseFloat(d.coodX) || 0}:${parseFloat(d.coodY) || 0}:${parseFloat(d.coodZ) || 0}`)
    .sort();
  return crypto.createHash('md5').update(items.join('|')).digest('hex');
}

/**
 * 比对当前状态与最近快照，返回变化类型数组
 */
function detectChanges(group, latest) {
  const changes = [];
  if (!latest) {
    // 首次出现：留底
    return ['首次记录'];
  }
  if (group.name !== latest.group_name) {
    changes.push('分组名称变化');
  }
  const curDevSig = computeDeviceSignature(group.devices);
  if (curDevSig !== latest.device_signature) {
    changes.push('设备成员变化');
  }
  const curCoordSig = computeCoordinateSignature(group.devices);
  if (curCoordSig !== latest.coordinate_signature) {
    changes.push('设备坐标变化');
  }
  return changes;
}

/**
 * 生成设备位置 CSV（UTF-8 BOM，Excel 友好）
 */
function buildCsv(group, devices) {
  const now = new Date();
  const ts = now.toLocaleString('zh-CN', { hour12: false });
  const header = ['设备ID', '设备名称', 'IP地址', '在线状态', '经度(coodX)', '纬度(coodY)', '高程/米(coodZ)', '所属分组', '生成时间'];
  const lines = [header.join(',')];
  for (const d of devices) {
    const row = [
      csvCell(d.id),
      csvCell(d.name),
      csvCell(d.ip_address),
      d.online ? '在线' : '离线',
      parseFloat(d.coodX) || 0,
      parseFloat(d.coodY) || 0,
      parseFloat(d.coodZ) || 0,
      csvCell(group.name),
      ts
    ];
    lines.push(row.join(','));
  }
  const csv = '\ufeff' + lines.join('\r\n');
  return csv;
}

function csvCell(v) {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * 文件名 sanitize：替换文件系统非法字符
 */
function sanitizeFileName(name) {
  return String(name || 'unknown').replace(/[\/\\:*?"<>|]/g, '_').trim() || 'unknown';
}

function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 为单个分组生成 zip（CSV + 地图截图）
 */
async function exportGroupRecord(group, changes, dateStr) {
  const monthDir = path.join(DOWNLOADS_ROOT, dateStr.slice(0, 7));
  await fsp.mkdir(monthDir, { recursive: true });

  const safeName = sanitizeFileName(group.name);
  const baseName = `${safeName}_${dateStr}`;
  const zipName = `${baseName}.zip`;
  const zipPath = path.join(monthDir, zipName);

  // 1) CSV
  const csv = buildCsv(group, group.devices);

  // 2) 地图截图（先写到临时文件）
  const tmpDir = path.join(monthDir, '.tmp');
  await fsp.mkdir(tmpDir, { recursive: true });
  const mapPath = path.join(tmpDir, `${baseName}.png`);
  let mapStatus = 'ok';
  try {
    const r = await renderGroupMapPng(group.devices, group, mapPath);
    mapStatus = r.status;
  } catch (e) {
    console.error(`[changeRecord] 截图失败(分组=${group.name}):`, e.message);
    mapStatus = 'fallback';
  }

  // 3) 变化说明 txt（便于查阅）
  const changeTxt = [
    `分组名称: ${group.name}`,
    `生成日期: ${dateStr}`,
    `变化摘要: ${changes.join('；')}`,
    `设备数量: ${group.devices.length}`,
    `截图状态: ${mapStatus}（ok=带地形底图/fallback=示意图/none=无有效坐标）`,
    `生成时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
    '',
    '说明：本记录仅包含发生变化时该自定义分组内全部设备的设备位置快照。'
  ].join('\r\n');

  // 4) 打包 zip
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = getArchiver()('zip', { zlib: { level: 6 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.append(Buffer.from(csv, 'utf8'), { name: `${baseName}_设备位置.csv` });
    archive.append(Buffer.from(changeTxt, 'utf8'), { name: `${baseName}_变化说明.txt` });
    if (fs.existsSync(mapPath) && fs.statSync(mapPath).size > 0) {
      archive.file(mapPath, { name: `${baseName}_地图截图.png` });
    }
    archive.finalize();
  });

  // 清理临时 png
  try { await fsp.unlink(mapPath); } catch {}

  const stat = await fsp.stat(zipPath);
  const relPath = path.relative(DOWNLOADS_ROOT, zipPath);

  // 5) 写入下载记录（group_name 用于分组被改名后仍可追溯本次记录对应的原分组）
  const record = await db.saveDownloadRecord({
    group_id: group.id,
    group_name: group.name,
    file_name: zipName,
    file_path: relPath,
    file_size: stat.size,
    device_count: group.devices.length,
    change_summary: changes.join('；'),
    map_status: mapStatus,
    snapshot_date: dateStr
  });

  return record;
}

/**
 * 主流程：检测所有自定义分组变化并导出
 * @param {Date} targetDate 目标日期（默认今天）
 * @param {object} opts { forceAll?: boolean } forceAll=true 时忽略变化，全部导出
 * @returns {Promise<{date, total, changed, exported}>}
 */
async function runDailyChangeCheck(targetDate = new Date(), opts = {}) {
  if (_running) {
    console.warn('[changeRecord] 已有检测任务在运行，跳过本次');
    return { skipped: true };
  }
  _running = true;
  const dateStr = dateToStr(targetDate);
  let result = { date: dateStr, total: 0, changed: 0, exported: 0, errors: [] };

  try {
    // 确保根目录存在
    await fsp.mkdir(DOWNLOADS_ROOT, { recursive: true });

    // 仅遍历自定义分组（包含其成员设备）
    const groups = await groupService.getAllGroupsWithDevices();

    for (const group of groups) {
      result.total++;
      // 兜底：确保 devices 是数组
      if (!Array.isArray(group.devices)) group.devices = [];

      // 与「该日期之前最近的一条快照」比对（支持补跑历史日期）
      const latest = await db.getGroupSnapshotOnOrBefore(group.id, dateStr);

      const changes = opts.forceAll ? ['手动强制导出'] : detectChanges(group, latest);

      if (changes.length === 0) {
        // 未变化：仍写当日快照（保持基准连续），但不导出
        await db.saveGroupSnapshot({
          group_id: group.id,
          group_name: group.name,
          device_signature: computeDeviceSignature(group.devices),
          coordinate_signature: computeCoordinateSignature(group.devices),
          device_count: group.devices.length,
          snapshot_date: dateStr
        });
        continue;
      }

      result.changed++;
      try {
        await exportGroupRecord(group, changes, dateStr);
        result.exported++;
      } catch (e) {
        console.error(`[changeRecord] 导出失败(分组=${group.name}):`, e.message);
        result.errors.push({ group: group.name, error: e.message });
      }

      // 写入当日新快照（作为下次比对基准）
      await db.saveGroupSnapshot({
        group_id: group.id,
        group_name: group.name,
        device_signature: computeDeviceSignature(group.devices),
        coordinate_signature: computeCoordinateSignature(group.devices),
        device_count: group.devices.length,
        snapshot_date: dateStr
      });
    }

    // 清理过期文件与记录
    try {
      await cleanupExpired();
    } catch (e) {
      console.error('[changeRecord] 清理过期文件失败:', e.message);
    }

    console.log(`[changeRecord] 检测完成 date=${dateStr} total=${result.total} changed=${result.changed} exported=${result.exported}`);
    return result;
  } finally {
    _running = false;
  }
}

/**
 * 清理超过保留期的 zip 文件与下载记录
 */
async function cleanupExpired() {
  const retentionDays = config.downloads.retentionDays;
  const beforeDate = new Date(Date.now() - retentionDays * ONE_DAY_MS);
  const beforeStr = dateToStr(beforeDate);

  const expired = await db.getDownloadRecordsBeforeDate(beforeStr);
  if (expired.length === 0) return { deleted: 0 };

  let deleted = 0;
  for (const rec of expired) {
    try {
      const absPath = path.join(DOWNLOADS_ROOT, rec.file_path);
      await fsp.unlink(absPath);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`[changeRecord] 删除文件失败: ${rec.file_path}:`, e.message);
      }
    }
    await db.deleteDownloadRecord(rec.id);
    deleted++;
  }

  // 清理空的月份子目录
  await cleanupEmptyMonthDirs();

  console.log(`[changeRecord] 已清理 ${deleted} 条过期记录（早于 ${beforeStr}）`);
  return { deleted };
}

async function cleanupEmptyMonthDirs() {
  let entries = [];
  try { entries = await fsp.readdir(DOWNLOADS_ROOT, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory() && /^\d{4}-\d{2}$/.test(entry.name)) {
      const dir = path.join(DOWNLOADS_ROOT, entry.name);
      const files = await fsp.readdir(dir);
      const realFiles = files.filter(f => f !== '.tmp');
      if (realFiles.length === 0) {
        // 删除残留 .tmp
        for (const f of files) {
          try { await fsp.unlink(path.join(dir, f)); } catch {}
        }
        try { await fsp.rmdir(dir); } catch {}
      }
    }
  }
}

/**
 * 启动时补跑：若今天还没有任何分组快照，说明今天的定时任务可能错过了，补跑一次
 */
async function runStartupBackfillIfNeeded() {
  try {
    const groups = await groupService.getAllGroupsWithDevices();
    if (groups.length === 0) return;
    // 任选一组判断今天是否已有快照
    const today = dateToStr(new Date());
    const hasToday = await db.hasGroupSnapshotOnDate(groups[0].id, today);
    if (!hasToday) {
      console.log('[changeRecord] 启动补跑：今日尚未生成快照，开始执行检测');
      await runDailyChangeCheck(new Date());
    }
  } catch (e) {
    console.error('[changeRecord] 启动补跑失败:', e.message);
  }
}

/**
 * 获取导出根目录（供路由层做绝对路径拼接）
 */
function getDownloadsRoot() {
  return DOWNLOADS_ROOT;
}

module.exports = {
  runDailyChangeCheck,
  runStartupBackfillIfNeeded,
  cleanupExpired,
  exportGroupRecord,
  computeDeviceSignature,
  computeCoordinateSignature,
  detectChanges,
  buildCsv,
  getDownloadsRoot,
};
