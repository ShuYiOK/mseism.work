#!/usr/bin/env bash
# =============================================================
# MseisM 服务器初始化脚本
# 仅首次部署时运行，配置 Docker、目录结构和环境
# 用法：sudo bash setup-server.sh
# =============================================================

set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log_info()    { echo -e "${CYAN}[INFO]${NC}    $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $*"; }

DEPLOY_DIR="/opt/mseism"
APP_USER="${SUDO_USER:-$(whoami)}"

# 1. 安装 Docker（如未安装）
if ! command -v docker &>/dev/null; then
  log_info "安装 Docker..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable --now docker
  usermod -aG docker "${APP_USER}"
  log_success "Docker 安装完成"
else
  log_success "Docker 已安装: $(docker --version)"
fi

# 2. 安装 docker-compose（v2 插件）
if ! docker compose version &>/dev/null; then
  log_info "安装 Docker Compose..."
  apt-get install -y docker-compose-plugin 2>/dev/null || \
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
       -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose
  log_success "Docker Compose 安装完成"
fi

# 3. 创建目录结构
log_info "创建目录结构..."
mkdir -p "${DEPLOY_DIR}"/{scripts,logs,backups,data}
chown -R "${APP_USER}:${APP_USER}" "${DEPLOY_DIR}"
log_success "目录创建完成: ${DEPLOY_DIR}"

# 4. 创建环境变量文件（首次）
if [ ! -f "${DEPLOY_DIR}/.env" ]; then
  log_info "创建环境变量模板..."
  cat > "${DEPLOY_DIR}/.env" << 'EOF'
# ── 数据库 ─────────────────────────────────
DB_ROOT_PASSWORD=CHANGE_ME_ROOT_PASSWORD
DB_NAME=mseism
DB_USER=mseism
DB_PASSWORD=CHANGE_ME_DB_PASSWORD
DB_PORT=3306

# ── 后端 ────────────────────────────────────
BACKEND_PORT=3001
NODE_ENV=production
JWT_SECRET=CHANGE_ME_JWT_SECRET_AT_LEAST_32_CHARS
DEVICE_API_URL=http://124.238.104.120:81/devices/list
ALLOWED_ORIGINS=http://localhost

# ── 前端 ────────────────────────────────────
FRONTEND_PORT=80

# ── 镜像版本（由 CI/CD 自动更新）─────────────
BACKEND_IMAGE=ghcr.io/your-org/mseism-backend:latest
FRONTEND_IMAGE=ghcr.io/your-org/mseism-frontend:latest
EOF
  log_success "环境变量模板已创建: ${DEPLOY_DIR}/.env"
  log_error "⚠️  请编辑 ${DEPLOY_DIR}/.env，修改所有 CHANGE_ME 的值！"
fi

# 5. 配置 UFW 防火墙（可选）
if command -v ufw &>/dev/null; then
  log_info "配置防火墙..."
  ufw allow 22/tcp   comment 'SSH'
  ufw allow 80/tcp   comment 'HTTP'
  ufw allow 443/tcp  comment 'HTTPS'
  log_success "防火墙规则已配置（22/80/443）"
fi

log_success "========================================"
log_success "  服务器初始化完成！"
log_success "========================================"
log_info "下一步:"
log_info "  1. 编辑 ${DEPLOY_DIR}/.env 设置密码和密钥"
log_info "  2. 将 docker-compose.prod.yml 上传到 ${DEPLOY_DIR}/"
log_info "  3. 在 GitHub Secrets 中配置 SSH 密钥"
log_info "  4. Push 代码到 master 分支触发自动部署"
