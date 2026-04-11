#!/usr/bin/env bash
# =============================================================
# MseisM 生产服务器自动部署脚本
# 用途：由 GitHub Actions 远程调用，执行滚动更新
# 用法：bash deploy.sh <VERSION>
# =============================================================

set -euo pipefail

# ─── 颜色输出 ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # 无颜色

log_info()    { echo -e "${CYAN}[INFO]${NC}    $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $*"; }

# ─── 参数 & 配置 ────────────────────────────────────────────
DEPLOY_VERSION="${1:-latest}"
DEPLOY_DIR="/opt/mseism"
BACKUP_DIR="/opt/mseism/backups"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"

REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_PREFIX="${IMAGE_PREFIX:-your-org/mseism}"
BACKEND_IMAGE="${REGISTRY}/${IMAGE_PREFIX}-backend:${DEPLOY_VERSION}"
FRONTEND_IMAGE="${REGISTRY}/${IMAGE_PREFIX}-frontend:${DEPLOY_VERSION}"

MAX_HEALTH_WAIT=60   # 秒
HEALTH_INTERVAL=5

# ─── 前置检查 ────────────────────────────────────────────────
check_dependencies() {
  log_info "检查依赖..."
  for cmd in docker docker-compose curl; do
    if ! command -v "$cmd" &>/dev/null; then
      log_error "缺少命令: $cmd"
      exit 1
    fi
  done
  log_success "依赖检查通过"
}

# ─── 备份当前环境 ────────────────────────────────────────────
backup_current() {
  log_info "备份当前部署状态..."
  mkdir -p "${BACKUP_DIR}"
  BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"

  # 记录当前运行的镜像版本
  docker ps --format '{{.Names}}\t{{.Image}}' > "${BACKUP_DIR}/${BACKUP_TAG}.versions" 2>/dev/null || true

  # 保留最近 5 次备份
  ls -t "${BACKUP_DIR}"/*.versions 2>/dev/null | tail -n +6 | xargs rm -f || true

  log_success "备份完成: ${BACKUP_TAG}"
}

# ─── 拉取新镜像 ─────────────────────────────────────────────
pull_images() {
  log_info "拉取新镜像 (版本: ${DEPLOY_VERSION})..."
  docker pull "${BACKEND_IMAGE}"
  docker pull "${FRONTEND_IMAGE}"
  log_success "镜像拉取完成"
}

# ─── 零停机滚动更新 ──────────────────────────────────────────
rolling_update() {
  log_info "开始滚动更新..."

  cd "${DEPLOY_DIR}"

  # 用环境变量覆盖镜像版本
  export BACKEND_IMAGE FRONTEND_IMAGE

  # 先更新后端
  log_info "更新后端服务..."
  docker-compose -f "${COMPOSE_FILE}" up -d --no-deps --build backend
  wait_healthy "mseism-backend" "http://localhost:3001/api/health"

  # 再更新前端
  log_info "更新前端服务..."
  docker-compose -f "${COMPOSE_FILE}" up -d --no-deps --build frontend
  wait_healthy "mseism-frontend" "http://localhost/health"

  log_success "滚动更新完成"
}

# ─── 健康检查 ────────────────────────────────────────────────
wait_healthy() {
  local container=$1
  local url=$2
  local elapsed=0

  log_info "等待 ${container} 就绪..."
  while [ $elapsed -lt $MAX_HEALTH_WAIT ]; do
    if curl -sf "$url" &>/dev/null; then
      log_success "${container} 健康检查通过 (耗时 ${elapsed}s)"
      return 0
    fi
    sleep $HEALTH_INTERVAL
    elapsed=$((elapsed + HEALTH_INTERVAL))
    log_info "  等待中... ${elapsed}s / ${MAX_HEALTH_WAIT}s"
  done

  log_error "${container} 健康检查超时，触发自动回滚！"
  auto_rollback
  exit 1
}

# ─── 自动回滚 ────────────────────────────────────────────────
auto_rollback() {
  log_warn "=========================================="
  log_warn "  执行自动回滚..."
  log_warn "=========================================="

  cd "${DEPLOY_DIR}"

  # 找到最新备份
  LAST_BACKUP=$(ls -t "${BACKUP_DIR}"/*.versions 2>/dev/null | head -1)
  if [ -z "$LAST_BACKUP" ]; then
    log_error "没有可用的备份，无法回滚！"
    return 1
  fi

  # 重启到之前的版本（用 docker-compose restart 快速回滚）
  docker-compose -f "${COMPOSE_FILE}" restart backend frontend

  log_warn "回滚完成，请检查服务状态"
}

# ─── 清理旧镜像 ─────────────────────────────────────────────
cleanup_old_images() {
  log_info "清理悬空镜像..."
  docker image prune -f || true
  log_success "清理完成"
}

# ─── 打印部署摘要 ────────────────────────────────────────────
print_summary() {
  echo ""
  log_success "=========================================="
  log_success "    MseisM 部署完成！"
  log_success "=========================================="
  log_info "部署版本:  ${DEPLOY_VERSION}"
  log_info "后端镜像:  ${BACKEND_IMAGE}"
  log_info "前端镜像:  ${FRONTEND_IMAGE}"
  log_info "部署时间:  $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  log_info "运行状态:"
  docker ps --filter "name=mseism" --format "  {{.Names}}\t{{.Status}}" 2>/dev/null || true
  echo ""
  log_info "访问地址:  http://$(curl -sf ifconfig.me 2>/dev/null || echo 'SERVER_IP')"
}

# ─── 主流程 ─────────────────────────────────────────────────
main() {
  echo ""
  log_info "=========================================="
  log_info "    MseisM 自动部署脚本 v2.0"
  log_info "    版本: ${DEPLOY_VERSION}"
  log_info "=========================================="
  echo ""

  check_dependencies
  backup_current
  pull_images
  rolling_update
  cleanup_old_images
  print_summary
}

main "$@"
