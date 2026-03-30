#!/bin/bash
# MseisM 完整部署脚本 - 在Ubuntu服务器上执行
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 配置
PROJECT_DIR="/opt/mseism"
DB_ROOT_PASSWORD="Steven84."
DB_NAME="mseism"
DB_USER="mseism"
DB_PASSWORD="mseism2024"
SERVER_IP="43.142.147.37"

echo ""
log_info "=========================================="
log_info "    MseisM 设备监控系统部署脚本"
log_info "=========================================="
echo ""

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 sudo 运行此脚本"
    exit 1
fi

# 更新系统
log_info "更新系统软件包..."
apt-get update -y
apt-get upgrade -y

# 安装必要的软件
log_info "安装必要软件..."
apt-get install -y curl wget git vim unzip net-tools software-properties-common

# 安装Node.js 20.x
log_info "安装Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
node_version=$(node --version)
npm_version=$(npm --version)
log_success "Node.js 版本: $node_version"
log_success "npm 版本: $npm_version"

# 安装MySQL
log_info "安装MySQL..."
if ! command -v mysql &> /dev/null; then
    apt-get install -y mysql-server
    systemctl enable mysql
    systemctl start mysql
fi

# 配置MySQL
log_info "配置MySQL..."
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$DB_ROOT_PASSWORD';" 2>/dev/null || true
mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true
mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';" 2>/dev/null || true
mysql -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';" 2>/dev/null || true
mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
log_success "MySQL配置完成"

# 安装Nginx
log_info "安装Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi
log_success "Nginx安装完成"

# 创建项目目录
log_info "创建项目目录..."
mkdir -p $PROJECT_DIR
mkdir -p $PROJECT_DIR/server
mkdir -p $PROJECT_DIR/client/dist
mkdir -p $PROJECT_DIR/logs

# 设置权限
chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

log_success "项目目录创建完成: $PROJECT_DIR"

# 等待项目文件上传
log_info "=========================================="
log_info "服务器环境准备完成！"
log_info "=========================================="
echo ""
echo "请上传项目文件到: $PROJECT_DIR"
echo ""
echo "需要上传的文件:"
echo "  - server/ 目录 (后端代码)"
echo "  - client/dist/ 目录 (前端构建文件)"
echo "  - mysql-init.sql (数据库初始化脚本)"
echo ""
echo "上传完成后，请运行: bash /opt/mseism/finish-deploy.sh"
echo "=========================================="
