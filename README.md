# full-stack-example

轻量化 TypeScript 模块化单体：React/Vite 前端、Hono RPC API、Drizzle/PostgreSQL、LogTape 与 OpenTelemetry Collector。

## 开始使用

```bash
just init
Copy-Item .env.example .env
just launch-doctor
just launch
```

`just launch` 会启动 PostgreSQL 与 OpenTelemetry Collector、执行迁移，并运行 API（`http://localhost:3000`）与 Web（`http://localhost:5173`）。默认退出时保留基础设施；`just launch-clean` 会停止容器但不会删除数据卷。

## 常用命令

```bash
just check
just verify
just container-build
just stack-up
just db-migrate
just infra-down
just otel-logs
```

`just check` 是日常快速反馈，只执行只读 lint、类型检查和源码测试，不要求预先构建；测试由根 Vitest 配置运行一次。
`just verify` 在此基础上构建全部 workspace，适合作为提交或发布前的完整质量门禁。

`container/Dockerfile` 会在干净环境中安装锁定依赖并构建完整项目，最终生成一个同时提供 API 和 Web 的 Node 镜像：

```bash
podman build --file container/Dockerfile --tag full-stack-example:local .
```

镜像内只有一个 Node 进程：Hono 在 3000 端口提供 API、React SPA 和静态资源，Web 生产请求使用 same-origin 调用 API，
无需 Nginx。容器运行时通过环境变量配置数据库、Web Origin 和 OTLP 地址。

完整容器栈（PostgreSQL、Collector、应用）使用 Compose profile 启动：

```bash
just stack-up
just stack-status
just stack-logs
just stack-down
```

生产形态统一从 `http://localhost:3000` 访问；开发形态仍使用 Vite `5173` 和 API `3000`。

| 服务 | 地址 |
| --- | --- |
| PostgreSQL | localhost:5432 |
| OTLP HTTP | http://localhost:4318 |
| Collector health | http://localhost:13133 |

Health 端点为 `GET /health`，响应带 `Cache-Control: no-store`。浏览器端通过 Hono 的 `hc` 客户端和 TanStack Query 调用该端点，不生成 OpenAPI 或 Orval 客户端。

## 日志与遥测

LogTape 在开发环境输出可读日志，生产输出脱敏 JSON Lines。Trace 和 metrics 经 OTLP 发往本地 Collector；当前不包含 Loki、OpenObserve、Tempo、Prometheus、Redis 或缓存。

实时日志 SSE 默认关闭。仅开发环境可在 `.env` 设置 `LOG_STREAM_ENABLED=true` 后访问 `GET /api/logs/stream`：

```bash
curl -N http://localhost:3000/api/logs/stream
```

该流只保留当前 API 进程的有限内存记录，重启即丢失；它不是审计或长期日志存储。生产环境必须先提供管理员认证。
