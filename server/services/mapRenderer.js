/**
 * 地图截图渲染服务
 *
 * 流程：有效坐标过滤 → WGS84→GCJ02 → 计算 bounds 选 zoom → SlippyMap 瓦片数学
 *      → 并发抓取高德瓦片 → sharp 拼成底图 → @napi-rs/canvas 叠加
 *      设备点/ID/经纬度网格/比例尺/图例/标题/时间戳 → 输出 PNG。
 *
 * 瓦片全失败时降级为纯网格示意图（不阻断主流程），返回 map_status='fallback'。
 * 全组无有效坐标时返回占位图，map_status='none'。
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const axios = require('axios');
const config = require('../config');
const { wgs84ToGcj02, outOfChina } = require('../utils/coordTransform');

const TILE_SIZE = 256;
const COLOR_ONLINE = '#4caf50';
const COLOR_OFFLINE = '#f44336';

// 惰性加载可选原生依赖（sharp / canvas），缺失时走降级路径
let _sharp = null;
let _canvas = null;
function getSharp() {
  if (_sharp === null) {
    try { _sharp = require('sharp'); } catch { _sharp = undefined; }
  }
  return _sharp;
}
function getCanvas() {
  if (_canvas === null) {
    try { _canvas = require('@napi-rs/canvas'); } catch { _canvas = undefined; }
  }
  return _canvas;
}

/**
 * 判断依赖是否就绪（供外部判断截图能力）
 */
function isRendererAvailable() {
  return !!getSharp() && !!getCanvas();
}

/**
 * 解析设备坐标为 GCJ02，过滤无效坐标
 * @param {Array} devices 设备列表（含 coodX=经度, coodY=纬度, coodZ=高程, online）
 * @returns {Array} 有效设备，附加 _lat/_lng(GCJ02)/_lngWgs/_latWgs/_elev
 */
function parseValidDevices(devices) {
  const valid = [];
  for (const d of devices || []) {
    const lngWgs = parseFloat(d.coodX);
    const latWgs = parseFloat(d.coodY);
    const elev = parseFloat(d.coodZ) || 0;
    if (!Number.isFinite(lngWgs) || !Number.isFinite(latWgs)) continue;
    if (lngWgs === 0 && latWgs === 0) continue;
    if (outOfChina(lngWgs, latWgs)) continue;
    const gcj = wgs84ToGcj02(latWgs, lngWgs);
    valid.push({ ...d, _lat: gcj.lat, _lng: gcj.lng, _latWgs: latWgs, _lngWgs: lngWgs, _elev: elev });
  }
  return valid;
}

// ============== SlippyMap 瓦片数学（Web Mercator） ==============

function lng2tile(lng, zoom) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
    Math.pow(2, zoom)
  );
}
function tile2lng(x, zoom) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}
function tile2lat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/**
 * 根据设备经纬度范围选择合适的 zoom（设备越密集 zoom 越大）
 */
function chooseZoom(validDevices) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const d of validDevices) {
    minLat = Math.min(minLat, d._lat);
    maxLat = Math.max(maxLat, d._lat);
    minLng = Math.min(minLng, d._lng);
    maxLng = Math.max(maxLng, d._lng);
  }
  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;
  // 目标：让跨度约占图宽 60%，留出边距
  const targetWidthDeg = lngSpan / 0.6;
  // zoom 粗估：360 / 2^z <= targetWidthDeg
  let z = Math.floor(Math.log2(360 / targetWidthDeg));
  // 高纬度经度被拉伸，结合纬度跨度再校正一次
  const latZoom = Math.floor(Math.log2(170 / (latSpan / 0.6)));
  z = Math.min(z, latZoom);
  return Math.max(8, Math.min(14, z));
}

/**
 * 并发抓取瓦片（带超时与重试）
 */
async function fetchTile(urlTemplate, subdomains, z, x, y) {
  const subdomainsArr = subdomains && subdomains.length ? subdomains : ['1'];
  const timeout = config.downloads.mapTileTimeout;
  const retry = config.downloads.mapTileRetry;
  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    const sd = subdomainsArr[(x + y) % subdomainsArr.length];
    const url = urlTemplate.replace('{s}', sd).replace('{x}', x).replace('{y}', y).replace('{z}', z);
    try {
      const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        headers: { 'User-Agent': 'mseism-map-renderer/1.0' }
      });
      if (resp.status === 200 && resp.data && resp.data.length > 0) {
        return Buffer.from(resp.data);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr || new Error('瓦片抓取失败');
  return null;
}

/**
 * 并发受限地执行任务列表
 */
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const cur = idx++;
      try { results[cur] = await tasks[cur](); }
      catch { results[cur] = null; }
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * 抓取并拼合底图为一张 PNG Buffer（含设备范围所需瓦片）
 * @returns {{buffer: Buffer|null, geo: object, z: number, tileRange: object}}
 *   geo 含画布像素到经纬度的映射信息；buffer 为 null 表示瓦片全失败
 */
async function composeBaseMap(validDevices) {
  const z = chooseZoom(validDevices);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const d of validDevices) {
    minLat = Math.min(minLat, d._lat); maxLat = Math.max(maxLat, d._lat);
    minLng = Math.min(minLng, d._lng); maxLng = Math.max(maxLng, d._lng);
  }
  const padTiles = 1;
  const minTileX = lng2tile(minLng, z) - padTiles;
  const maxTileX = lng2tile(maxLng, z) + padTiles;
  const minTileY = lat2tile(maxLat, z) - padTiles; // y 方向：纬度大→y 小
  const maxTileY = lat2tile(minLat, z) + padTiles;

  const cols = maxTileX - minTileX + 1;
  const rows = maxTileY - minTileY + 1;

  const tasks = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      tasks.push(() => fetchTile(
        config.downloads.mapTileUrl,
        config.downloads.mapTileSubdomains,
        z, tx, ty
      ));
    }
  }
  const buffers = await runWithConcurrency(tasks, config.downloads.mapTileMaxConcurrency);

  // 统计成功瓦片数
  const okCount = buffers.filter(Boolean).length;
  if (okCount === 0) {
    return { buffer: null, z, geo: null, tileRange: null };
  }

  const sharp = getSharp();
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
  // 用 sharp 把瓦片合成为一张底图（先建复合输入）
  const composites = [];
  let i = 0;
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      const buf = buffers[i++];
      if (buf) {
        composites.push({ input: buf, left: (tx - minTileX) * TILE_SIZE, top: (ty - minTileY) * TILE_SIZE });
      }
    }
  }
  // 以透明底为基础叠加所有瓦片
  const base = sharp({
    create: { width, height, channels: 4, background: { r: 244, g: 246, b: 250, alpha: 1 } }
  }).composite(composites).png();
  const buffer = await base.toBuffer();

  // 画布像素 → 经纬度映射
  const geo = {
    width, height,
    minLng: tile2lng(minTileX, z),
    maxLng: tile2lng(maxTileX + 1, z),
    maxLat: tile2lat(minTileY, z),
    minLat: tile2lat(maxTileY + 1, z),
  };
  return { buffer, z, geo, tileRange: { minTileX, maxTileX, minTileY, maxTileY } };
}

/**
 * 经纬度 → 画布像素坐标
 */
function projectToPixel(lat, lng, geo) {
  const x = ((lng - geo.minLng) / (geo.maxLng - geo.minLng)) * geo.width;
  const y = ((geo.maxLat - lat) / (geo.maxLat - geo.minLat)) * geo.height;
  return { x, y };
}

/**
 * 用 canvas 在底图上叠加绘制，输出 PNG Buffer
 */
async function drawOverlay(baseBuffer, geo, validDevices, group, fallback) {
  const canvas = getCanvas();
  const c = canvas.createCanvas(geo.width, geo.height);
  const ctx = c.getContext('2d');

  // 1) 底图（fallback 时为浅色背景，无瓦片）
  if (!fallback && baseBuffer) {
    const img = await canvas.loadImage(baseBuffer);
    ctx.drawImage(img, 0, 0, geo.width, geo.height);
  } else {
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(0, 0, geo.width, geo.height);
  }

  // 2) 经纬度网格
  drawGrid(ctx, geo);

  // 3) 设备点 + ID 标签
  ctx.font = 'bold 14px sans-serif';
  for (const d of validDevices) {
    const { x, y } = projectToPixel(d._lat, d._lng, geo);
    const color = d.online ? COLOR_ONLINE : COLOR_OFFLINE;
    // 外圈光晕
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = color + '40';
    ctx.fill();
    // 实心点
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // ID 标签
    const label = String(d.device || d.name || d.id);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const tw = ctx.measureText(label).width;
    ctx.fillRect(x + 10, y - 10, tw + 8, 20);
    ctx.fillStyle = '#222';
    ctx.fillText(label, x + 14, y + 5);
  }

  // 4) 标题 + 图例 + 比例尺 + 时间戳 + 四角经纬度
  drawDecoration(ctx, geo, validDevices, group, fallback);

  return await c.toBuffer('image/png');
}

function drawGrid(ctx, geo) {
  // 在卫星底图上用亮色线+阴影提升对比度
  ctx.lineWidth = 1;
  ctx.font = '11px sans-serif';

  const latStep = chooseNiceStep(geo.maxLat - geo.minLat);
  const lngStep = chooseNiceStep(geo.maxLng - geo.minLng);

  // 经度竖线
  const lngStart = Math.ceil(geo.minLng / lngStep) * lngStep;
  for (let lng = lngStart; lng <= geo.maxLng; lng += lngStep) {
    const { x } = projectToPixel(geo.maxLat, lng, geo);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, geo.height); ctx.stroke();
    drawGridLabel(ctx, `${lng.toFixed(2)}°E`, x + 3, geo.height - 6);
  }
  // 纬度横线
  const latStart = Math.ceil(geo.minLat / latStep) * latStep;
  for (let lat = latStart; lat <= geo.maxLat; lat += latStep) {
    const { y } = projectToPixel(lat, geo.minLng, geo);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(geo.width, y); ctx.stroke();
    drawGridLabel(ctx, `${lat.toFixed(2)}°N`, 4, y - 3);
  }
}

// 网格标签：加半透明底框，确保任意底图上都可读
function drawGridLabel(ctx, text, x, y) {
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(x - 2, y - 11, tw + 4, 14);
  ctx.fillStyle = '#222';
  ctx.fillText(text, x, y);
}

function chooseNiceStep(span) {
  const raw = span / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  let nice;
  if (n < 1.5) nice = 1;
  else if (n < 3) nice = 2;
  else if (n < 7) nice = 5;
  else nice = 10;
  return nice * pow;
}

function drawDecoration(ctx, geo, validDevices, group, fallback) {
  // 顶部标题条
  const title = `${group ? group.name + ' ' : ''}设备分布图${fallback ? '（示意图，瓦片获取失败）' : ''}`;
  ctx.font = 'bold 18px sans-serif';
  const tw = ctx.measureText(title).width;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, tw + 30, 34);
  ctx.fillStyle = '#fff';
  ctx.fillText(title, 15, 23);

  // 右上角图例
  const lx = geo.width - 150, ly = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(lx, ly, 140, 56);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(lx, ly, 140, 56);
  ctx.fillStyle = COLOR_ONLINE;
  ctx.beginPath(); ctx.arc(lx + 16, ly + 18, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.font = '13px sans-serif';
  ctx.fillText('在线设备', lx + 30, ly + 22);
  ctx.fillStyle = COLOR_OFFLINE;
  ctx.beginPath(); ctx.arc(lx + 16, ly + 40, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillText('离线设备', lx + 30, ly + 44);

  // 左下角：生成时间 + 设备数 + 四角经纬度
  const now = new Date();
  const ts = `生成时间: ${now.toLocaleString('zh-CN', { hour12: false })}`;
  const cnt = `设备数: ${validDevices.length}`;
  const corners = [
    `左上 ${geo.maxLat.toFixed(4)}N, ${geo.minLng.toFixed(4)}E`,
    `右下 ${geo.minLat.toFixed(4)}N, ${geo.maxLng.toFixed(4)}E`
  ];
  ctx.font = '12px sans-serif';
  const lines = [ts, cnt, ...corners];
  const boxH = lines.length * 18 + 12;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(10, geo.height - boxH - 10, 320, boxH);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.strokeRect(10, geo.height - boxH - 10, 320, boxH);
  ctx.fillStyle = '#333';
  lines.forEach((line, i) => {
    ctx.fillText(line, 18, geo.height - boxH + 6 + i * 18);
  });
}

/**
 * 渲染某分组的地图截图到 outPath
 * @returns {Promise<{status: string, path: string}>} status: ok/fallback/none
 */
async function renderGroupMapPng(devices, group, outPath) {
  const canvas = getCanvas();
  const validDevices = parseValidDevices(devices);

  // 无任何有效坐标：占位图
  if (validDevices.length === 0) {
    await renderPlaceholder(outPath, group, '该分组暂无有效坐标的设备');
    return { status: 'none', path: outPath };
  }

  // 单点情况补一个最小范围，避免 bounds 退化
  if (validDevices.length === 1) {
    const d = validDevices[0];
    validDevices.push({ ...d, _lat: d._lat + 0.001, _lng: d._lng + 0.001 });
  }

  let baseBuffer = null;
  let geo = null;
  let fallback = false;

  // 仅当依赖齐备时尝试抓瓦片底图
  if (getSharp() && canvas) {
    try {
      const composed = await composeBaseMap(validDevices);
      baseBuffer = composed.buffer;
      geo = composed.geo;
    } catch (e) {
      console.warn('[mapRenderer] 底图拼合失败，降级为示意图:', e.message);
    }
  }

  if (!baseBuffer || !geo) {
    // 降级：构造一个覆盖设备范围的虚拟 geo 画布
    fallback = true;
    geo = buildFallbackGeo(validDevices);
  }

  if (!canvas) {
    // canvas 库缺失：写一个文本占位，避免阻断
    await renderPlaceholder(outPath, group, '截图依赖未安装（@napi-rs/canvas），无法渲染地图');
    return { status: 'fallback', path: outPath };
  }

  const pngBuffer = await drawOverlay(baseBuffer, geo, validDevices, group, fallback);
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await fsp.writeFile(outPath, pngBuffer);
  return { status: fallback ? 'fallback' : 'ok', path: outPath };
}

function buildFallbackGeo(validDevices) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const d of validDevices) {
    minLat = Math.min(minLat, d._lat); maxLat = Math.max(maxLat, d._lat);
    minLng = Math.min(minLng, d._lng); maxLng = Math.max(maxLng, d._lng);
  }
  const latPad = (maxLat - minLat) * 0.2 || 0.01;
  const lngPad = (maxLng - minLng) * 0.2 || 0.01;
  const width = config.downloads.mapImageWidth;
  const height = Math.max(600, Math.round(width * 0.7));
  return {
    width, height,
    minLat: minLat - latPad, maxLat: maxLat + latPad,
    minLng: minLng - lngPad, maxLng: maxLng + lngPad,
  };
}

async function renderPlaceholder(outPath, group, message) {
  const canvas = getCanvas();
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  if (!canvas) {
    await fsp.writeFile(outPath, ''); // 空 png 占位
    return;
  }
  const width = config.downloads.mapImageWidth;
  const height = Math.max(600, Math.round(width * 0.7));
  const c = canvas.createCanvas(width, height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eef2f7';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, width, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${group ? group.name + ' ' : ''}设备分布图`, 20, 33);
  ctx.fillStyle = '#666';
  ctx.font = '18px sans-serif';
  ctx.fillText(message, width / 2 - ctx.measureText(message).width / 2, height / 2);
  await fsp.writeFile(outPath, c.toBuffer('image/png'));
}

module.exports = {
  isRendererAvailable,
  parseValidDevices,
  renderGroupMapPng,
};
