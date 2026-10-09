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

// 中文字体：优先使用系统已安装的中文字体，缺失时回退到通用字体（会显示为方框）
let CJK_FONT_FAMILY = 'sans-serif';
const CJK_FONT_PREFER = [
  'Noto Sans CJK SC', 'Noto Sans SC', 'Source Han Sans SC',
  'WenQuanYi Micro Hei', 'WenQuanYi Zen Hei', 'Microsoft YaHei', 'SimHei'
];
function resolveCjkFont() {
  if (CJK_FONT_FAMILY !== 'sans-serif') return CJK_FONT_FAMILY;
  try {
    const canvas = getCanvas();
    if (!canvas) return CJK_FONT_FAMILY;
    const available = new Set((canvas.GlobalFonts.families || []).map(f => f.family));
    for (const name of CJK_FONT_PREFER) {
      if (available.has(name)) {
        CJK_FONT_FAMILY = '"' + name + '", sans-serif';
        return CJK_FONT_FAMILY;
      }
    }
    console.warn('[mapRenderer] 未找到中文字体，中文可能显示为方框。可用字体: ' + Array.from(available).join(', '));
  } catch (e) {
    console.warn('[mapRenderer] 中文字体探测失败:', e.message);
  }
  return CJK_FONT_FAMILY;
}


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
 * 根据设备经纬度范围选择 zoom：目标是让设备簇在输出图中占满设定比例
 */
function chooseZoom(validDevices) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const d of validDevices) {
    minLat = Math.min(minLat, d._lat);
    maxLat = Math.max(maxLat, d._lat);
    minLng = Math.min(minLng, d._lng);
    maxLng = Math.max(maxLng, d._lng);
  }
  const outWidth = config.downloads.mapImageWidth || 1200;
  const fill = 0.82;                 // 设备簇目标占输出宽度的比例
  const targetPx = outWidth * fill;

  const meanLat = (minLat + maxLat) / 2;
  const cosLat = Math.max(Math.cos(meanLat * Math.PI / 180), 0.2);
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const latSpan = Math.max(maxLat - minLat, 1e-6);

  // 相对世界宽度的跨度占比（纬度按墨卡托放大 1/cos(lat)）
  const lngRatio = lngSpan / 360;
  const latRatio = (latSpan / 360) / cosLat;
  const spanRatio = Math.max(lngRatio, latRatio);

  // 世界像素 = 256 * 2^z；令 spanRatio * world ≈ targetPx
  const z = Math.log2(targetPx / (256 * spanRatio));
  return Math.max(8, Math.min(17, Math.round(z)));
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

  const okCount = buffers.filter(Boolean).length;
  if (okCount === 0) {
    return { buffer: null, z, geo: null, tileRange: null };
  }

  const sharp = getSharp();
  const width = cols * TILE_SIZE;
  const height = rows * TILE_SIZE;
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
  const base = sharp({
    create: { width, height, channels: 4, background: { r: 244, g: 246, b: 250, alpha: 1 } }
  }).composite(composites).png();
  const buffer = await base.toBuffer();

  const geoFull = {
    width, height,
    minLng: tile2lng(minTileX, z),
    maxLng: tile2lng(maxTileX + 1, z),
    maxLat: tile2lat(minTileY, z),
    minLat: tile2lat(maxTileY + 1, z),
  };

  // 按设备包围盒裁剪并放大到目标输出尺寸，让台站铺满整张截图
  const cropped = await cropToDevices(sharp, buffer, geoFull, validDevices);
  return { buffer: cropped.buffer, z, geo: cropped.geo, tileRange: { minTileX, maxTileX, minTileY, maxTileY } };
}

/**
 * 以设备像素包围盒为中心裁剪底图，使台站铺满整张截图。
 * 边距取簇跨度的 12%（并有最小像素边距）；统一为 4:3 构图后缩放到 MAP_IMAGE_WIDTH。
 * 放大倍率受限，避免设备高度聚集时过度插值变糊。
 */
async function cropToDevices(sharp, buffer, geo, validDevices) {
  const outWidth = config.downloads.mapImageWidth || 1200;
  const MAX_UPSCALE = 3;

  const pts = validDevices.map(d => projectToPixel(d._lat, d._lng, geo));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const margin = Math.max(24, Math.round(Math.max(spanX, spanY) * 0.12));

  let left = minX - margin, right = maxX + margin;
  let top = minY - margin, bottom = maxY + margin;

  // 统一为 4:3 构图（不足的一边居中扩展）
  const targetAspect = 4 / 3;
  const w0 = right - left, h0 = bottom - top;
  if (w0 / h0 < targetAspect) {
    const extra = (h0 * targetAspect - w0) / 2;
    left -= extra; right += extra;
  } else {
    const extra = (w0 / targetAspect - h0) / 2;
    top -= extra; bottom += extra;
  }

  // 限制放大倍率
  const minCropW = outWidth / MAX_UPSCALE;
  if (right - left < minCropW) {
    const cx = (left + right) / 2;
    left = cx - minCropW / 2;
    right = cx + minCropW / 2;
  }

  // 夹到画布范围
  left = Math.max(0, Math.floor(left));
  top = Math.max(0, Math.floor(top));
  right = Math.min(geo.width, Math.ceil(right));
  bottom = Math.min(geo.height, Math.ceil(bottom));

  const cropW = Math.max(1, right - left);
  const cropH = Math.max(1, bottom - top);
  const outHeight = Math.max(240, Math.round(outWidth * cropH / cropW));

  const outBuffer = await sharp(buffer)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(outWidth, outHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  const geoOut = {
    width: outWidth,
    height: outHeight,
    minLng: geo.minLng + (left / geo.width) * (geo.maxLng - geo.minLng),
    maxLng: geo.minLng + (right / geo.width) * (geo.maxLng - geo.minLng),
    maxLat: geo.maxLat - (top / geo.height) * (geo.maxLat - geo.minLat),
    minLat: geo.maxLat - (bottom / geo.height) * (geo.maxLat - geo.minLat),
  };
  return { buffer: outBuffer, geo: geoOut };
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
  resolveCjkFont();
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

  // 3) 先画全部设备点（保证点本身不被标签压住）
  const MARKER_R = 7;
  const HALO_R = 12;
  const markers = validDevices.map((d) => {
    const p = projectToPixel(d._lat, d._lng, geo);
    return { x: p.x, y: p.y, d };
  });

  for (const m of markers) {
    const color = m.d.online ? COLOR_ONLINE : COLOR_OFFLINE;
    // 外圈光晕
    ctx.beginPath();
    ctx.arc(m.x, m.y, HALO_R, 0, Math.PI * 2);
    ctx.fillStyle = color + '40';
    ctx.fill();
    // 实心点
    ctx.beginPath();
    ctx.arc(m.x, m.y, MARKER_R, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 4) 设备标签（自动避让 + 引线）
  drawDeviceLabels(ctx, geo, markers);

  // 5) 标题 + 图例 + 比例尺 + 时间戳 + 四角经纬度
  drawDecoration(ctx, geo, validDevices, group, fallback);

  return await c.toBuffer('image/png');
}

/**
 * 设备标签文本：优先使用短编号（如 "24007"），编号缺失或过长时退回设备名称。
 */
function labelForDevice(d) {
  const id = d && d.id != null ? String(d.id).trim() : '';
  if (id && id.length <= 12) return id;
  const nm = d && (d.name || d.device) ? String(d.name || d.device).trim() : '';
  return nm || id || '?';
}

function rectsOverlap(a, b) {
  return !(a.x2 <= b.x1 || b.x2 <= a.x1 || a.y2 <= b.y1 || b.y2 <= a.y1);
}

/**
 * 标签避让布局：对每个设备点按「右/左/上/下/四个斜向」× 多档距离搜索空位，
 * 避开其它设备点与已放置的标签；实在放不下时退回默认右侧位置。
 * 标签被推离设备点时补一条引线，保持对应关系清晰。
 */
function drawDeviceLabels(ctx, geo, markers) {
  const LABEL_H = 20;
  const PAD_X = 6;
  const GAP = 6;
  const MARGIN = 4;
  const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  const DISTS = [1, 1.6, 2.4, 3.4, 4.6];

  ctx.font = 'bold 13px ' + CJK_FONT_FAMILY;
  ctx.textBaseline = 'middle';

  const obstacles = markers.map((m) => ({ x1: m.x - 13, y1: m.y - 13, x2: m.x + 13, y2: m.y + 13 }));
  const items = markers.map((m) => ({ m, label: labelForDevice(m.d), w: ctx.measureText(labelForDevice(m.d)).width + PAD_X * 2 }));

  // 从上到下放置，让上方标签优先占据理想位置
  const order = items.map((_, i) => i).sort((a, b) => items[a].m.y - items[b].m.y || items[a].m.x - items[b].m.x);
  const placed = [];
  const results = new Array(items.length);

  for (const idx of order) {
    const it = items[idx];
    const x = it.m.x, y = it.m.y;
    let chosen = null;

    for (const dir of DIRS) {
      for (const dist of DISTS) {
        const off = 12 + GAP * dist;
        let x1;
        if (dir[0] > 0) x1 = x + off;
        else if (dir[0] < 0) x1 = x - off - it.w;
        else x1 = x - it.w / 2;
        let y1;
        if (dir[1] > 0) y1 = y + off;
        else if (dir[1] < 0) y1 = y - off - LABEL_H;
        else y1 = y - LABEL_H / 2;

        const box = { x1, y1, x2: x1 + it.w, y2: y1 + LABEL_H };
        if (box.x1 < MARGIN || box.y1 < MARGIN || box.x2 > geo.width - MARGIN || box.y2 > geo.height - MARGIN) continue;

        let hit = false;
        for (let k = 0; k < obstacles.length && !hit; k++) {
          if (k === idx) continue;
          if (rectsOverlap(box, obstacles[k])) hit = true;
        }
        for (let k = 0; k < placed.length && !hit; k++) {
          if (rectsOverlap(box, placed[k])) hit = true;
        }
        if (hit) continue;

        chosen = { box, dist };
        break;
      }
      if (chosen) break;
    }

    if (!chosen) {
      const off = 12 + GAP;
      chosen = {
        box: { x1: x + off, y1: y - LABEL_H / 2, x2: x + off + it.w, y2: y + LABEL_H / 2 },
        dist: 1,
        forced: true
      };
    }
    placed.push(chosen.box);
    results[idx] = chosen;
  }

  const forcedCount = results.filter((r) => r && r.forced).length;
  if (forcedCount) {
    console.warn('[mapRenderer] ' + forcedCount + '/' + results.length + ' 个设备标签未找到空位，已就近放置');
  }

  // 引线：标签被推离时补一条细线
  ctx.strokeStyle = 'rgba(40,40,40,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r || r.dist <= 1) continue;
    const b = r.box;
    const tx = Math.min(Math.max(markers[i].x, b.x1), b.x2);
    const ty = Math.min(Math.max(markers[i].y, b.y1), b.y2);
    ctx.beginPath();
    ctx.moveTo(markers[i].x, markers[i].y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  // 标签底与文字
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r) continue;
    const b = r.box;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x1 + 0.5, b.y1 + 0.5, b.x2 - b.x1 - 1, b.y2 - b.y1 - 1);
    ctx.fillStyle = '#1f2937';
    ctx.fillText(items[i].label, b.x1 + PAD_X, (b.y1 + b.y2) / 2);
  }

  ctx.textBaseline = 'alphabetic';
}

function drawGrid(ctx, geo) {
  // 在卫星底图上用亮色线+阴影提升对比度
  ctx.lineWidth = 1;
  ctx.font = '11px ' + CJK_FONT_FAMILY;

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
  ctx.font = 'bold 18px ' + CJK_FONT_FAMILY;
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
  ctx.fillStyle = '#222'; ctx.font = '13px ' + CJK_FONT_FAMILY;
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
  ctx.font = '12px ' + CJK_FONT_FAMILY;
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
  resolveCjkFont();
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
  ctx.font = 'bold 20px ' + CJK_FONT_FAMILY;
  ctx.fillText(`${group ? group.name + ' ' : ''}设备分布图`, 20, 33);
  ctx.fillStyle = '#666';
  ctx.font = '18px ' + CJK_FONT_FAMILY;
  ctx.fillText(message, width / 2 - ctx.measureText(message).width / 2, height / 2);
  await fsp.writeFile(outPath, c.toBuffer('image/png'));
}

module.exports = {
  isRendererAvailable,
  parseValidDevices,
  renderGroupMapPng,
};
