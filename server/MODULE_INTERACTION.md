# 模块间交互逻辑与关键业务规则分析

## 1. 模块依赖关系

### 1.1 核心模块依赖图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    server.js    │────>│   services/     │────>│  database.js    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       ↑                      ↑                      │
       │                      │                      │
       │                      │                      ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   routes/       │<────│  middlewares/   │     │    cache.js     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       ↑                      ↑
       │                      │
       │                      │
┌─────────────────┐     ┌─────────────────┐
│    utils/       │────>│   config.js     │
└─────────────────┘     └─────────────────┘
```

### 1.2 模块依赖详情

| 模块 | 依赖模块 | 用途 |
|------|---------|------|
| server.js | express, socket.io, axios, services, routes, middlewares, utils | 主服务器，处理 HTTP 和 WebSocket 请求 |
| database.js | mysql2, cache, config | 数据库操作，数据持久化 |
| services/ | database, cache | 业务逻辑封装 |
| routes/ | services, middlewares | API 端点定义 |
| middlewares/ | config, jwt | 认证、安全、错误处理 |
| utils/ | - | 工具类，提供辅助功能 |
| cache.js | - | 缓存管理 |
| config.js | - | 配置管理 |

## 2. 模块间交互逻辑

### 2.1 主服务器与其他模块的交互

**server.js** 作为系统的核心，与其他模块的交互如下：

1. **与服务层的交互**：
   - 调用 `deviceService.syncDevices()` 同步设备数据
   - 调用 `deviceService.getDeviceChanges()` 获取设备变化
   - 调用 `performanceMonitor.recordApiRequest()` 记录 API 请求性能
   - 调用 `systemStart()`, `apiRequest()` 记录操作日志

2. **与路由层的交互**：
   - 注册路由：`app.use('/api/auth', authRoutes)`
   - 注册路由：`app.use('/api/config', configRoutes)`
   - 注册路由：`app.use('/api/devices', deviceRoutes)`
   - 注册路由：`app.use('/api/groups', groupRoutes)`
   - 注册路由：`app.use('/api/admin', adminRoutes)`

3. **与中间件的交互**：
   - 使用 `configureCors()` 配置 CORS
   - 使用 `securityHeaders` 设置安全头部
   - 使用 `generateCsrfToken` 和 `validateCsrfToken` 处理 CSRF
   - 使用 `validateInput` 验证输入
   - 使用 `authenticateToken` 和 `requireAdmin` 进行认证和授权
   - 使用 `apiRateLimit` 和 `syncRateLimit` 进行速率限制
   - 使用 `errorHandler` 和 `notFoundHandler` 处理错误

4. **与工具类的交互**：
   - 使用 `wsManager` 管理 WebSocket 连接
   - 使用 `requestQueue` 处理请求队列
   - 使用 `SecurityUtils` 进行安全处理
   - 使用 `pluginManager` 管理插件
   - 使用 `configManager` 管理配置

### 2.2 服务层与数据库的交互

**services/** 作为业务逻辑层，与数据库的交互如下：

1. **deviceService.js**：
   - 调用 `db.getAllDevices()` 获取所有设备
   - 调用 `db.getDeviceById()` 获取单个设备
   - 调用 `db.syncDevices()` 同步设备数据
   - 调用 `db.getDeviceChanges()` 获取设备变化
   - 调用 `db.deleteDevice()` 删除设备
   - 调用 `db.getDeviceStats()` 获取设备统计
   - 调用 `db.getOnlineDevices()` 获取在线设备
   - 调用 `db.getOfflineDevices()` 获取离线设备
   - 调用 `db.getDevicesByStatus()` 按状态获取设备
   - 调用 `db.getAllDevicesWithGroups()` 获取带分组信息的设备列表

2. **authService.js**：
   - 管理用户认证逻辑
   - 生成和验证 JWT token
   - 处理用户登录和 token 刷新

3. **groupService.js**：
   - 调用 `db.getAllGroups()` 获取所有分组
   - 调用 `db.getGroupById()` 获取单个分组
   - 调用 `db.createGroup()` 创建分组
   - 调用 `db.updateGroup()` 更新分组
   - 调用 `db.deleteGroup()` 删除分组
   - 调用 `db.addDeviceToGroup()` 添加设备到分组
   - 调用 `db.removeDeviceFromGroup()` 从分组移除设备
   - 调用 `db.getGroupDevices()` 获取分组的设备
   - 调用 `db.getDeviceGroups()` 获取设备的分组

### 2.3 路由层与服务层的交互

**routes/** 作为 API 端点定义，与服务层的交互如下：

1. **authRoutes.js**：
   - 调用 `auth.login()` 处理登录
   - 调用 `auth.refreshAccessToken()` 刷新 token
   - 调用 `auth.getUserById()` 获取用户信息

2. **deviceRoutes.js**：
   - 调用 `deviceService.getAllDevices()` 获取所有设备
   - 调用 `deviceService.getDeviceStats()` 获取设备统计
   - 调用 `deviceService.getOnlineDevices()` 获取在线设备
   - 调用 `deviceService.getOfflineDevices()` 获取离线设备
   - 调用 `deviceService.getDevicesByStatus()` 按状态获取设备
   - 调用 `deviceService.getAllDevicesWithGroups()` 获取带分组信息的设备列表
   - 调用 `deviceService.getDeviceById()` 获取单个设备
   - 调用 `deviceService.deleteDevice()` 删除设备

3. **groupRoutes.js**：
   - 调用 `groupService.getAllGroups()` 获取所有分组
   - 调用 `groupService.createGroup()` 创建分组
   - 调用 `groupService.updateGroup()` 更新分组
   - 调用 `groupService.deleteGroup()` 删除分组
   - 调用 `groupService.getGroupDevices()` 获取分组的设备
   - 调用 `groupService.addDeviceToGroup()` 添加设备到分组
   - 调用 `groupService.removeDeviceFromGroup()` 从分组移除设备

### 2.4 中间件与其他模块的交互

**middlewares/** 作为中间件，与其他模块的交互如下：

1. **authMiddleware.js**：
   - 使用 `jwt.verify()` 验证 JWT token
   - 从 `config.jwt.secret` 获取密钥

2. **csrfMiddleware.js**：
   - 生成和验证 CSRF 令牌

3. **errorMiddleware.js**：
   - 处理 404 错误
   - 处理全局错误

4. **rateLimitMiddleware.js**：
   - 实现 API 请求速率限制
   - 实现同步操作速率限制

## 3. 关键业务规则实现

### 3.1 设备在线状态判定

**实现位置**：`server.js:346-366`

**逻辑**：
1. 优先使用外部 API 返回的 `online` 字段
2. 当 `online` 字段不存在时，使用 `state` 字段作为备用
3. 超过离线阈值无更新则标记为离线（默认 300 秒）

**代码示例**：
```javascript
// 解析设备在线状态，严格优先使用 API 返回的 online 字段
let isOnline = false;
try {
  // 严格优先使用 API 返回的 online 字段
  console.log(`设备 ${d.device} 的 online 字段值:`, d.online, '类型:', typeof d.online);
  if (d.online === true) {
    isOnline = true;
  } else if (d.online === undefined || d.online === null) {
    // 只有当 online 字段不存在时，才使用 state 字段作为备用
    console.log(`设备 ${d.device} 的 online 字段不存在，使用 state 字段:`, d.state);
    if (d.state === '1' || d.state === 1 || d.state === true || d.state === '\u0001') {
      isOnline = true;
    }
  } else {
    // online 字段存在但不是 true，保持离线
    console.log(`设备 ${d.device} 的 online 字段为:`, d.online, '，设置为离线');
    isOnline = false;
  }
} catch (e) {
  console.warn('解析设备状态失败:', e.message, d.state, d.online);
}
```

### 3.2 设备数据同步

**实现位置**：`server.js:296-470` 和 `database.js:448-599`

**逻辑**：
1. 使用批量操作提高性能
2. 使用事务确保数据一致性
3. 使用哈希值检测数据变化，实现增量更新
4. 同步过程中使用请求队列避免并发冲突

**代码示例**：
```javascript
// 使用请求队列处理同步任务
await requestQueue.add(async () => {
  syncState.isSyncing = true;
  const startTime = Date.now();
  let success = false;

  try {
    // 获取外部 API 数据
    const response = await apiClient.get(CONFIG.DEVICE_API_URL);
    
    // 解析数据
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

    // 标准化设备数据
    const normalizedDevices = remoteDevices.map(d => {
      // 处理设备数据...
    });

    // 获取变化
    const changes = await deviceService.getDeviceChanges(validDevices);

    // 同步到数据库
    await deviceService.syncDevices(validDevices);

    // 推送变化
    if (changes.added.length > 0) {
      wsManager.broadcastMessage('devices:added', changes.added);
    }
    if (changes.updated.length > 0) {
      wsManager.broadcastMessage('devices:updated', changes.updated);
    }
    if (changes.removed.length > 0) {
      changes.removed.forEach(id => {
        wsManager.broadcastMessage('device:delete', { id });
      });
    }
  } catch (error) {
    // 错误处理...
  }
});
```

### 3.3 安全规则

**实现位置**：`server.js:62-106` 和 `middlewares/`

**逻辑**：
1. 输入验证和清理，防止 XSS 攻击
2. CORS 配置，限制跨域请求
3. CSRF 令牌验证（生产环境）
4. 安全头部设置，防止各种攻击
5. 速率限制，防止暴力攻击

**代码示例**：
```javascript
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

// 输入验证中间件
function validateInput(req, res, next) {
  // 只在有body的情况下进行验证
  if (req.body && typeof req.body === 'object') {
    // 递归验证和清理输入
    function sanitizeObject(obj) {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          if (!SecurityUtils.isInputSafe(obj[key])) {
            return false;
          }
          obj[key] = SecurityUtils.sanitizeInput(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          if (!sanitizeObject(obj[key])) {
            return false;
          }
        }
      }
      return true;
    }

    if (!sanitizeObject(req.body)) {
      return res.status(400).json({ success: false, error: '输入包含不安全的内容' });
    }
  }
  next();
}
```

### 3.4 缓存策略

**实现位置**：`database.js` 和 `cache.js`

**逻辑**：
1. 设备数据缓存（TTL：30 秒）
2. 分组数据缓存（TTL：60 秒）
3. 统计数据缓存（TTL：60 秒）
4. 设备分组映射缓存（TTL：60 秒）

**代码示例**：
```javascript
// 获取所有设备
async function getAllDevices() {
  // 尝试从缓存获取
  const cachedDevices = cache.get(cache.KEYS.ALL_DEVICES);
  if (cachedDevices) {
    return cachedDevices;
  }
  
  // MySQL 查询
  const devices = await query('SELECT * FROM devices ORDER BY id');
  
  // 处理数据
  const processedDevices = devices.map(d => {
    const { sync_hash, online, ...device } = d;
    return {
      ...device,
      online: online === 1
    };
  });
  
  // 存入缓存
  cache.set(cache.KEYS.ALL_DEVICES, processedDevices, cache.CONFIG.DEVICES_TTL);
  
  return processedDevices;
}
```

### 3.5 WebSocket 推送策略

**实现位置**：`server.js:474-513` 和 `utils/websocketManager.js`

**逻辑**：
1. 只推送变化的数据，减少网络传输
2. 支持分组推送，提高推送效率
3. 心跳检测，确保连接状态

**代码示例**：
```javascript
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
```

## 4. 模块间交互流程图

### 4.1 API 请求处理流程

```
Client → Express Server → Middlewares → Routes → Services → Database → Cache → Response
```

### 4.2 设备数据同步流程

```
External API → Server → Data Processing → Database → Cache → WebSocket → Client
```

### 4.3 认证流程

```
Client → Express Server → Auth Middleware → Auth Service → JWT Verification → Protected Route
```

## 5. 关键业务规则总结

| 业务规则 | 实现位置 | 核心逻辑 |
|---------|---------|---------|
| 设备在线状态判定 | server.js:346-366 | 优先使用 online 字段，其次使用 state 字段，超过阈值标记为离线 |
| 设备数据同步 | server.js:296-470, database.js:448-599 | 批量操作、事务处理、哈希检测变化、请求队列 |
| 安全规则 | server.js:62-106, middlewares/ | 输入验证、CORS、CSRF、安全头部、速率限制 |
| 缓存策略 | database.js, cache.js | 多级缓存、不同 TTL、缓存失效策略 |
| WebSocket 推送 | server.js:474-513, utils/websocketManager.js | 增量推送、分组推送、心跳检测 |
| 数据库健康检查 | database.js:112-139 | 定期检查连接池状态，自动重连 |
| 错误处理 | middlewares/errorMiddleware.js | 全局错误处理，404 处理 |
| 性能监控 | server.js:195-218, performance.js | API 请求性能、同步性能、WebSocket 性能 |
| 操作日志 | operationLog.js | 系统启动、API 请求、查询日志 |

## 6. 总结

后端系统采用了模块化、分层的架构设计，模块间通过清晰的依赖关系和交互逻辑进行协作。核心业务规则的实现体现了系统的可靠性、安全性和性能优化。

系统的模块间交互特点：
1. **清晰的分层结构**：从路由层到服务层再到数据层，职责明确
2. **高效的数据流转**：通过缓存、批量操作、增量推送等方式提高效率
3. **安全的交互方式**：通过输入验证、认证授权、安全头部等保障安全
4. **可靠的错误处理**：通过全局错误处理、数据库健康检查等提高可靠性
5. **可监控的运行状态**：通过性能监控、操作日志等实现可观测性

这些设计使得系统能够高效地处理设备数据的同步、存储和实时推送，为客户端提供稳定、安全、实时的服务。