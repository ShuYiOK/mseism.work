# 后端系统性能优化实施文档

## 1. 数据库性能优化

### 1.1 索引优化

**现有索引分析**：
- `idx_devices_status` - devices(status)
- `idx_devices_online` - devices(online)
- `idx_devices_online_status` - devices(online, status) - **可优化**
- `idx_devices_last_heartbeat` - devices(last_heartbeat)
- `idx_devices_hash` - devices(sync_hash)
- `idx_mapping_device` - device_group_mapping(device_id)
- `idx_mapping_group` - device_group_mapping(group_id)
- `idx_mapping_group_device` - device_group_mapping(group_id, device_id)
- `idx_groups_sort` - device_groups(sort_order, name)

**优化建议**：

```sql
-- 为高频查询创建复合索引
CREATE INDEX idx_devices_status_online_last ON devices(status, online, last_heartbeat);

-- 为分组查询优化
CREATE INDEX idx_devices_name ON devices(name);

-- 为IP地址查询添加索引
CREATE INDEX idx_devices_ip ON devices(ip_address);

-- 移除冗余索引（如果存在）
-- idx_devices_online_status 可以被 idx_devices_status_online_last 包含
```

### 1.2 查询优化

**现有问题**：
- `getAllDevices` 使用 `SELECT *`，返回所有字段包括内部字段
- `getAllDevicesWithGroups` 使用多次 JOIN，可能存在 N+1 查询问题

**优化方案**：

```javascript
// 优化1：只查询必要字段
async function getAllDevicesOptimized() {
  const cachedDevices = cache.get(cache.KEYS.ALL_DEVICES);
  if (cachedDevices) {
    return cachedDevices;
  }
  
  // 只查询必要字段，避免返回 sync_hash 等内部字段
  const devices = await query(`
    SELECT id, name, ip_address, mac_address, status, online,
           cpu_usage, memory_usage, storage_usage, temperature,
           volt, delay, delay2, coodX, coodY, coodZ, last_heartbeat,
           created_at, updated_at
    FROM devices ORDER BY name
  `);
  
  const processedDevices = devices.map(d => ({
    ...d,
    online: d.online === 1
  }));
  
  cache.set(cache.KEYS.ALL_DEVICES, processedDevices, cache.CONFIG.DEVICES_TTL);
  return processedDevices;
}

// 优化2：使用单次查询获取带分组的设备
async function getAllDevicesWithGroupsOptimized() {
  const cacheKey = cache.KEYS.DEVICES_WITH_GROUPS;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // 单次查询获取所有数据，使用 JOIN 避免 N+1
  const devices = await query(`
    SELECT d.*, GROUP_CONCAT(g.id) as group_ids, GROUP_CONCAT(g.name) as group_names
    FROM devices d
    LEFT JOIN device_group_mapping m ON d.id = m.device_id
    LEFT JOIN device_groups g ON m.group_id = g.id
    GROUP BY d.id
    ORDER BY d.name
  `);
  
  // 在应用层处理分组数据
  const result = devices.map(d => {
    const groups = [];
    if (d.group_ids) {
      const ids = d.group_ids.split(',');
      const names = d.group_names.split(',');
      ids.forEach((id, i) => {
        groups.push({ id, name: names[i] });
      });
    }
    const { group_ids, group_names, online, ...device } = d;
    return {
      ...device,
      online: online === 1,
      groups
    };
  });
  
  cache.set(cacheKey, result, cache.CONFIG.DEVICES_TTL);
  return result;
}
```

### 1.3 连接池优化

**当前配置**：
```javascript
db = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 10,  // 可优化
  queueLimit: 0,
  connectTimeout: 10000
});
```

**优化建议**：
```javascript
// 根据服务器配置和负载情况调整连接池参数
const db = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 20,           // 根据负载调整
  queueLimit: 100,               // 限制队列长度
  connectTimeout: 10000,
  idleTimeout: 60000,            // 空闲连接超时
  maxIdle: 10,                   // 最大空闲连接数
  enableKeepAlive: true,        // 启用连接保活
  keepAliveInitialDelay: 10000  // 保活初始延迟
});
```

## 2. 缓存策略优化

### 2.1 缓存结构优化

```javascript
// 缓存键命名规范
const CACHE_KEYS = {
  // 设备相关 - 前缀: device
  DEVICES_LIST: 'device:list',
  DEVICES_LIST_WITH_GROUPS: 'device:list:with_groups',
  DEVICE_ITEM: (id) => `device:item:${id}`,
  DEVICE_STATS: 'device:stats',
  DEVICE_ONLINE_LIST: 'device:online:list',
  DEVICE_OFFLINE_LIST: 'device:offline:list',
  
  // 分组相关 - 前缀: group
  GROUPS_LIST: 'group:list',
  GROUP_ITEM: (id) => `group:item:${id}`,
  GROUP_WITH_DEVICES: (id) => `group:with_devices:${id}`,
  
  // 统计相关 - 前缀: stats
  STATS_OVERVIEW: 'stats:overview',
  
  // 用户相关 - 前缀: user
  USER_SESSION: (id) => `user:session:${id}`,
};

// 缓存过期时间配置
const CACHE_TTL = {
  DEVICES: 60000,           // 1分钟
  DEVICES_WITH_GROUPS: 60000,
  DEVICE_ITEM: 60000,
  DEVICE_STATS: 30000,      // 30秒
  GROUPS: 300000,           // 5分钟
  GROUP_ITEM: 300000,
  STATS: 30000,             // 30秒
  SESSION: 86400000,        // 24小时
};
```

### 2.2 多级缓存策略

```javascript
/**
 * 多级缓存管理器
 * L1: 本地内存缓存 (Map)
 * L2: Redis 分布式缓存 (可选)
 */

class MultiLevelCache {
  constructor() {
    this.l1Cache = new Map();
    this.l1Expiry = new Map();
    this.l1Ttl = 5000; // L1 缓存 5 秒
  }
  
  // 设置缓存
  async set(key, value, ttl = 60000) {
    // L1 缓存
    this.l1Cache.set(key, value);
    this.l1Expiry.set(key, Date.now() + this.l1Ttl);
    
    // L2 Redis 缓存 (如果启用)
    if (redisClient && redisEnabled) {
      await redisClient.setEx(key, ttl / 1000, JSON.stringify(value));
    }
  }
  
  // 获取缓存
  async get(key) {
    // L1 查找
    const l1Value = this.getFromL1(key);
    if (l1Value !== null) {
      return l1Value;
    }
    
    // L2 Redis 查找
    if (redisClient && redisEnabled) {
      const l2Value = await redisClient.get(key);
      if (l2Value) {
        const parsed = JSON.parse(l2Value);
        // 回填 L1
        this.setToL1(key, parsed);
        return parsed;
      }
    }
    
    return null;
  }
  
  getFromL1(key) {
    const value = this.l1Cache.get(key);
    if (!value) return null;
    
    const expiry = this.l1Expiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.l1Cache.delete(key);
      this.l1Expiry.delete(key);
      return null;
    }
    return value;
  }
  
  setToL1(key, value) {
    this.l1Cache.set(key, value);
    this.l1Expiry.set(key, Date.now() + this.l1Ttl);
  }
}
```

### 2.3 缓存失效策略

```javascript
// 缓存预热
async function warmUpCache() {
  console.log('[缓存预热] 开始预热缓存...');
  
  try {
    // 预热设备列表
    await deviceService.getAllDevices();
    
    // 预热设备统计
    await deviceService.getDeviceStats();
    
    // 预热分组列表
    await groupService.getAllGroups();
    
    console.log('[缓存预热] 缓存预热完成');
  } catch (error) {
    console.error('[缓存预热] 预热失败:', error.message);
  }
}

// 缓存更新策略：主动更新 + 被动失效
function invalidateCache(pattern) {
  // 清除匹配的缓存键
  if (pattern === 'devices') {
    cache.clearDeviceCache();
  } else if (pattern === 'groups') {
    cache.clearGroupCache();
  } else if (pattern === 'stats') {
    cache.clearStatsCache();
  } else {
    cache.clear();
  }
}

// 智能缓存刷新：在缓存即将过期时主动刷新
class CacheRefresher {
  constructor() {
    this.refreshInterval = 30000; // 30秒检查一次
    this.refreshThreshold = 0.8;  // 剩余 20% TTL 时刷新
  }
  
  start() {
    setInterval(() => this.checkAndRefresh(), this.refreshInterval);
  }
  
  async checkAndRefresh() {
    // 定期刷新热门缓存
    const stats = cache.getStats();
    if (stats.groups.devices > 0) {
      // 设备列表即将过期，触发刷新
      const devices = await db.getAllDevicesOptimized();
      cache.set(cache.KEYS.ALL_DEVICES, devices, cache.CONFIG.DEVICES_TTL);
    }
  }
}
```

## 3. API 性能优化

### 3.1 请求处理优化

```javascript
// 请求优先级中间件
const PRIORITY = {
  HIGH: 1,
  NORMAL: 2,
  LOW: 3
};

function priorityMiddleware(req, res, next) {
  // 根据路径或参数确定优先级
  const path = req.path;
  let priority = PRIORITY.NORMAL;
  
  if (path.includes('/stats') || path.includes('/health')) {
    priority = PRIORITY.HIGH;
  } else if (path.includes('/sync')) {
    priority = PRIORITY.LOW;
  }
  
  req.priority = priority;
  next();
}

// 条件查询优化：支持 fields 参数减少返回数据
router.get('/', apiRateLimit(), asyncHandler(async (req, res) => {
  const { fields, limit, offset } = req.query;
  
  // 构建字段列表
  let selectFields = '*';
  if (fields) {
    const requestedFields = fields.split(',').filter(f => 
      ['id', 'name', 'ip_address', 'status', 'online', 'cpu_usage', 'memory_usage'].includes(f)
    );
    if (requestedFields.length > 0) {
      selectFields = requestedFields.join(', ');
    }
  }
  
  // 分页优化
  const pageLimit = Math.min(parseInt(limit) || 100, 1000);
  const pageOffset = parseInt(offset) || 0;
  
  const devices = await db.getDevicesOptimized({
    fields: selectFields,
    limit: pageLimit,
    offset: pageOffset
  });
  
  res.json({ success: true, data: devices });
}));
```

### 3.2 响应优化

```javascript
// 响应压缩中间件配置
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // 压缩级别 1-9
}));

// 响应精简：移除不必要的字段
function sanitizeResponse(data, options = {}) {
  const { removeNulls = true, removeEmpty = true } = options;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeResponse(item, options));
  }
  
  if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      // 跳过内部字段
      if (key.startsWith('_') || key === 'sync_hash') {
        continue;
      }
      
      // 处理 null 和空值
      if (value === null && removeNulls) {
        continue;
      }
      if (value === '' && removeEmpty) {
        continue;
      }
      
      result[key] = typeof value === 'object' ? sanitizeResponse(value, options) : value;
    }
    return result;
  }
  
  return data;
}

// ETag 支持
app.set('etag', true);
app.use((req, res, next) => {
  // 自定义 ETag 生成
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && body.data) {
      const hash = crypto.createHash('md5').update(JSON.stringify(body.data)).digest('hex');
      res.set('ETag', `"${hash}"`);
      
      // 检查 If-None-Match
      if (req.headers['if-none-match'] === `"${hash}"`) {
        res.status(304).end();
        return;
      }
    }
    return originalJson(body);
  };
  next();
});
```

### 3.3 批处理 API

```javascript
// 批处理路由
router.post('/batch', apiRateLimit(), asyncHandler(async (req, res) => {
  const { requests } = req.body;
  
  if (!Array.isArray(requests) || requests.length > 10) {
    return res.status(400).json({ 
      success: false, 
      error: '请求数量必须在 1-10 之间' 
    });
  }
  
  const results = await Promise.all(
    requests.map(async (req) => {
      try {
        const { type, params } = req;
        
        switch (type) {
          case 'getDevices':
            return { type, success: true, data: await deviceService.getAllDevices() };
          case 'getDevice':
            return { type, success: true, data: await deviceService.getDeviceById(params.id) };
          case 'getStats':
            return { type, success: true, data: await deviceService.getDeviceStats() };
          case 'getOnlineDevices':
            return { type, success: true, data: await deviceService.getOnlineDevices(params.limit) };
          default:
            return { type, success: false, error: '未知的请求类型' };
        }
      } catch (error) {
        return { type: req.type, success: false, error: error.message };
      }
    })
  );
  
  res.json({ success: true, data: results });
}));
```

## 4. WebSocket 性能优化

### 4.1 连接管理优化

```javascript
// 心跳检测配置
const WS_CONFIG = {
  pingTimeout: 60000,      // 60秒超时
  pingInterval: 25000,      // 25秒发送一次心跳
  reconnectInterval: 5000,   // 5秒重连间隔
  maxReconnectAttempts: 10,
  heartbeatCheckInterval: 30000 // 30秒检查一次连接状态
};

// 连接超时管理
class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.heartbeatTimers = new Map();
  }
  
  addConnection(socket) {
    const socketId = socket.id;
    this.connections.set(socketId, {
      socket,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      missedPings: 0
    });
    
    // 启动心跳检测
    this.startHeartbeat(socketId);
  }
  
  startHeartbeat(socketId) {
    const timer = setInterval(() => {
      const conn = this.connections.get(socketId);
      if (!conn) {
        clearInterval(timer);
        return;
      }
      
      // 检查最后一次活动时间
      const idleTime = Date.now() - conn.lastPing;
      if (idleTime > WS_CONFIG.pingTimeout) {
        console.log(`[WS] 连接 ${socketId} 心跳超时，断开连接`);
        conn.socket.disconnect(true);
        this.removeConnection(socketId);
        clearInterval(timer);
        return;
      }
      
      // 发送心跳
      conn.socket.emit('ping', { timestamp: Date.now() });
    }, WS_CONFIG.heartbeatCheckInterval);
    
    this.heartbeatTimers.set(socketId, timer);
  }
  
  handlePong(socketId) {
    const conn = this.connections.get(socketId);
    if (conn) {
      conn.lastPing = Date.now();
      conn.missedPings = 0;
    }
  }
  
  removeConnection(socketId) {
    this.connections.delete(socketId);
    const timer = this.heartbeatTimers.get(socketId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(socketId);
    }
  }
}
```

### 4.2 消息推送优化

```javascript
// 消息合并和批量推送
class MessageBatcher {
  constructor() {
    this.pendingMessages = new Map(); // socketId -> messages[]
    this.batchInterval = 100; // 100ms 批量发送
    this.flushTimer = null;
  }
  
  addMessage(socketId, event, data) {
    if (!this.pendingMessages.has(socketId)) {
      this.pendingMessages.set(socketId, []);
    }
    
    this.pendingMessages.get(socketId).push({ event, data });
    
    // 启动批量发送定时器
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }
  
  async flush() {
    this.flushTimer = null;
    
    for (const [socketId, messages] of this.pendingMessages) {
      if (messages.length === 0) continue;
      
      const socket = this.getSocket(socketId);
      if (!socket || !socket.connected) continue;
      
      // 合并消息
      if (messages.length === 1) {
        socket.emit(messages[0].event, messages[0].data);
      } else {
        // 批量发送
        socket.emit('batch', {
          messages: messages.map(m => ({
            event: m.event,
            data: m.data
          }))
        });
      }
    }
    
    this.pendingMessages.clear();
  }
}

// 消息压缩
function compressMessage(data) {
  const str = JSON.stringify(data);
  if (str.length > 1024) {
    return {
      _compressed: true,
      data: zlib.deflateSync(str).toString('base64')
    };
  }
  return data;
}
```

## 5. 代码执行效率优化

### 5.1 算法优化

```javascript
// 优化1：设备哈希计算缓存
const deviceHashCache = new Map();

function calculateDeviceHashOptimized(device) {
  // 检查缓存
  const cacheKey = `${device.id}-${device.status}-${device.online}-${device.cpu_usage}`;
  if (deviceHashCache.has(cacheKey)) {
    return deviceHashCache.get(cacheKey);
  }
  
  const onlineValue = typeof device.online === 'boolean' ? (device.online ? 1 : 0) : device.online;
  const dataStr = JSON.stringify({
    status: device.status,
    online: onlineValue,
    cpu_usage: device.cpu_usage,
    memory_usage: device.memory_usage,
    storage_usage: device.storage_usage,
    temperature: device.temperature
  });
  
  const hash = crypto.createHash('md5').update(dataStr).digest('hex');
  
  // 缓存结果（限制缓存大小）
  if (deviceHashCache.size > 10000) {
    const firstKey = deviceHashCache.keys().next().value;
    deviceHashCache.delete(firstKey);
  }
  deviceHashCache.set(cacheKey, hash);
  
  return hash;
}

// 优化2：批量处理使用更高效的数据结构
async function processDevicesBatch(devices) {
  const deviceMap = new Map();
  
  // 使用 Map 进行 O(1) 查找
  for (const device of devices) {
    deviceMap.set(device.id, device);
  }
  
  return deviceMap;
}
```

### 5.2 代码结构优化

```javascript
// 优化1：延迟计算
class LazyValue {
  constructor(computeFn) {
    this.computeFn = computeFn;
    this.cached = undefined;
    this.computed = false;
  }
  
  get() {
    if (!this.computed) {
      this.cached = this.computeFn();
      this.computed = true;
    }
    return this.cached;
  }
  
  invalidate() {
    this.computed = false;
    this.cached = undefined;
  }
}

// 优化2：使用生成器处理大量数据
function* deviceGenerator(devices) {
  for (const device of devices) {
    yield processDevice(device);
  }
}

async function processLargeDeviceList(devices) {
  const results = [];
  for (const device of deviceGenerator(devices)) {
    results.push(await device);
  }
  return results;
}

// 优化3：对象池复用
class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.pool = [];
  }
  
  acquire() {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return this.createFn();
  }
  
  release(obj) {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
}

// 设备处理对象池
const deviceProcessorPool = new ObjectPool(
  () => ({}),
  (obj) => {
    for (const key in obj) delete obj[key];
  }
);
```

## 6. 资源使用优化

### 6.1 内存优化

```javascript
// 内存泄漏检测和优化
class MemoryManager {
  constructor() {
    this.allocationTracker = new Map();
    this.leakThreshold = 100 * 1024 * 1024; // 100MB
  }
  
  track(key, size) {
    if (!this.allocationTracker.has(key)) {
      this.allocationTracker.set(key, 0);
    }
    const current = this.allocationTracker.get(key);
    this.allocationTracker.set(key, current + size);
    
    // 检查内存使用
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > this.leakThreshold) {
      console.warn('[内存] 内存使用超过阈值，触发垃圾回收');
      global.gc && global.gc();
    }
  }
  
  untrack(key, size) {
    if (this.allocationTracker.has(key)) {
      const current = this.allocationTracker.get(key);
      this.allocationTracker.set(key, Math.max(0, current - size));
    }
  }
  
  getStats() {
    const memory = process.memoryUsage();
    return {
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss,
      tracked: Object.fromEntries(this.allocationTracker)
    };
  }
}

// 定期清理过期数据
setInterval(() => {
  const memory = process.memoryUsage();
  const heapUsedMB = memory.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > 500) {
    console.warn(`[内存] 堆内存使用过高: ${heapUsedMB.toFixed(2)}MB，开始清理...`);
    
    // 清理缓存
    cache.cleanupExpired();
    
    // 清理哈希缓存
    deviceHashCache.clear();
    
    // 触发垃圾回收
    if (global.gc) {
      global.gc();
    }
  }
}, 60000);
```

### 6.2 CPU 优化

```javascript
// CPU 密集型任务处理
const { Worker } = require('worker_threads');

// 使用 Worker 处理 CPU 密集型任务
function runCpuIntensiveTask(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const crypto = require('crypto');
      
      module.exports = function() {
        // 模拟 CPU 密集型计算
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
          result += Math.sqrt(i);
        }
        return result;
      };
    `, { eval: true });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

// 任务队列实现
class TaskQueue {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }
  
  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }
  
  async process() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      this.running++;
      
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this.process();
        });
    }
  }
}
```

### 6.3 网络优化

```javascript
// 请求合并
class RequestBatcher {
  constructor(delay = 10) {
    this.pending = new Map();
    this.timer = null;
    this.delay = delay;
  }
  
  add(key, promise) {
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    
    const p = new Promise((resolve, reject) => {
      this.pending.set(key, { promise, resolve, reject });
    });
    
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.delay);
    }
    
    return p;
  }
  
  async flush() {
    this.timer = null;
    const entries = [...this.pending.entries()];
    this.pending.clear();
    
    for (const [key, { promise, resolve, reject }] of entries) {
      try {
        const result = await promise;
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
  }
}

// HTTP 连接复用
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000,
  keepAliveTimeout: 30000
});

const apiClient = axios.create({
  httpAgent,
  timeout: 10000
});
```

## 7. 监控与调优

### 7.1 性能监控

```javascript
// 增强性能监控
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      api: new Map(),
      db: new Map(),
      cache: new Map(),
      ws: new Map()
    };
    this.alerts = [];
    this.thresholds = {
      apiResponseTime: 1000,    // 1秒
      dbQueryTime: 500,         // 500ms
      cacheHitRate: 0.8,        // 80%
      memoryUsage: 0.8,         // 80%
      cpuUsage: 0.8             // 80%
    };
  }
  
  recordApi(path, duration, status) {
    const key = `${path}_${status}`;
    const current = this.metrics.api.get(key) || { count: 0, totalTime: 0, maxTime: 0 };
    
    this.metrics.api.set(key, {
      count: current.count + 1,
      totalTime: current.totalTime + duration,
      maxTime: Math.max(current.maxTime, duration),
      avgTime: (current.totalTime + duration) / (current.count + 1)
    });
    
    // 检查阈值
    if (duration > this.thresholds.apiResponseTime) {
      this.alert('API_RESPONSE_SLOW', { path, duration });
    }
  }
  
  recordDb(query, duration) {
    const current = this.metrics.db.get(query) || { count: 0, totalTime: 0 };
    this.metrics.db.set(query, {
      count: current.count + 1,
      totalTime: current.totalTime + duration,
      avgTime: (current.totalTime + duration) / (current.count + 1)
    });
    
    if (duration > this.thresholds.dbQueryTime) {
      this.alert('DB_QUERY_SLOW', { query, duration });
    }
  }
  
  recordCache(hit) {
    const current = this.metrics.cache.get('hitRate') || { hits: 0, misses: 0 };
    if (hit) {
      current.hits++;
    } else {
      current.misses++;
    }
    this.metrics.cache.set('hitRate', current);
    
    const hitRate = current.hits / (current.hits + current.misses);
    if (hitRate < this.thresholds.cacheHitRate) {
      this.alert('CACHE_HIT_RATE_LOW', { hitRate });
    }
  }
  
  alert(type, data) {
    const alert = {
      type,
      data,
      timestamp: Date.now()
    };
    this.alerts.push(alert);
    console.warn('[性能告警]', type, data);
    
    // 保持最近的告警
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }
  
  getReport() {
    return {
      timestamp: Date.now(),
      apiMetrics: Object.fromEntries(this.metrics.api),
      dbMetrics: Object.fromEntries(this.metrics.db),
      cacheMetrics: Object.fromEntries(this.metrics.cache),
      alerts: this.alerts.slice(-10),
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }
}
```

### 7.2 性能调优

```javascript
// 自动调优建议
class PerformanceTuner {
  constructor() {
    this.history = [];
    this.baseline = null;
  }
  
  analyze() {
    const report = performanceMonitor.getReport();
    
    const suggestions = [];
    
    // 分析慢查询
    for (const [query, stats] of Object.entries(report.dbMetrics)) {
      if (stats.avgTime > 100) {
        suggestions.push({
          type: 'SLOW_QUERY',
          query,
          avgTime: stats.avgTime,
          recommendation: '考虑添加索引或优化查询'
        });
      }
    }
    
    // 分析缓存命中率
    const cacheStats = report.cacheMetrics.hitRate;
    if (cacheStats) {
      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      if (hitRate < 0.7) {
        suggestions.push({
          type: 'LOW_CACHE_HIT_RATE',
          hitRate,
          recommendation: '增加缓存容量或延长 TTL'
        });
      }
    }
    
    // 分析内存使用
    const memoryUsage = report.system.memory;
    const heapUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
    if (heapUsagePercent > 0.8) {
      suggestions.push({
        type: 'HIGH_MEMORY_USAGE',
        percent: heapUsagePercent,
        recommendation: '增加缓存清理频率或扩展内存'
      });
    }
    
    return suggestions;
  }
  
  applyTuning() {
    const suggestions = this.analyze();
    
    for (const suggestion of suggestions) {
      switch (suggestion.type) {
        case 'SLOW_QUERY':
          console.log(`[调优] 建议优化查询: ${suggestion.query}`);
          break;
        case 'LOW_CACHE_HIT_RATE':
          console.log(`[调优] 建议调整缓存策略`);
          break;
        case 'HIGH_MEMORY_USAGE':
          console.log(`[调优] 建议清理内存`);
          cache.cleanupExpired();
          break;
      }
    }
    
    return suggestions;
  }
}
```

## 8. 实施清单

### 8.1 短期优化（1-2 周）

| 优化项 | 优先级 | 预期效果 |
|-------|-------|---------|
| 数据库索引优化 | 高 | 查询性能提升 30-50% |
| 连接池参数调整 | 高 | 连接复用率提升 |
| 响应压缩启用 | 中 | 网络传输减少 50% |
| 缓存 TTL 优化 | 中 | 缓存命中率提升 |
| 慢查询监控 | 中 | 及时发现性能问题 |

### 8.2 中期优化（2-4 周）

| 优化项 | 优先级 | 预期效果 |
|-------|-------|---------|
| Redis 缓存引入 | 高 | 缓存命中率提升至 90% |
| 批处理 API | 高 | 减少客户端请求次数 |
| WebSocket 消息批量推送 | 中 | 减少网络开销 |
| 多级缓存实现 | 中 | 访问延迟降低 |
| 性能监控完善 | 中 | 全面掌握系统性能 |

### 8.3 长期优化（1-2 个月）

| 优化项 | 优先级 | 预期效果 |
|-------|-------|---------|
| 微服务拆分 | 中 | 独立扩展能力 |
| 数据库读写分离 | 中 | 写性能提升 |
| 消息队列引入 | 中 | 异步处理能力 |
| 自动扩缩容 | 中 | 资源利用率优化 |

## 9. 总结

通过实施以上全面的性能优化措施，系统将在以下方面得到显著改善：

1. **数据库性能**：查询速度提升 30-50%，连接资源高效利用
2. **缓存效率**：缓存命中率提升至 90% 以上，减少数据库压力
3. **API 响应**：响应时间缩短 40-60%，支持更高并发
4. **WebSocket**：连接稳定性提升，消息推送更高效
5. **资源利用**：内存使用优化 20-30%，CPU 利用率提升
6. **可观测性**：全面的性能监控和告警，快速定位问题

性能优化是一个持续的过程，需要根据实际运行情况和业务增长不断调整和改进。建议团队建立定期的性能审查机制，确保系统始终保持良好的性能状态。