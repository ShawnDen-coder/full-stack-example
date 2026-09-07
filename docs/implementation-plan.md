# 全栈模板实施基线

## 架构

这是一个 pnpm workspace 模块化单体：

```text
apps/api       Hono HTTP/RPC 宿主、SSE、OpenTelemetry 生命周期
apps/web       React/Vite、TanStack Query 与 Hono RPC 客户端
packages/api-client  浏览器安全的 hc 封装
packages/database    Drizzle schema、postgres.js 连接与迁移
packages/logging     LogTape、脱敏与进程内日志流
packages/system      Health route/service/schema
container            单镜像 Dockerfile、Compose、Collector 配置与 ignore 规则
scripts/launch.ts    本地基础设施和子进程编排
```

根 `biome.json` 是唯一 lint 与格式化配置；所有手写源码通过 `just check` 验证。包级 `tsconfig.build.json` 用于构建声明文件，不能删除。所有容器文件必须放在 `container/`。

HonoX 调研后不引入 `honox` 或 `@hono/vite-build`：当前项目不需要 SSR、SSG、islands 或文件路由。借鉴其 client/server 构建边界、生产资源与 Hono 服务共置以及 `app.request()` 集成测试方式；生产部署采用 Node/Hono 单进程。

## 运行与可观测性

`just launch` 启动 PostgreSQL 和 OpenTelemetry Collector，等待两者 ready，执行迁移，再启动宿主机 API 与 Web watch。`just stack-up` 使用 `container/compose.yaml` 的 `application` profile 构建并启动单一应用镜像；Hono 在 3000 端口同时提供 API、React SPA 与静态资源。API 启动顺序为：配置 LogTape、启动 telemetry、迁移、创建数据库、创建 Hono 应用、监听端口。关闭顺序相反，并释放所有资源。

日志使用 LogTape：开发环境输出 pretty 文本，生产输出脱敏 JSON Lines。设置 `LOG_FILE` 后，API 会将同样脱敏的 JSON Lines 追加到文件；Compose 通过命名卷保留 `/app/logs/api.jsonl`。每条记录包含 service、environment、可用时的 version，以及 request/trace/span 关联字段。禁止记录 body、完整 headers、SQL 参数、环境变量或凭据。

`@hono/otel` 发送 traces 和 metrics 到本地 Collector 的 OTLP HTTP endpoint。当前 Collector 使用 debug exporter；不包含 Loki、OpenObserve、Tempo、Prometheus、Redis 或缓存。

## SSE 日志流

开发环境可显式设置 `LOG_STREAM_ENABLED=true` 以注册 `GET /api/logs/stream`。日志流是单进程、有界、易失的诊断能力：记录保存在 ring buffer，订阅者通过独立有界队列接收 replay 和实时记录。客户端过慢时收到 `overflow` 后断开；连接每 15 秒收到 heartbeat。生产环境未提供管理员认证前不得启用。

## 质量与提交

```bash
just lint
just format-check
just typecheck
just test
just test-watch
just check
just build
just verify
just container-build
just stack-up
just launch-doctor
```

`just check` 是不构建产物的快速源码门禁；`just verify` 才包含 workspace build。测试只发现 `apps/*/tests` 与 `packages/*/tests` 下的 TypeScript 源码，忽略 `dist`，并由根 Vitest 配置统一运行一次。CI 执行 `just verify` 后再构建 `container/Dockerfile`。提交使用 Conventional Commits；仅纯文档提交使用 `[skip ci]`。不提交 `.env`、生成的 `dist` 或本地编辑器配置。
