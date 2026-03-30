#!/bin/bash
# 修复MySQL root密码并创建数据库

# 设置root密码
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Steven84.';" 2>/dev/null || true

# 使用新密码连接
mysql -u root -p'Steven84.' -e "CREATE DATABASE IF NOT EXISTS mseism CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p'Steven84.' -e "CREATE USER IF NOT EXISTS 'mseism'@'localhost' IDENTIFIED BY 'mseism2024';"
mysql -u root -p'Steven84.' -e "GRANT ALL PRIVILEGES ON mseism.* TO 'mseism'@'localhost';"
mysql -u root -p'Steven84.' -e "FLUSH PRIVILEGES;"

echo "MySQL配置完成"
