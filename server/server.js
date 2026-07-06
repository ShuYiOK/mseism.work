/**
 * 主服务器 - Express + Socket.io
 * 提供 REST API 和 WebSocket 实时推送
 * 对接外部设备数据源：http://124.238.104.120:81/devices/list
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const config = require('./config');
const db = require('./database');
const auth = require('./auth');
const performanceMonitor = require('./performance');
const { systemStart, apiRequest, queryLogs, getLogStats } = require('./operationLog');

// 导入工具
const wsManager = require('./utils/websocketManager');
const requestQueue = require('./utils/requestQueue');
const SecurityUtils = require('./utils/security');
const pluginManager = require('./utils/pluginManager');
const configManager = require('./utils/configManager');

// 导入中间件
const { generateCsrfToken, validateCsrfToken } = require('./middlewares/csrfMiddleware');

// 导入路由
const adminRoutes = require('./routes/adminRoutes');

// 导入服务
const deviceService = require('./services/deviceService');
const groupService = require('./services/groupService');

// 导入中间件
const { errorHandler, notFoundHandler } = require('./middlewares/errorMiddleware');
const { apiRateLimit, syncRateLimit } = require('./middlewares/rateLimitMiddleware');
const { authenticateToken, requireAdmin } = require('./middlewares/authMiddleware');
const { sanitizeMiddleware, validateAndSanitize } = require('./middlewares/sanitize');

// 导入路由
const authRoutes = require('./routes/authRoutes');
const configRoutes = require('./routes/configRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const groupRoutes = require('./routes/groupRoutes');

const { asyncHandler } = require('./middlewares/errorHandler');

// 访问日志中间件
function accessLogger(req, res, next) {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
}

// 安全头部中间件
function securityHeaders(req, res, next) {
  // 防止 MIME 类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');
  // 防止 XSS 攻击
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 严格传输安全
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // 内容安全策略
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  // 引用策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 功能策略
  res.setHeader('Feature-Policy', "camera 'none'; microphone 'none'; geolocation 'none'");
  next();
}

// CORS 配置中间件
function configureCors() {
  return cors({
    origin: config.cors.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  });
}

const app = express();
const server = http.createServer(app);

// XSS 防护中间件 - 使用专业的 xss 库
app.use(sanitizeMiddleware());

// Socket.io 配置 - 支持跨域和高性能
const io = new Server(server, {
  cors: {
    origin: config.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: config.WS_PING_TIMEOUT,
  pingInterval: config.WS_PING_INTERVAL,
  transports: ['websocket', 'polling'],
  perMessageDeflate: {
    threshold: 1024 // 小于 1KB 不压缩
  }
});

wsManager.io = io;
console.log('[WS Manager] Socket.io 实例已设置');
// 中间件
app.use(express.json());
app.use(configureCors());
app.use(securityHeaders);
app.use(generateCsrfToken);

// CSRF 验证（生产环境启用）
if (process.env.NODE_ENV === 'production') {
  app.use(validateCsrfToken);
}

// 静态文件服务 - 提供前端构建后的文件
app.use(express.static(path.join(__dirname, '../client/dist'), {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // 对于生产环境，设置更强的缓存
    if (process.env.NODE_ENV === 'production') {
      // 对于静态资源文件（JS、CSS、图片等）
      if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.svg') || path.endsWith('.webp') || path.endsWith('.avif')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // 对于HTML文件，设置较短的缓存
      else if (path.endsWith('.html')) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }
}));

// 前端路由处理 - 对于所有非API请求，返回index.html
app.use((req, res, next) => {
  // 跳过API请求和静态文件请求
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    next();
  } else {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  }
});

// ============== 特殊路径处理（在日志中间件之前） ==============

// 根路径处理
app.get('/', (req, res) => {
  res.json({
    name: 'MseisM 设备监控系统',
    version: '1.0.0',
    status: 'running',
    apis: {
      devices: '/api/devices',
      groups: '/api/groups',
      health: '/api/health',
      sync: '/api/sync/status'
    },
    frontend: 'http://localhost:5173',
    websocket: `ws://localhost:${config.PORT}`
  });
});

// favicon 处理 - 返回204避免日志
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// 访问日志和性能监控中间件
app.use((req, res, next) => {
  const startTime = Date.now()
  
  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const success = res.statusCode < 400
    
    // 性能监控
    performanceMonitor.recordApiRequest(
      req.path + (req.route?.path || ''),
      duration,
      success
    )
    
    // 访问日志
    accessLogger(req, res, () => {})
    
    // 操作日志
    apiRequest(req.method, req.originalUrl, res.statusCode, duration)
  })
  
  next()
})

// ============== 配置 ==============
const CONFIG = {
  // 外部设备数据源 API
  DEVICE_API_URL: config.deviceApi.url || config.DEVICE_API_URL,
  // 数据同步间隔（毫秒）
  SYNC_INTERVAL: config.sync.interval || config.SYNC_INTERVAL,
  // 设备离线判定时间（秒）
  OFFLINE_THRESHOLD: config.sync.offlineThreshold || config.OFFLINE_THRESHOLD,
  // API 请求超时
  API_TIMEOUT: config.deviceApi.timeout || config.API_TIMEOUT,
};

// 创建 axios 实例
const apiClient = axios.create({
  timeout: CONFIG.API_TIMEOUT,
  headers: {
    'User-Agent': 'MseisM-Server/1.0'
  }
});

// 同步状态
let syncState = {
  lastSyncTime: 0,
  lastSyncCount: 0,
  syncErrors: 0,
  isSyncing: false
};
 
// ============== REST API 路由 ==============

// ============== 认证相关 API ==============
app.use('/api/auth', authRoutes);

// ============== 配置管理 API ==============
app.use('/api/config', configRoutes);

// ============== 设备相关 API ==============
app.use('/api/devices', deviceRoutes);

// ============== 分组相关 API ==============
app.use('/api/groups', groupRoutes);

// ============== 设备异常监控 API ==============
const anomalyRoutes = require('./routes/anomalyRoutes');
app.use('/api/anomalies', anomalyRoutes);

// ============== 管理相关 API ==============
app.use('/api/admin', adminRoutes);

// ============== 健康检查 ==============
// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    sync: syncState 
  });
});

// 获取同步状态
app.get('/api/sync/status', (req, res) => {
  res.json({
    success: true,
    data: {
      ...syncState,
      lastSyncTimeStr: syncState.lastSyncTime ? new Date(syncState.lastSyncTime).toLocaleString('zh-CN') : '从未同步'
    }
  });
});

// 手动触发同步（应用频率限制，需要认证）
app.post('/api/sync/trigger', 
  authenticateToken,
  asyncHandler(async (req, res) => {
    await syncDevicesFromApi();
    res.json({ success: true, message: '同步完成' });
}));

// ============== 设备数据同步 ==============

// 从外部 API 同步设备数据
async function syncDevicesFromApi() {
  if (syncState.isSyncing) {
    console.log('同步正在进行中，跳过...');
    return;
  }

  // 使用请求队列处理同步任务
  await requestQueue.add(async () => {
    syncState.isSyncing = true;
    const startTime = Date.now();
    let success = false;

    try {
      console.log(`开始从 ${CONFIG.DEVICE_API_URL} 同步设备数据...`);

      const response = await apiClient.get(CONFIG.DEVICE_API_URL);
      
      // 解析 API 返回的数据格式：{code: 200, msg: '...', data: [...]}
      const apiData = response.data;
      let remoteDevices = [];
      
      if (apiData && Array.isArray(apiData.data)) {
        remoteDevices = apiData.data;
      } else if (apiData && Array.isArray(apiData.devices)) {
        remoteDevices = apiData.devices;
      } else if (Array.isArray(apiData)) {
        remoteDevices = apiData;
      } else {
        throw new Error('API 返回的数据格式不正确，期望数组');
      }

      console.log(`获取到 ${remoteDevices.length} 个设备数据`);

      // 转换设备数据格式，适配外部 API
      const normalizedDevices = remoteDevices.map(d => {
        // 解析 storage 字段，确保是有效数字（0-100 之间）
        let storageVal = 0;
        try {
          if (d.storage !== undefined && d.storage !== null) {
            // 尝试转换为数字
            const parsed = parseInt(d.storage);
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
              storageVal = parsed;
            }
          }
        } catch (e) {
          console.warn('解析 storage 字段失败:', e.message, d.storage);
        }

        // 解析设备在线状态，严格优先使用 API 返回的 online 字段
        let isOnline = false;
        try {
          if (d.online === true) {
            isOnline = true;
          } else if (d.online === undefined || d.online === null) {
            if (d.state === '1' || d.state === 1 || d.state === true || d.state === '\u0001') {
              isOnline = true;
            }
          } else {
            isOnline = false;
          }
        } catch (e) {
          console.warn('[设备同步] 解析设备状态失败:', e.message, d.state, d.online);
        }

        return {
          // 使用 device 字段作为唯一 ID（因为 id 字段全是 "0"）
          id: d.device || d.id || `device_${d.addr || Date.now()}`,
          name: `设备-${d.device || d.id}`,
          ip_address: d.addr || d.ip_address || d.ip || '',
          mac_address: d.mac || d.mac_address || '',
          status: isOnline ? 'online' : 'offline',
          online: isOnline,
          cpu_usage: parseFloat(d.cpu) || 0,
          memory_usage: parseFloat(d.memory) || 0,
          storage_usage: storageVal,
          temperature: parseFloat(d.temp) || 0,
          volt: parseFloat(d.volt) || 0,
          delay: parseFloat(d.delay) || 0,
          delay2: parseFloat(d.delay2) || 0,
          coodX: parseFloat(d.coodX) || 0,
          coodY: parseFloat(d.coodY) || 0,
          coodZ: parseFloat(d.coodZ) || 0,
          last_heartbeat: Math.floor(Date.now() / 1000),
          // 原始数据保留（不计入哈希）
          raw: {
            volt: d.volt,
            state: d.state,
            coodX: d.coodX,
            coodY: d.coodY,
            coodZ: d.coodZ,
            upTime: d.upTime,
            delay: d.delay,
            delay2: d.delay2
          }
        };
      });

      // 过滤掉无效设备（确保有唯一ID）
      const validDevices = normalizedDevices.filter(device => device.id);
      console.log(`有效设备数量：${validDevices.length}`);

      // 获取变化
      const changes = await deviceService.getDeviceChanges(validDevices);

      // 同步到数据库
      await deviceService.syncDevices(validDevices);

      // 更新同步状态
      syncState.lastSyncTime = Date.now();
      syncState.lastSyncCount = validDevices.length;
      syncState.syncErrors = 0;
      syncState.isSyncing = false;

      // 高性能推送：只推送变化的数据
      if (changes.added.length > 0) {
        wsManager.broadcastMessage('devices:added', changes.added);
        console.log(`新增设备：${changes.added.length}`);
      }

      if (changes.updated.length > 0) {
        // 批量推送更新
        wsManager.broadcastMessage('devices:updated', changes.updated);
        console.log(`更新设备：${changes.updated.length}`);
      }

      if (changes.removed.length > 0) {
        changes.removed.forEach(id => {
          wsManager.broadcastMessage('device:delete', { id });
        });
        console.log(`移除设备：${changes.removed.length}`);
      }

      // 如果没有变化，发送心跳
      if (changes.added.length === 0 && changes.updated.length === 0 && changes.removed.length === 0) {
        wsManager.broadcastMessage('sync:heartbeat', {
          timestamp: Date.now(),
          count: validDevices.length
        });
      }

      const duration = Date.now() - startTime;
      console.log(`同步完成，耗时：${duration}ms`);
      
      // 记录同步性能
      performanceMonitor.recordSync(duration, true, validDevices.length);
      success = true;

    } catch (error) {
      syncState.syncErrors++;
      syncState.isSyncing = false;
      console.error('同步设备数据失败:', error.message);
      console.error('错误详情:', error.stack);
      
      // 记录同步失败
      const duration = Date.now() - startTime;
      performanceMonitor.recordSync(duration, false, 0);

      // 推送错误事件
      wsManager.broadcastMessage('sync:error', {
        message: error.message,
        timestamp: Date.now(),
        errorCount: syncState.syncErrors
      });
    }
  });
}

// ============== WebSocket 连接处理 ==============

io.on('connection', (socket) => {
  console.log(`客户端连接：${socket.id}`);
  
  // 添加到WebSocket管理器
  wsManager.addConnection(socket);
  
  // 记录WebSocket连接
  performanceMonitor.recordWebSocketConnection('connect');
  
  // 处理消息队列
  wsManager.processMessageQueue(socket.id);
  
  // 客户端加入特定分组房间
  socket.on('join:group', (groupId) => {
    socket.join(`group:${groupId}`);
    console.log(`客户端 ${socket.id} 加入分组房间：${groupId}`);
  });
  
  // 客户端离开分组房间
  socket.on('leave:group', (groupId) => {
    socket.leave(`group:${groupId}`);
    console.log(`客户端 ${socket.id} 离开分组房间：${groupId}`);
  });
  
  // 心跳检测
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
    performanceMonitor.recordWebSocketMessage(true);
  });

  // 获取当前同步状态
  socket.on('get:sync:status', () => {
    socket.emit('sync:status', syncState);
  });
  
  socket.on('disconnect', () => {
    console.log(`客户端断开：${socket.id}`);
    performanceMonitor.recordWebSocketConnection('disconnect');
  });
});

// ============== 定时任务 ==============

// 定时任务引用
let syncTimer;
let statusCheckTimer;

// 启动定时任务
function startScheduledTasks() {
  // 启动时立即同步一次
  setTimeout(() => {
    syncDevicesFromApi().catch(err => {
      console.error('[启动同步] 首次同步失败:', err.message);
    });
  }, 1000);

  // 定时同步设备数据
  syncTimer = setInterval(() => {
    syncDevicesFromApi();
  }, CONFIG.SYNC_INTERVAL);

  // 每分钟检查设备在线状态（超过阈值无更新则标记为离线）
  statusCheckTimer = setInterval(async () => {
    // 使用请求队列处理状态检查
    await requestQueue.add(async () => {
      const now = Math.floor(Date.now() / 1000);
      try {
        const devices = await deviceService.getAllDevices();
        let hasChanges = false;
        
        for (const device of devices) {
          if (device.online && (now - device.last_heartbeat) > CONFIG.OFFLINE_THRESHOLD) {
            await deviceService.syncDevices([{ ...device, online: false, status: 'offline' }]);
            wsManager.broadcastMessage('device:update', { ...device, online: false, status: 'offline' });
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          console.log('设备在线状态检查完成');
        }
      } catch (error) {
        console.error('检查设备在线状态失败:', error.message);
      }
    });
  }, 60000);
}

// 停止定时任务
function stopScheduledTasks() {
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  if (statusCheckTimer) {
    clearInterval(statusCheckTimer);
  }
  // 停止请求队列处理
  requestQueue.stopProcessing();
  // 清空请求队列
  requestQueue.clear();
}

// ============== 性能监控 API ==============

// 获取性能统计
app.get('/api/performance/stats', 
  authenticateToken,
  asyncHandler(async (req, res) => {
  const stats = performanceMonitor.getStats();
  res.json({ success: true, data: stats });
}));

// 重置性能监控
app.post('/api/performance/reset', 
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
  performanceMonitor.reset();
  res.json({ success: true, message: '性能监控已重置' });
}));

// ============== 日志查询 API ==============

// 获取操作日志
app.get('/api/logs/operations', asyncHandler(async (req, res) => {
  const options = {
    type: req.query.type,
    level: req.query.level,
    userId: req.query.userId,
    limit: parseInt(req.query.limit) || 100,
    offset: parseInt(req.query.offset) || 0
  };
  
  if (req.query.startTime) {
    options.startTime = new Date(req.query.startTime);
  }
  
  if (req.query.endTime) {
    options.endTime = new Date(req.query.endTime);
  }
  
  const result = queryLogs(options);
  res.json({ success: true, data: result });
}));

// 获取日志统计
app.get('/api/logs/stats', asyncHandler(async (req, res) => {
  const stats = getLogStats();
  res.json({ success: true, data: stats });
}));

// ============== WebSocket 统计 API ==============

// 获取WebSocket连接统计
app.get('/api/ws/stats', asyncHandler(async (req, res) => {
  const stats = wsManager.getStats();
  res.json({ success: true, data: stats });
}));

// ============== 请求队列统计 API ==============

// 获取请求队列状态
app.get('/api/queue/stats', asyncHandler(async (req, res) => {
  const stats = requestQueue.getStatus();
  res.json({ success: true, data: stats });
}));

// 记录系统启动
systemStart();

// ============== 404 和错误处理 ==============

// 404 处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// ============== 优雅关闭 ==============

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭...');
  stopScheduledTasks();
  require('./services/anomalyService').stopAnomalyDetection();
  server.close(async () => {
    await db.close();
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信号，正在关闭...');
  stopScheduledTasks();
  require('./services/anomalyService').stopAnomalyDetection();
  server.close(async () => {
    await db.close();
    console.log('服务器已关闭');
    process.exit(0);
  });
});

// ============== 启动服务器 ==============

const PORT = config.PORT;

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 初始化配置
    configManager.loadConfig();
    
    // 初始化插件
    const pluginsDir = configManager.get('plugins.directory', './plugins');
    await pluginManager.loadPluginsFromDir(pluginsDir);
    
    // 初始化数据库
    await db.initDatabase();
    
    // 初始化用户数据库
    await auth.initUserDatabase();
    
    // 启动定时任务
    startScheduledTasks();
    
    // 启动设备异常检测服务
    const anomalyService = require('./services/anomalyService');
    anomalyService.startAnomalyDetection();
    
    // 启动服务器
    server.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`服务器启动在端口 ${PORT}`);
      console.log(`API 地址：http://localhost:${PORT}/api`);
      console.log(`WebSocket 地址：ws://localhost:${PORT}`);
      console.log(`设备数据源：${CONFIG.DEVICE_API_URL}`);
      console.log(`同步间隔：${CONFIG.SYNC_INTERVAL}ms`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('启动服务器失败:', error.message);
    process.exit(1);
  }
}

// 导出模块
module.exports = { app, io, server, startServer, stopScheduledTasks };

// 只有在直接运行时才启动服务器
if (require.main === module) {
  startServer();
}
