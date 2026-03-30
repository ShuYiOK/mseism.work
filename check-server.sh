#!/bin/bash
# 检查服务器状态

echo "=== 检查MseisM服务状态 ==="
systemctl status mseism --no-pager

echo ""
echo "=== 检查端口监听 ==="
ss -tlnp | grep -E '3001|80'

echo ""
echo "=== 检查应用日志 ==="
tail -50 /opt/mseism/logs/app.log 2>/dev/null || echo "无应用日志"

echo ""
echo "=== 检查错误日志 ==="
tail -50 /opt/mseism/logs/error.log 2>/dev/null || echo "无错误日志"

echo ""
echo "=== 检查系统日志 ==="
journalctl -u mseism --no-pager -n 50

echo ""
echo "=== 测试外部API连接 ==="
curl -s --max-time 10 http://124.238.104.120:81/devices/list | head -c 200

echo ""
echo "=== 检查数据库连接 ==="
mysql -u mseism -p'mseism2024' -e "USE mseism; SELECT COUNT(*) FROM devices;" 2>/dev/null || echo "数据库连接失败"
