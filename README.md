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

## 开发流程与热更新

从干净环境开始时依次执行：

```bash
just init
Copy-Item .env.example .env
just launch-doctor
just launch
```

开发服务由两个 watch 进程组成：

- API 使用 `tsx watch`。修改 API 或被 API 直接引用的共享 TypeScript 包后，进程会自动重启；这不是保留运行时状态的 HMR。
- Web 使用 Vite。React 组件和样式支持 HMR，通常无需完整刷新浏览器；`api-client` 通过 Vite alias 直接加载源码，修改后会重新编译。

API 重启会丢失进程内状态（包括 SSE 日志流和临时状态），但不会删除 PostgreSQL 数据。修改数据库 schema 或 migration 后需要显式执行：

```bash
just db-generate
just db-migrate
```

修改 `.env`、依赖、Vite/TypeScript/Compose 配置后，请停止当前进程并重新运行 `just launch`。`just stack-up` 是生产形态验证，不支持源码热更新；源码变化后需要重新构建镜像。

开发地址：Web `http://localhost:5173`，API `http://localhost:3000`，Health `http://localhost:3000/health`，Collector health `http://localhost:13133`。

按 `Ctrl+C` 停止宿主机 API/Web；默认保留基础设施。使用 `just launch-clean` 同时停止基础设施，使用 `just infra-down` 仅停止基础设施。

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

命令分层如下：

| 命令 | 用途 |
| --- | --- |
| `just dev` | 仅启动 API/Web 热更新开发进程 |
| `just launch` | 启动基础设施、迁移数据库并启动开发进程 |
| `just check` | lint、typecheck、源码测试，不构建 `dist` |
| `just test-watch` | Vitest 监听模式 |
| `just verify` | `check` 后构建全部 workspace |
| `just container-build` | 构建单一生产镜像 |
| `just stack-up` | 启动 PostgreSQL、Collector 和应用容器 |
| `just stack-down` | 停止完整容器栈 |

日常修改使用 `just launch` 或 `just dev`，提交前使用 `just check`，发布或容器验证使用 `just verify` 与 `just stack-up`。测试直接消费 TypeScript 源码，不依赖预先存在的 `dist`。

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

## 计划状态与边界

当前已完成：React/Vite 与 Hono API workspace、`setupXxxApp(app, options)` 依赖倒置组合、LogTape 脱敏日志、OpenTelemetry Collector、开发期 SSE 日志流、Hono 单进程托管生产 Web、单镜像 Dockerfile/Compose profile，以及根级 Biome、统一 Vitest 和 `check`/`verify` 验证链路。

当前明确不包含 Loki、OpenObserve、Tempo、Prometheus、Redis、缓存、日志持久化或 OpenAPI/Orval。SSE 是单进程、易失、非审计的实时诊断流，生产环境在管理员认证完成前禁止启用。HonoX 调研结论是暂不引入 SSR、SSG、文件路由或 islands，仅借鉴其构建边界和测试思路。

后续可按需求增加管理员认证与日志页面、多实例日志聚合或持久化后端，并保持现有 SSE 事件协议兼容。
