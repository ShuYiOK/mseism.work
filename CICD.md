# MseisM CI/CD 自动化部署指南

> 本文档描述 MseisM 设备监控系统的完整 CI/CD 自动化流程，实现从代码提交到生产部署的全自动化。

---

## 📐 架构概览

```
开发者推送代码
      │
      ▼
┌─────────────────────────────────────────┐
│          GitHub Actions Pipeline        │
│                                         │
│  [安全扫描] → [后端测试] → [前端构建]   │
│                    ↓                    │
│             [构建Docker镜像]            │
│                    ↓                    │
│            [推送镜像到GHCR]             │
│                    ↓                    │
│           [SSH部署到生产服务器]          │
│                    ↓                    │
│              [健康检查]                 │
│           通过 ✅ / 失败→自动回滚 🔄    │
└─────────────────────────────────────────┘
      │
      ▼
生产服务器 (43.142.147.37)
  ├── mseism-mysql    (MySQL 8.0)
  ├── mseism-backend  (Node.js / Express)
  └── mseism-frontend (Vue3 / Nginx)
```

---

## 🚀 快速开始

### 1. 配置 GitHub Secrets

在 GitHub 仓库 → Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 描述 | 示例 |
|------------|------|------|
| `SERVER_HOST` | 服务器 IP 地址 | `43.142.147.37` |
| `SERVER_USER` | SSH 登录用户名 | `deploy` 或 `root` |
| `SERVER_SSH_KEY` | SSH 私钥（完整内容） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_PORT` | SSH 端口（可选，默认22） | `22` |

**生成 SSH 密钥对：**
```bash
# 生成专用部署密钥
ssh-keygen -t ed25519 -C "github-actions-mseism" -f ~/.ssh/mseism_deploy

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/mseism_deploy.pub user@43.142.147.37

# 将私钥内容复制到 GitHub Secrets (SERVER_SSH_KEY)
cat ~/.ssh/mseism_deploy
```

### 2. 初始化生产服务器（仅首次）

```bash
# 上传并执行初始化脚本
scp scripts/setup-server.sh user@43.142.147.37:/tmp/
ssh user@43.142.147.37 "sudo bash /tmp/setup-server.sh"

# 编辑环境变量
ssh user@43.142.147.37 "nano /opt/mseism/.env"

# 上传 Docker Compose 生产配置
scp docker-compose.prod.yml user@43.142.147.37:/opt/mseism/
scp scripts/deploy.sh user@43.142.147.37:/opt/mseism/scripts/
```

### 3. 触发第一次自动部署

```bash
git add .
git commit -m "feat: 启用 CI/CD 自动化部署"
git push origin master
# 自动触发 GitHub Actions 流水线 🎉
```

---

## 🔄 Pipeline 详解

### 流水线阶段

```
Push to master
    │
    ├─→ [JOB 1] 🔒 安全扫描（并行）
    │      ├── npm audit（后端依赖漏洞）
    │      ├── npm audit（前端依赖漏洞）
    │      └── TruffleHog（敏感信息泄露扫描）
    │
    ├─→ [JOB 2] 🧪 后端测试（依赖 JOB1）
    │      ├── 启动 MySQL 服务容器
    │      ├── 运行 Jest 测试套件
    │      └── 上传覆盖率报告
    │
    ├─→ [JOB 3] 🏗️ 前端构建（依赖 JOB1）
    │      ├── 运行 Vitest 测试
    │      ├── vite build 生产构建
    │      └── 上传构建产物
    │
    └─→ [JOB 4] 🐳 构建镜像（依赖 JOB2+JOB3）
           ├── 构建 backend Docker 镜像
           ├── 构建 frontend Docker 镜像
           ├── 推送到 GitHub Container Registry
           └─→ [JOB 5] 🚀 部署生产
                  ├── SSH 到生产服务器
                  ├── 执行 scripts/deploy.sh
                  ├── 健康检查（最多等待60秒）
                  └── 失败时自动回滚
```

### 触发条件

| 操作 | 触发范围 |
|------|---------|
| Push to `master` / `main` | 完整流水线（含部署） |
| Push to `release/**` | 完整流水线（含部署） |
| Pull Request | 仅安全扫描 + 测试 + 构建（不部署） |

---

## 🛡️ 安全机制

### 密钥管理原则
- ✅ 所有密钥通过 **GitHub Secrets** 注入，不写入代码
- ✅ 生产 `.env` 文件只存在服务器本地，不进入 Git
- ✅ Docker 容器以**非 root 用户**运行
- ✅ MySQL 端口不对外暴露，仅内部网络访问
- ✅ SSH 使用**专用部署密钥**，权限最小化

### .gitignore 必须包含
```gitignore
.env
.env.local
.env.production
*.key
*.pem
server/logs/
```

---

## 🔄 零停机部署流程

`scripts/deploy.sh` 实现滚动更新：

```
1. 备份当前版本信息
2. 拉取新 Docker 镜像
3. 先更新后端 → 健康检查通过
4. 再更新前端 → 健康检查通过
5. 清理旧镜像
```

**自动回滚触发条件：**
- 健康检查 60 秒内未通过
- 容器启动失败

---

## 🛠️ 常用运维命令

```bash
# 查看 CI/CD 流水线状态
# GitHub → Actions 标签页

# 本地开发
make dev              # 同时启动前后端

# 运行测试
make test             # 全部测试
make test-server      # 仅后端
make test-client      # 仅前端

# 构建
make build            # 前端生产构建
make docker-build     # 构建 Docker 镜像

# 部署
make deploy           # Push 触发自动部署
make deploy-check     # 检查生产健康状态

# 日志
make logs             # 实时查看后端日志

# 数据库备份
make db-backup        # 备份生产数据库

# 生成随机密钥
make gen-secrets      # 输出随机密钥供配置使用
```

---

## 📊 监控与告警

### 健康检查端点

| 端点 | 描述 |
|------|------|
| `GET /api/health` | 后端健康状态（含数据库连接） |
| `GET /health` | 前端 Nginx 状态 |

### 日志位置

| 类型 | 位置 |
|------|------|
| 后端应用日志 | `/opt/mseism/logs/` |
| Docker 容器日志 | `docker logs mseism-backend` |
| CI/CD 日志 | GitHub Actions → 对应 workflow run |

---

## 🔧 本地 Docker 开发

```bash
# 复制环境变量
cp .env.example .env
# 编辑 .env 填入本地配置

# 启动完整 Docker 环境
make docker-up

# 查看日志
make docker-logs

# 停止
make docker-down
```

---

## 📁 新建文件说明

| 文件/目录 | 用途 |
|----------|------|
| `.github/workflows/ci-cd.yml` | GitHub Actions 主流水线 |
| `server/Dockerfile` | 后端多阶段构建镜像 |
| `client/Dockerfile` | 前端多阶段构建镜像 |
| `client/nginx.conf` | 前端容器 Nginx 配置 |
| `docker-compose.prod.yml` | 生产环境编排配置 |
| `scripts/deploy.sh` | 服务器端自动部署脚本 |
| `scripts/setup-server.sh` | 服务器首次初始化脚本 |
| `.env.example` | 环境变量模板 |
| `Makefile` | 开发运维快捷命令 |
| `CICD.md` | 本文档 |

---

## ❓ 常见问题

**Q: 部署失败怎么办？**
- 查看 GitHub Actions 日志定位错误
- 服务器日志：`docker logs mseism-backend`
- 手动回滚：`make rollback`

**Q: 如何只部署某个服务？**
```bash
ssh user@server "cd /opt/mseism && docker-compose -f docker-compose.prod.yml up -d --no-deps backend"
```

**Q: 如何更新密钥？**
1. 在 GitHub Secrets 更新对应值
2. 在服务器 `/opt/mseism/.env` 更新
3. 重启服务：`docker-compose -f docker-compose.prod.yml restart backend`

---

*由 DevOps 自动化工程师生成 | MseisM v1.0.0*
