# ─────────────────────────────────────────────
# Stage 1: 安装依赖
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# 仅复制 package 文件，利用 Docker 层缓存
COPY package.json package-lock.json ./

# 使用 install 代替 ci，确保兼容旧版本 npm
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# ─────────────────────────────────────────────
# Stage 2: 生产运行时
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# 安全：非 root 用户运行
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules

# 复制应用代码（排除测试和开发文件）
COPY --chown=appuser:appgroup . .

# 创建日志目录
RUN mkdir -p /app/logs && chown appuser:appgroup /app/logs

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 构建元数据
ARG BUILD_DATE
ARG VCS_REF
LABEL maintainer="MseisM Team" \
      org.label-schema.build-date="${BUILD_DATE}" \
      org.label-schema.vcs-ref="${VCS_REF}" \
      org.label-schema.description="MseisM 设备监控系统 - 后端服务"

CMD ["node", "server.js"]
