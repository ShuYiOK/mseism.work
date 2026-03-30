#!/bin/bash
# MseisM 部署完成脚本 - 在Ubuntu服务器上执行
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
log_info "    MseisM 部署完成脚本"
log_info "=========================================="
echo ""

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    log_error "请使用 sudo 运行此脚本"
    exit 1
fi

# 检查项目文件
if [ ! -d "$PROJECT_DIR/server" ]; then
    log_error "后端目录不存在: $PROJECT_DIR/server"
    exit 1
fi

if [ ! -d "$PROJECT_DIR/client/dist" ]; then
    log_error "前端构建目录不存在: $PROJECT_DIR/client/dist"
    exit 1
fi

# 导入数据库结构
if [ -f "$PROJECT_DIR/mysql-init.sql" ]; then
    log_info "导入数据库结构..."
    mysql -u root -p"$DB_ROOT_PASSWORD" $DB_NAME < $PROJECT_DIR/mysql-init.sql
    log_success "数据库结构导入完成"
else
    log_warning "未找到 mysql-init.sql 文件，跳过数据库初始化"
fi

# 配置后端环境变量
log_info "配置后端环境变量..."
cat > $PROJECT_DIR/server/.env << EOF
# 服务器配置
PORT=3001
NODE_ENV=production

# MySQL 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# 外部设备数据源 API
DEVICE_API_URL=http://124.238.104.120:81/devices/list

# 数据同步配置（毫秒）
SYNC_INTERVAL=5000
OFFLINE_THRESHOLD=300
API_TIMEOUT=10000

# WebSocket 配置
WS_PING_TIMEOUT=120000
WS_PING_INTERVAL=60000

# JWT 认证配置
JWT_SECRET=mseism-jwt-secret-key-2024-production-ready-change-this
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d

# 密码加密配置
BCRYPT_ROUNDS=12

# CORS 配置
ALLOWED_ORIGINS=http://localhost,http://$SERVER_IP,http://$SERVER_IP:3001

# 安全配置
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_TIME=30

# 性能监控配置
ENABLE_PERFORMANCE_MONITORING=true
PERFORMANCE_ALERT_THRESHOLD=1000
SYNC_ALERT_THRESHOLD=5000

# 日志配置
LOG_LEVEL=info
ENABLE_ACCESS_LOG=true
ENABLE_ERROR_LOG=true
ENABLE_OPERATION_LOG=true

# 速率限制配置
API_RATE_LIMIT_WINDOW=60000
API_RATE_LIMIT_MAX=100
SYNC_RATE_LIMIT_WINDOW=60000
SYNC_RATE_LIMIT_MAX=10
EOF

log_success "环境变量配置完成"

# 安装后端依赖
log_info "安装后端依赖..."
cd $PROJECT_DIR/server
npm install --production
log_success "后端依赖安装完成"

# 设置权限
chown -R www-data:www-data $PROJECT_DIR
chmod -R 755 $PROJECT_DIR

# 配置Systemd服务
log_info "配置Systemd服务..."
cat > /etc/systemd/system/mseism.service << EOF
[Unit]
Description=MseisM Device Monitor Service
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$PROJECT_DIR/server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=append:$PROJECT_DIR/logs/app.log
StandardError=append:$PROJECT_DIR/logs/error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mseism
log_success "Systemd服务配置完成"

# 配置Nginx
log_info "配置Nginx..."
cat > /etc/nginx/sites-available/mseism << EOF
server {
    listen 80;
    server_name $SERVER_IP;
    
    # 日志配置
    access_log /var/log/nginx/mseism-access.log;
    error_log /var/log/nginx/mseism-error.log;
    
    # 前端静态文件
    location / {
        root $PROJECT_DIR/client/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket代理
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # WebSocket超时设置
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/mseism /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

# 重载Nginx
systemctl reload nginx
log_success "Nginx配置完成"

# 启动服务
log_info "启动MseisM服务..."
systemctl start mseism
sleep 3

# 检查服务状态
if systemctl is-active --quiet mseism; then
    log_success "MseisM服务启动成功"
else
    log_error "MseisM服务启动失败"
    journalctl -u mseism --no-pager -n 20
    exit 1
fi

# 开放防火墙端口
log_info "配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 3001/tcp
    ufw --force enable
    log_success "UFW防火墙配置完成"
fi

echo ""
log_success "=========================================="
log_success "    部署完成！"
log_success "=========================================="
echo ""
echo "访问地址: http://$SERVER_IP"
echo "API地址: http://$SERVER_IP/api"
echo ""
echo "管理命令:"
echo "  查看状态: sudo systemctl status mseism"
echo "  查看日志: sudo journalctl -u mseism -f"
echo "  应用日志: sudo tail -f $PROJECT_DIR/logs/app.log"
echo "  错误日志: sudo tail -f $PROJECT_DIR/logs/error.log"
echo "  重启服务: sudo systemctl restart mseism"
echo "  停止服务: sudo systemctl stop mseism"
echo "  Nginx日志: sudo tail -f /var/log/nginx/mseism-error.log"
echo "=========================================="
