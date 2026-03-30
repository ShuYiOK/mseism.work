# 修复数据同步问题

$ServerIP = "43.142.147.37"
$Username = "lsby1984"
$Password = "Steven84."

Write-Host "[INFO] 修复MseisM数据同步问题..." -ForegroundColor Cyan

# 创建远程修复脚本
$remoteScript = @'
#!/bin/bash

echo "=== 检查服务状态 ==="
sudo systemctl status mseism --no-pager 2>&1 | head -20

echo ""
echo "=== 检查数据库 ==="
mysql -u root -p'Steven84.' -e "SHOW DATABASES;" 2>/dev/null || echo "MySQL root访问失败"
mysql -u mseism -p'mseism2024' -e "USE mseism; SHOW TABLES;" 2>/dev/null || echo "MySQL用户访问失败"

echo ""
echo "=== 检查数据库表结构 ==="
mysql -u mseism -p'mseism2024' -e "USE mseism; DESCRIBE devices;" 2>/dev/null || echo "无法描述devices表"

echo ""
echo "=== 检查设备数量 ==="
mysql -u mseism -p'mseism2024' -e "USE mseism; SELECT COUNT(*) as device_count FROM devices;" 2>/dev/null || echo "无法查询设备"

echo ""
echo "=== 检查日志 ==="
sudo tail -30 /opt/mseism/logs/error.log 2>/dev/null || echo "无错误日志"

echo ""
echo "=== 测试外部API ==="
curl -s --max-time 10 http://124.238.104.120:81/devices/list | wc -c

echo ""
echo "=== 重启服务 ==="
sudo systemctl restart mseism
sleep 3
sudo systemctl status mseism --no-pager 2>&1 | head -10

echo ""
echo "=== 等待同步 ==="
sleep 10

echo ""
echo "=== 检查同步后的设备数量 ==="
mysql -u mseism -p'mseism2024' -e "USE mseism; SELECT COUNT(*) as device_count FROM devices;" 2>/dev/null || echo "无法查询"

echo ""
echo "=== 完成 ==="
'@

# 保存脚本
$remoteScript | Out-File -FilePath "d:\Web\MseisM_b\remote-fix.sh" -Encoding UTF8

# 上传脚本
Write-Host "[INFO] 上传修复脚本..." -ForegroundColor Cyan
$env:SSH_ASKPASS = ""
$passwordSecure = ConvertTo-SecureString $Password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($Username, $passwordSecure)

# 使用scp上传
& scp -o StrictHostKeyChecking=no -o ConnectTimeout=30 "d:\Web\MseisM_b\remote-fix.sh" "${Username}@${ServerIP}:/tmp/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] 脚本上传成功" -ForegroundColor Green
    
    # 执行脚本
    Write-Host "[INFO] 执行修复脚本..." -ForegroundColor Cyan
    & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 "${Username}@${ServerIP}" "bash /tmp/remote-fix.sh"
} else {
    Write-Host "[ERROR] 脚本上传失败" -ForegroundColor Red
}

# 清理
Remove-Item "d:\Web\MseisM_b\remote-fix.sh" -Force -ErrorAction SilentlyContinue

Write-Host "[INFO] 修复完成" -ForegroundColor Cyan
