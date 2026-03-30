<?php
/**
 * MseisM 数据库修复脚本
 * 可通过浏览器访问执行
 */

echo "<h1>MseisM 数据库修复脚本</h1>";
echo "<pre>";

// 执行系统命令
function runCommand($command) {
    echo "[CMD] $command\n";
    $output = [];
    $return_var = 0;
    exec($command, $output, $return_var);
    foreach ($output as $line) {
        echo "$line\n";
    }
    if ($return_var !== 0) {
        echo "[ERROR] 命令执行失败，返回码: $return_var\n";
    }
    echo "\n";
}

echo "==========================================\n";
echo "    MseisM 数据库修复脚本\n";
echo "==========================================\n\n";

// 停止服务
echo "[INFO] 停止MseisM服务...\n";
runCommand('sudo systemctl stop mseism 2>/dev/null || true');

// 修复数据库表结构
echo "[INFO] 修复数据库表结构...\n";
$mysqlCommand = 'sudo mysql -u root -p"Steven84." mseism << \'EOF\'';
$mysqlCommand .= '\n-- 删除旧表（如果存在）\n';
$mysqlCommand .= 'DROP TABLE IF EXISTS device_group_mapping;\n';
$mysqlCommand .= 'DROP TABLE IF EXISTS device_groups;\n';
$mysqlCommand .= 'DROP TABLE IF EXISTS devices;\n';
$mysqlCommand .= 'DROP TABLE IF EXISTS operation_logs;\n';
$mysqlCommand .= 'DROP TABLE IF EXISTS users;\n\n';

$mysqlCommand .= '-- 创建设备表（与代码匹配的结构）\n';
$mysqlCommand .= 'CREATE TABLE devices (\n';
$mysqlCommand .= '  id VARCHAR(36) PRIMARY KEY,\n';
$mysqlCommand .= '  name VARCHAR(255) NOT NULL,\n';
$mysqlCommand .= '  ip_address VARCHAR(255),\n';
$mysqlCommand .= '  mac_address VARCHAR(255),\n';
$mysqlCommand .= '  status VARCHAR(20) DEFAULT \'offline\',\n';
$mysqlCommand .= '  online TINYINT(1) DEFAULT 0,\n';
$mysqlCommand .= '  cpu_usage DOUBLE DEFAULT 0,\n';
$mysqlCommand .= '  memory_usage DOUBLE DEFAULT 0,\n';
$mysqlCommand .= '  storage_usage DOUBLE DEFAULT 0,\n';
$mysqlCommand .= '  temperature DOUBLE DEFAULT 0,\n';
$mysqlCommand .= '  last_heartbeat INT DEFAULT 0,\n';
$mysqlCommand .= '  sync_hash VARCHAR(32),\n';
$mysqlCommand .= '  created_at INT DEFAULT 0,\n';
$mysqlCommand .= '  updated_at INT DEFAULT 0\n';
$mysqlCommand .= ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

$mysqlCommand .= '-- 创建设备分组表\n';
$mysqlCommand .= 'CREATE TABLE device_groups (\n';
$mysqlCommand .= '  id VARCHAR(36) PRIMARY KEY,\n';
$mysqlCommand .= '  name VARCHAR(255) NOT NULL UNIQUE,\n';
$mysqlCommand .= '  description TEXT,\n';
$mysqlCommand .= '  color VARCHAR(20) DEFAULT \'#667eea\',\n';
$mysqlCommand .= '  sort_order INT DEFAULT 0,\n';
$mysqlCommand .= '  created_at INT DEFAULT 0,\n';
$mysqlCommand .= '  updated_at INT DEFAULT 0\n';
$mysqlCommand .= ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

$mysqlCommand .= '-- 创建设备分组映射表\n';
$mysqlCommand .= 'CREATE TABLE device_group_mapping (\n';
$mysqlCommand .= '  id VARCHAR(36) PRIMARY KEY,\n';
$mysqlCommand .= '  device_id VARCHAR(36) NOT NULL,\n';
$mysqlCommand .= '  group_id VARCHAR(36) NOT NULL,\n';
$mysqlCommand .= '  created_at INT DEFAULT 0,\n';
$mysqlCommand .= '  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,\n';
$mysqlCommand .= '  FOREIGN KEY (group_id) REFERENCES device_groups(id) ON DELETE CASCADE,\n';
$mysqlCommand .= '  UNIQUE(device_id, group_id)\n';
$mysqlCommand .= ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

$mysqlCommand .= '-- 创建操作日志表\n';
$mysqlCommand .= 'CREATE TABLE operation_logs (\n';
$mysqlCommand .= '  id INT AUTO_INCREMENT PRIMARY KEY,\n';
$mysqlCommand .= '  type VARCHAR(50) NOT NULL,\n';
$mysqlCommand .= '  action VARCHAR(255) NOT NULL,\n';
$mysqlCommand .= '  user_id VARCHAR(50),\n';
$mysqlCommand .= '  ip_address VARCHAR(50),\n';
$mysqlCommand .= '  user_agent VARCHAR(255),\n';
$mysqlCommand .= '  details JSON,\n';
$mysqlCommand .= '  level VARCHAR(20) DEFAULT \'info\',\n';
$mysqlCommand .= '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n';
$mysqlCommand .= ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

$mysqlCommand .= '-- 创建用户表\n';
$mysqlCommand .= 'CREATE TABLE users (\n';
$mysqlCommand .= '  id VARCHAR(50) PRIMARY KEY,\n';
$mysqlCommand .= '  username VARCHAR(50) NOT NULL,\n';
$mysqlCommand .= '  email VARCHAR(100) NOT NULL,\n';
$mysqlCommand .= '  password_hash VARCHAR(255) NOT NULL,\n';
$mysqlCommand .= '  role VARCHAR(20) DEFAULT \'user\',\n';
$mysqlCommand .= '  email_verified TINYINT(1) DEFAULT 0,\n';
$mysqlCommand .= '  last_login TIMESTAMP NULL,\n';
$mysqlCommand .= '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n';
$mysqlCommand .= '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n';
$mysqlCommand .= '  UNIQUE KEY unique_username (username),\n';
$mysqlCommand .= '  UNIQUE KEY unique_email (email)\n';
$mysqlCommand .= ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

$mysqlCommand .= '-- 创建索引\n';
$mysqlCommand .= 'CREATE INDEX idx_devices_status ON devices(status);\n';
$mysqlCommand .= 'CREATE INDEX idx_devices_online ON devices(online);\n';
$mysqlCommand .= 'CREATE INDEX idx_devices_online_status ON devices(online, status);\n';
$mysqlCommand .= 'CREATE INDEX idx_devices_last_heartbeat ON devices(last_heartbeat);\n';
$mysqlCommand .= 'CREATE INDEX idx_devices_hash ON devices(sync_hash);\n';
$mysqlCommand .= 'CREATE INDEX idx_mapping_device ON device_group_mapping(device_id);\n';
$mysqlCommand .= 'CREATE INDEX idx_mapping_group ON device_group_mapping(group_id);\n';
$mysqlCommand .= 'CREATE INDEX idx_mapping_group_device ON device_group_mapping(group_id, device_id);\n';
$mysqlCommand .= 'CREATE INDEX idx_groups_sort ON device_groups(sort_order, name);\n';
$mysqlCommand .= 'CREATE INDEX idx_operation_logs_type ON operation_logs(type);\n';
$mysqlCommand .= 'CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);\n\n';

$mysqlCommand .= '-- 验证表创建成功\n';
$mysqlCommand .= 'SHOW TABLES;\n';
$mysqlCommand .= 'SELECT COUNT(*) as total_devices FROM devices;\n';
$mysqlCommand .= 'EOF';

runCommand($mysqlCommand);

echo "[SUCCESS] 数据库表结构修复完成\n\n";

// 清空日志
echo "[INFO] 清空旧日志...\n";
runCommand('sudo truncate -s 0 /opt/mseism/logs/app.log 2>/dev/null || true');
runCommand('sudo truncate -s 0 /opt/mseism/logs/error.log 2>/dev/null || true');

// 启动服务
echo "[INFO] 启动MseisM服务...\n";
runCommand('sudo systemctl start mseism');
runCommand('sleep 5');

// 检查服务状态
echo "[INFO] 检查服务状态...\n";
runCommand('sudo systemctl status mseism --no-pager 2>&1 | head -10');

// 等待同步
echo "[INFO] 等待数据同步（15秒）...\n";
runCommand('sleep 15');

// 检查同步状态
echo "[INFO] 检查同步状态...\n";
runCommand('curl -s http://localhost:3001/api/sync/status');

echo "\n[INFO] 检查设备数量...\n";
runCommand('curl -s http://localhost:3001/api/devices');

echo "\n==========================================\n";
echo "    修复完成！\n";
echo "==========================================\n";
echo "访问地址: http://43.142.147.37\n";
echo "\n如果设备列表仍为空，请检查日志:\n";
echo "  sudo tail -f /opt/mseism/logs/error.log\n";
echo "==========================================\n";
echo "</pre>";
