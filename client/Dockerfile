# ─────────────────────────────────────────────
# Stage 1: 构建前端静态文件
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 接收构建参数 - 使用相对路径，通过 Nginx 反向代理
ARG VITE_API_URL=/api
ARG VITE_SOCKET_URL=

# 仅复制 package 文件
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps && npm cache clean --force

# 复制源代码并构建
COPY . .
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Nginx 静态服务
# ─────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# 安全：移除默认配置
RUN rm -rf /usr/share/nginx/html/* && \
    rm -f /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# 构建元数据
LABEL maintainer="MseisM Team" \
      org.label-schema.description="MseisM 设备监控系统 - 前端服务"

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
