# MseisM 设备监控系统

## 应用说明

MseisM 是一个基于 Vue 3 + Node.js + MySQL 的设备监控系统，支持实时设备状态监控、设备分组管理、WebSocket 实时推送等功能。

## 技术栈

- **前端**: Vue 3 + Vite + Pinia
- **后端**: Node.js + Express + Socket.io
- **数据库**: MySQL 8.0
- **部署**: Docker + Docker Compose

## 功能特性

- ✅ 设备实时监控
- ✅ 设备分组管理
- ✅ WebSocket 实时推送
- ✅ 设备状态统计
- ✅ 数据持久化
- ✅ 健康检查
- ✅ 日志管理

## 部署说明

### 在 1Panel 中部署

1. 登录 1Panel 面板
2. 进入「应用商店」
3. 找到 MseisM 应用
4. 点击「安装」
5. 配置参数（密码等会自动生成）
6. 点击「确认」开始部署

### 手动部署

```bash
# 上传项目到服务器
cd /opt/mseism

# 修改.env 配置
vi .env

# 启动服务
docker-compose -f docker-compose.prod.yml up -d --build

# 查看状态
docker-compose ps
```

## 访问地址

- 前端：http://服务器 IP:前端端口
- 后端 API: http://服务器 IP:后端端口/api
- 数据库：服务器 IP:3306

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| DB_ROOT_PASSWORD | MySQL root 密码 | 自动生成 |
| DB_NAME | 数据库名称 | mseism |
| DB_USER | 数据库用户 | mseism |
| DB_PASSWORD | 数据库密码 | 自动生成 |
| DB_PORT | 数据库端口 | 3306 |
| BACKEND_PORT | 后端服务端口 | 3001 |
| FRONTEND_PORT | 前端服务端口 | 80 |
| JWT_SECRET | JWT 密钥 | 自动生成 |
| DEVICE_API_URL | 设备 API 地址 | 默认配置 |

## 数据持久化

- MySQL 数据：Docker 卷 `mseism_mysql_data`
- 后端日志：`./server/logs`

## 备份与恢复

### 备份数据库

```bash
docker exec mseism-mysql mysqldump -uroot -p${DB_ROOT_PASSWORD} mseism > backup.sql
```

### 恢复数据库

```bash
docker exec -i mseism-mysql mysql -uroot -p${DB_ROOT_PASSWORD} mseism < backup.sql
```

## 常见问题

### 1. 无法访问服务

检查防火墙端口是否开放，Docker 容器是否正常运行。

### 2. 数据库连接失败

等待 MySQL 完全启动（约 1 分钟），检查密码配置是否正确。

### 3. 如何更新

重新构建并部署：
```bash
docker-compose pull
docker-compose up -d
```

## 技术支持

- 文档：查看项目根目录的部署指南
- Issue: GitHub Issues
- 邮箱：support@example.com
