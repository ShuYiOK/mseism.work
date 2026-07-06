# 后端系统业务流程与数据流转路径文档

## 1. 系统架构概览

后端系统基于 Node.js + Express + Socket.io 构建，主要组件包括：

- **主服务器**：处理 HTTP 请求和 WebSocket 连接
- **数据库**：MySQL 用于数据持久化
- **服务层**：封装业务逻辑
- **路由层**：定义 API 端点
- **中间件**：处理认证、安全、错误和速率限制
- **工具类**：提供各种辅助功能

## 2. 核心业务流程

### 2.1 设备数据同步流程

**触发方式**：定时任务（默认间隔）或手动触发

**数据流转路径**：

1. **外部 API → 服务器**
   - 从外部设备数据源 API 获取设备数据
   - 支持多种数据格式解析（{code, msg, data} 或 {devices} 或直接数组）

2. **服务器 → 数据处理**
   - 标准化设备数据格式
   - 解析在线状态、存储使用率等字段
   - 计算设备数据哈希值（用于增量更新）

3. **数据处理 → 数据库**
   - 批量同步设备数据到 MySQL
   - 使用事务确保数据一致性
   - 支持批量插入/更新操作

4. **数据库 → 缓存**
   - 清除相关缓存
   - 重新加载缓存数据

5. **服务器 → 客户端**
   - 通过 WebSocket 推送增量变化数据
   - 支持新增、更新、删除设备的实时通知

**关键代码**：
- `server.js:296-470` - `syncDevicesFromApi()` 函数
- `database.js:448-599` - `syncDevices()` 函数
- `database.js:602-644` - `getDeviceChanges()` 函数

### 2.2 API 请求处理流程

**处理步骤**：

1. **请求接收**
   - Express 服务器接收 HTTP 请求

2. **中间件处理**
   - CORS 配置
   - 安全头部设置
   - CSRF 令牌生成和验证
   - 输入验证和清理
   - 访问日志和性能监控

3. **路由匹配**
   - 根据请求路径匹配相应的路由处理器

4. **业务逻辑处理**
   - 调用相应的服务层函数
   - 执行数据库操作
   - 处理业务规则

5. **响应返回**
   - 格式化响应数据
   - 返回 JSON 格式的响应
   - 记录操作日志

**数据流转路径**：
- `client → server.js:138-148` (中间件) → `routes/*` (路由) → `services/*` (业务逻辑) → `database.js` (数据操作) → `client`

### 2.3 认证流程

**登录流程**：

1. **客户端 → 服务器**
   - 发送登录请求（用户名、密码）

2. **服务器处理**
   - 验证用户名和密码
   - 生成 JWT access token 和 refresh token
   - 记录登录日志

3. **服务器 → 客户端**
   - 返回用户信息和令牌

**认证保护流程**：

1. **客户端 → 服务器**
   - 发送带 JWT token 的请求

2. **服务器处理**
   - 验证 JWT token
   - 提取用户信息
   - 验证权限（如需要）

3. **业务逻辑处理**
   - 执行受保护的操作

**关键代码**：
- `auth.js` - 认证相关逻辑
- `middlewares/authMiddleware.js` - 认证中间件
- `routes/authRoutes.js` - 认证路由

### 2.4 WebSocket 连接处理流程

**连接建立**：

1. **客户端 → 服务器**
   - 建立 WebSocket 连接

2. **服务器处理**
   - 记录连接信息
   - 添加到 WebSocket 管理器
   - 处理消息队列

**消息处理**：

1. **客户端 → 服务器**
   - 发送消息（如加入分组、心跳）

2. **服务器处理**
   - 处理客户端消息
   - 执行相应操作

**数据推送**：

1. **服务器 → 客户端**
   - 推送设备变化数据
   - 推送同步状态
   - 推送错误信息

**关键代码**：
- `server.js:474-513` - WebSocket 连接处理
- `utils/websocketManager.js` - WebSocket 管理

## 3. 数据模型

### 3.1 设备模型

| 字段名 | 类型 | 描述 |
|-------|------|------|
| id | VARCHAR(36) | 设备唯一标识 |
| name | VARCHAR(255) | 设备名称 |
| ip_address | VARCHAR(255) | IP 地址 |
| mac_address | VARCHAR(255) | MAC 地址 |
| status | VARCHAR(20) | 设备状态 |
| online | TINYINT(1) | 在线状态 |
| cpu_usage | DOUBLE | CPU 使用率 |
| memory_usage | DOUBLE | 内存使用率 |
| storage_usage | DOUBLE | 存储使用率 |
| temperature | DOUBLE | 温度 |
| volt | DOUBLE | 电压 |
| delay | DOUBLE | 延迟 |
| delay2 | DOUBLE | 延迟2 |
| coodX | DOUBLE | X 坐标 |
| coodY | DOUBLE | Y 坐标 |
| coodZ | DOUBLE | Z 坐标 |
| last_heartbeat | INT | 最后心跳时间 |
| sync_hash | VARCHAR(32) | 数据哈希值 |
| created_at | INT | 创建时间 |
| updated_at | INT | 更新时间 |

### 3.2 分组模型

| 字段名 | 类型 | 描述 |
|-------|------|------|
| id | VARCHAR(36) | 分组唯一标识 |
| name | VARCHAR(255) | 分组名称 |
| description | TEXT | 分组描述 |
| color | VARCHAR(20) | 分组颜色 |
| sort_order | INT | 排序顺序 |
| created_at | INT | 创建时间 |
| updated_at | INT | 更新时间 |

### 3.3 设备分组映射模型

| 字段名 | 类型 | 描述 |
|-------|------|------|
| id | VARCHAR(36) | 映射唯一标识 |
| device_id | VARCHAR(36) | 设备 ID |
| group_id | VARCHAR(36) | 分组 ID |
| created_at | INT | 创建时间 |

## 4. 关键业务规则

### 4.1 设备在线状态判定

- 优先使用外部 API 返回的 `online` 字段
- 当 `online` 字段不存在时，使用 `state` 字段作为备用
- 超过离线阈值无更新则标记为离线（默认 300 秒）

### 4.2 设备数据同步

- 使用批量操作提高性能
- 使用事务确保数据一致性
- 使用哈希值检测数据变化，实现增量更新
- 同步过程中使用请求队列避免并发冲突

### 4.3 安全规则

- 输入验证和清理，防止 XSS 攻击
- CORS 配置，限制跨域请求
- CSRF 令牌验证（生产环境）
- 安全头部设置，防止各种攻击
- 速率限制，防止暴力攻击

### 4.4 缓存策略

- 设备数据缓存（TTL：30 秒）
- 分组数据缓存（TTL：60 秒）
- 统计数据缓存（TTL：60 秒）
- 设备分组映射缓存（TTL：60 秒）

## 5. API 端点

### 5.1 认证 API

- `POST /api/auth/login` - 用户登录
- `POST /api/auth/refresh` - 刷新 token
- `GET /api/auth/me` - 获取当前用户信息

### 5.2 设备 API

- `GET /api/devices` - 获取所有设备
- `GET /api/devices/stats` - 获取设备统计
- `GET /api/devices/online` - 获取在线设备
- `GET /api/devices/offline` - 获取离线设备
- `GET /api/devices/status/:status` - 按状态获取设备
- `GET /api/devices/with-groups` - 获取带分组信息的设备列表
- `GET /api/devices/:id` - 获取单个设备
- `DELETE /api/devices/:id` - 删除设备

### 5.3 分组 API

- `GET /api/groups` - 获取所有分组
- `POST /api/groups` - 创建分组
- `PUT /api/groups/:id` - 更新分组
- `DELETE /api/groups/:id` - 删除分组
- `GET /api/groups/:id/devices` - 获取分组的设备
- `POST /api/groups/:id/devices` - 添加设备到分组
- `DELETE /api/groups/:id/devices/:deviceId` - 从分组移除设备

### 5.4 同步 API

- `GET /api/sync/status` - 获取同步状态
- `POST /api/sync/trigger` - 手动触发同步

### 5.5 健康检查 API

- `GET /api/health` - 健康检查

### 5.6 性能监控 API

- `GET /api/performance/stats` - 获取性能统计
- `POST /api/performance/reset` - 重置性能监控

### 5.7 日志 API

- `GET /api/logs/operations` - 获取操作日志
- `GET /api/logs/stats` - 获取日志统计

### 5.8 WebSocket 统计 API

- `GET /api/ws/stats` - 获取 WebSocket 连接统计

### 5.9 请求队列统计 API

- `GET /api/queue/stats` - 获取请求队列状态

## 6. 数据流图

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  外部设备 API   │────>│    主服务器     │────>│    数据库      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              ↑                       │
                              │                       │
                              │                       ↓
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    客户端       │<────│  WebSocket 推送 │<────│     缓存       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 7. 总结

后端系统采用了模块化、分层的架构设计，主要处理设备数据的同步、存储和实时推送。系统通过定时任务从外部 API 获取设备数据，经过处理后存储到数据库，并通过 WebSocket 实时推送给客户端。同时，系统提供了完整的 RESTful API 用于设备和分组的管理，以及认证、监控等功能。

系统的核心优势在于：
1. 实时性：通过 WebSocket 实现设备状态的实时更新
2. 性能优化：批量操作、缓存策略、请求队列等
3. 安全性：输入验证、CORS、CSRF、安全头部等
4. 可靠性：数据库健康检查、自动重连、事务处理等
5. 可扩展性：模块化设计、插件系统等

通过以上设计，系统能够高效地处理大量设备数据，并为客户端提供实时、可靠的服务。