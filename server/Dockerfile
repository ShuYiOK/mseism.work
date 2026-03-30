# MseisM 后端 Dockerfile - 修复版
FROM node:18-alpine

# 配置 npm 镜像（加速国内下载）
RUN npm config set registry https://registry.npmmirror.com

# 安装 wget 用于健康检查
RUN apk add --no-cache wget

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制所有源代码
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 启动命令
CMD ["node", "server.js"]
