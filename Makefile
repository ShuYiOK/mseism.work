# ============================================================
# MseisM Makefile - 开发 & 运维快捷命令
# 用法: make <target>
# ============================================================

.PHONY: help dev test build docker-build deploy clean logs health

# 默认目标：显示帮助
help:
	@echo ""
	@echo "  MseisM 开发运维快捷命令"
	@echo "  ─────────────────────────────────────────"
	@echo "  开发环境:"
	@echo "    make dev          启动本地开发环境（前端+后端）"
	@echo "    make dev-server   仅启动后端"
	@echo "    make dev-client   仅启动前端"
	@echo ""
	@echo "  测试:"
	@echo "    make test         运行所有测试"
	@echo "    make test-server  运行后端测试"
	@echo "    make test-client  运行前端测试"
	@echo "    make coverage     生成测试覆盖率报告"
	@echo ""
	@echo "  构建:"
	@echo "    make build        构建前端生产版本"
	@echo "    make docker-build 构建 Docker 镜像"
	@echo ""
	@echo "  部署:"
	@echo "    make deploy       推送触发 CI/CD 自动部署"
	@echo "    make deploy-check 检查生产环境健康状态"
	@echo "    make rollback     手动触发回滚"
	@echo ""
	@echo "  运维:"
	@echo "    make logs         查看生产日志"
	@echo "    make health       检查服务健康状态"
	@echo "    make clean        清理构建产物"
	@echo ""

# ─── 开发环境 ─────────────────────────────────────────────────
dev:
	@echo "启动本地开发环境..."
	@make -j2 dev-server dev-client

dev-server:
	cd server && npm run dev

dev-client:
	cd client && npm run dev

# ─── 安装依赖 ─────────────────────────────────────────────────
install:
	@echo "安装所有依赖..."
	cd server && npm ci
	cd client && npm ci
	@echo "依赖安装完成"

# ─── 测试 ─────────────────────────────────────────────────────
test: test-server test-client

test-server:
	@echo "运行后端测试..."
	cd server && npm test

test-client:
	@echo "运行前端测试..."
	cd client && npm test -- --run

coverage:
	@echo "生成测试覆盖率报告..."
	cd server && npm run test:coverage
	cd client && npm run test:coverage
	@echo "覆盖率报告已生成"

# ─── 构建 ─────────────────────────────────────────────────────
build:
	@echo "构建前端生产版本..."
	cd client && npm run build
	@echo "✅ 前端构建完成: client/dist/"

docker-build:
	@echo "构建 Docker 镜像..."
	docker build -t mseism-backend:local ./server
	docker build -t mseism-frontend:local ./client
	@echo "✅ 镜像构建完成"

docker-up:
	@echo "启动本地 Docker 环境..."
	docker-compose -f docker-compose.prod.yml --env-file .env up -d
	@echo "✅ 容器已启动"

docker-down:
	docker-compose -f docker-compose.prod.yml down

docker-logs:
	docker-compose -f docker-compose.prod.yml logs -f

# ─── 代码质量 ─────────────────────────────────────────────────
lint:
	@echo "代码检查..."
	cd server && npx eslint . --ext .js || true
	cd client && npx eslint . --ext .vue,.js || true

audit:
	@echo "安全漏洞扫描..."
	cd server && npm audit --audit-level=moderate
	cd client && npm audit --audit-level=moderate

# ─── 部署相关 ─────────────────────────────────────────────────
deploy:
	@echo "推送代码触发 CI/CD 自动部署..."
	git push origin master
	@echo "✅ 推送完成，查看 GitHub Actions 部署进度"
	@echo "   https://github.com/$(shell git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git//')/actions"

deploy-check:
	@echo "检查生产环境健康状态..."
	@SERVER_HOST=$$(grep SERVER_HOST .env 2>/dev/null | cut -d= -f2 || echo "43.142.147.37"); \
	curl -sf "http://$$SERVER_HOST/api/health" && echo "✅ 服务正常" || echo "❌ 服务异常"

rollback:
	@echo "⚠️  手动回滚 - 请输入目标版本 (格式: sha短码，如 a1b2c3d4)"
	@read -p "回滚到版本: " VERSION; \
	ssh $(shell grep SERVER_USER .env 2>/dev/null | cut -d= -f2 || echo "deploy")@$(shell grep SERVER_HOST .env 2>/dev/null | cut -d= -f2 || echo "SERVER") \
		"cd /opt/mseism && bash scripts/deploy.sh $$VERSION"

# ─── 日志 & 监控 ──────────────────────────────────────────────
logs:
	@SERVER=$$(grep SERVER_HOST .env 2>/dev/null | cut -d= -f2 || echo "43.142.147.37"); \
	ssh $(shell grep SERVER_USER .env 2>/dev/null | cut -d= -f2 || echo "root")@$$SERVER \
		"docker logs mseism-backend -f --tail=100"

logs-frontend:
	@SERVER=$$(grep SERVER_HOST .env 2>/dev/null | cut -d= -f2 || echo "43.142.147.37"); \
	ssh $(shell grep SERVER_USER .env 2>/dev/null | cut -d= -f2 || echo "root")@$$SERVER \
		"docker logs mseism-frontend -f --tail=100"

health:
	@echo "检查服务健康状态..."
	@curl -sf http://localhost:3001/api/health && echo "✅ 后端正常" || echo "❌ 后端异常"

# ─── 清理 ─────────────────────────────────────────────────────
clean:
	@echo "清理构建产物..."
	rm -rf client/dist
	rm -rf server/coverage
	rm -rf client/coverage
	rm -f *.zip
	@echo "✅ 清理完成"

clean-docker:
	docker system prune -f
	docker volume prune -f

# ─── 数据库相关 ───────────────────────────────────────────────
db-backup:
	@echo "备份数据库..."
	@SERVER=$$(grep SERVER_HOST .env 2>/dev/null | cut -d= -f2 || echo "43.142.147.37"); \
	DATE=$$(date +%Y%m%d-%H%M%S); \
	ssh root@$$SERVER "docker exec mseism-mysql mysqldump -u root -p\$${DB_ROOT_PASSWORD} mseism > /opt/mseism/backups/db-$$DATE.sql"
	@echo "✅ 数据库备份完成"

# ─── 密钥生成辅助 ─────────────────────────────────────────────
gen-secrets:
	@echo "生成随机密钥（复制到 GitHub Secrets）:"
	@echo "JWT_SECRET=$(shell openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')"
	@echo "DB_PASSWORD=$(shell openssl rand -base64 16 2>/dev/null || python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"
	@echo "DB_ROOT_PASSWORD=$(shell openssl rand -base64 16 2>/dev/null || python3 -c 'import secrets; print(secrets.token_urlsafe(16))')"
