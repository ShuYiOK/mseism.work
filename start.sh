#!/bin/bash
# 设置环境变量
export NODE_ENV=production
export PORT=3001
export DB_HOST=localhost
export DB_PORT=3306
export DB_NAME=mseism
export DB_USER=mseism
export DB_PASSWORD=Steven84
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=Steven84
export JWT_SECRET=your-secret-key-here-at-least-32-characters-long

# 启动应用
cd /opt/mseism/server
npm start