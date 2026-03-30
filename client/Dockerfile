# MseisM 前端 Dockerfile - 最终修复版
# 阶段 1: 构建前端
FROM node:18-alpine AS builder

WORKDIR /app

# 配置 npm 镜像（加速国内下载）
RUN npm config set registry https://registry.npmmirror.com

# 复制 package 文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm install

# 复制所有源代码
COPY . .

# 创建简化的 vite 配置（避免路径问题）
RUN cat > vite.config.build.js << 'EOF'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})
EOF

# 使用简化的 vite 配置构建
RUN npx vite build --config vite.config.build.js

# ===========================================
# 阶段 2: Nginx 运行
# ===========================================
FROM nginx:alpine

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
