#!/bin/bash
# 修复数据库配置
mysql -u root -e "CREATE DATABASE IF NOT EXISTS mseism CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -e "CREATE USER IF NOT EXISTS 'mseism'@'localhost' IDENTIFIED BY 'mseism2024';"
mysql -u root -e "GRANT ALL PRIVILEGES ON mseism.* TO 'mseism'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"
echo "数据库创建成功"
