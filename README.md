# full-stack-example

轻量化 TypeScript 模块化单体示例：React/Vite 前端、Hono RPC API、Drizzle/PostgreSQL 数据库和 Pino 日志。

## 开始使用

```bash
just init
Copy-Item .env.example .env
just launch-doctor
just launch
```

`just launch` 会启动 PostgreSQL、执行迁移，并同时运行 API（`http://localhost:3000`）与 Web（`http://localhost:5173`）。默认退出时保留数据库；使用 `just launch-clean` 会停止 Compose 服务但不会删除数据卷。

## 常用命令

```bash
just check
just db-migrate
just infra-down
```

Health 端点为 `GET /health`。浏览器端通过 Hono 的 `hc` 客户端和 TanStack Query 调用该端点，不生成 OpenAPI 或 Orval 客户端。
