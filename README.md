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
just db-migrate
just infra-down
just otel-logs
```

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
