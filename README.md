# full-stack-example

轻量化 TypeScript 模块化单体：React/Vite 前端、Hono RPC API、Drizzle/PostgreSQL、LogTape 与 OpenTelemetry Collector。

完整的开发指南、架构说明、模块文档和自动生成的 API Reference 位于 [Rspress 文档站](https://shawnden-coder.github.io/full-stack-example/)。本 README 是仓库快速入口；每个 workspace 的 README 是该模块的唯一文档来源。

## 模块结构

```text
.
├── apps/                         # 可独立运行的应用
│   ├── api/                      # Hono API 宿主：中间件、组合根、启动和生产静态资源托管
│   └── web/                      # React/Vite 单页应用：页面、路由、TanStack Query 数据访问
├── packages/                     # 可复用的领域与基础设施模块
│   ├── auth/                     # Better Auth Session、Organization、平台管理与租户鉴权
│   ├── database/                 # Drizzle schema、迁移和 PostgreSQL 连接
│   ├── logging/                  # LogTape 配置、脱敏日志与进程内 SSE 数据源
│   ├── system/                   # 系统健康检查的 schema、service 和 HTTP 路由
│   ├── todos/                    # Todo schema、Drizzle repository、service 和 HTTP 路由
│   └── jobs/                     # BullMQ PostgreSQL adapter、worker、migration 和 Bull Board
├── container/                    # 单镜像 Dockerfile、Compose 和 PostgreSQL 初始化
├── docs/                         # 架构指南、模块说明和 API reference
├── scripts/                      # 本地基础设施、迁移与开发子进程编排
├── biome.json                    # 全仓唯一的 lint 与格式化配置
├── justfile                      # 安装、开发、测试、迁移和容器命令入口
├── package.json                  # pnpm workspace 根依赖与工具版本
└── pnpm-workspace.yaml           # workspace 包发现范围与共享依赖 catalog
```

各 workspace 的模块说明维护在对应 README，并会在文档构建时同步到 Rspress：

- [API 应用](https://github.com/ShawnDen-coder/full-stack-example/blob/master/apps/api/README.md)
- [Web 应用](https://github.com/ShawnDen-coder/full-stack-example/blob/master/apps/web/README.md)
- [Auth](https://github.com/ShawnDen-coder/full-stack-example/blob/master/packages/auth/README.md)
- [Database](https://github.com/ShawnDen-coder/full-stack-example/blob/master/packages/database/README.md)
- [Logging](https://github.com/ShawnDen-coder/full-stack-example/blob/master/packages/logging/README.md)
- [Jobs](https://github.com/ShawnDen-coder/full-stack-example/blob/master/packages/jobs/README.md)
- [System](https://github.com/ShawnDen-coder/full-stack-example/blob/master/packages/system/README.md)
- [Todos](https://github.com/ShawnDen-coder/full-stack-example/blob/master/packages/todos/README.md)

`apps/api/src/app.ts` 是唯一的 HTTP 组合根。功能包通过 `setupXxxApp(app, options)` 注册路由并返回 Hono app，API 导出完整 `AppType`；System、Todos 等供 Web 使用的模块另外导出各自子路由类型，由 Web 按功能创建 Hono RPC client，避免每个消费点实例化整棵路由类型。

后台任务同样由应用组合根显式装配：业务模块通过 `defineJob()` 声明 schema 和处理器，Worker 按 BullMQ 的 `job.name` 分派，producer 使用任务定义对象入队以保持 payload 类型安全。开发时 `just dev` 会 watch Worker 代码。

## 扩充模块的结构

新增业务模块时，优先把可复用的领域能力放在 `packages/<module>/`，把运行时装配放在 `apps/api`，把页面交互放在 `apps/web`。一个完整模块通常按下面的边界组织：

```text
packages/<module>/
├── src/
│   ├── types.ts         # 模块配置和路由 Context Variables
│   ├── schemas.ts       # Zod 输入、输出和业务约束
│   ├── service.ts       # 不依赖 Hono 的领域用例
│   ├── repository.ts    # 可选：数据库持久化实现
│   ├── route.desc.ts    # 可选：纯 OpenAPI 描述配置
│   ├── route.handler.ts # 可选：createHandlers 组合校验、授权和 handler
│   ├── route.ts         # 可选：相对路径子应用和 setupXxxApp
│   └── index.ts         # 稳定的公开 exports
├── tests/               # 从调用者角度验证行为
├── package.json         # description、exports、typecheck/build
└── README.md            # 模块唯一说明来源，含快速开始与扩展约束
```

扩充时遵循 `route -> service -> repository -> database` 的依赖方向，schema 可由各层共享。复杂 HTTP 模块使用自己的 `createFactory().createHandlers()` 保留 validator 和 Context 类型，再由 `setupXxxApp()` 通过 `app.route()` 挂载；单端点模块保持紧凑。路由只做协议适配，service 不依赖 Hono，repository 负责 Drizzle 查询；不要让 Web 直接访问数据库，也不要创建第二个 Hono 宿主。

新模块的最小落地顺序是：先定义 schema 和 service 接口，再实现 repository 或外部适配器；随后增加 route 层并在组合根注册；最后导出公共符号、补测试、更新 README 和 `docs/content/modules/_meta.json`。README 会在文档构建时自动同步为模块主页，因此不要在 `docs/content/modules/` 维护第二份模块正文。

## 开始使用

```bash
just init
Copy-Item .env.example .env
just dev
```

`just dev` 会检查本机依赖，启动 PostgreSQL 和 OpenTelemetry Collector，执行数据库与 BullMQ migration、provision 初始管理员，再启动 API（`http://localhost:3000`）、Jobs Worker 与 Web（`http://localhost:5173`）。退出开发进程会保留基础设施和数据卷。

`.env.example` 提供本地初始运维账号 `admin@example.com` / `Admin123!`。独立的一次性 provision 命令幂等创建该账号或将同邮箱账号提升为 `platform-admin`，不会覆盖现有密码。API 和 Worker 不接收管理员初始化密码。

## 开发流程与热更新

从干净环境开始时依次执行：

```bash
just init
Copy-Item .env.example .env
just dev
```

开发服务由三个并行 watch 进程组成：

- API 使用 `tsx watch`。修改 API 或被 API 直接引用的共享 TypeScript 包后，进程会自动重启；这不是保留运行时状态的 HMR。
- Jobs Worker 使用 `tsx watch`。修改 Worker 入口或处理器后会自动重启。
- Web 使用 Vite。React 组件和样式支持 HMR，通常无需完整刷新浏览器；按功能拆分的 RPC client 直接引用 workspace 源码类型，修改服务端路由后会即时反馈类型错误。

API 重启会丢失进程内状态（包括 SSE 日志流和临时状态），但不会删除 PostgreSQL 数据。修改数据库 schema 或 migration 后需要显式执行：

```bash
just db-generate
just provision
```

基础设施已经运行且迁移和管理员已 provision 时，可使用 `just dev-only` 只启动宿主机进程。单独排查 API/Web/Worker 时使用对应的 `dev-api`、`dev-web` 和 `dev-worker`。修改 `.env`、依赖、Vite/TypeScript/Compose 配置后，请停止当前进程并重新运行 `just dev`。`just stack-up` 是本地/CI 的生产形态验证，不支持源码热更新；源码变化后需要重新构建镜像。

开发地址：Web `http://localhost:5173`，API `http://localhost:3000`，Health `http://localhost:3000/health`，Collector health `http://localhost:13133`。

按 `Ctrl+C` 停止宿主机 API、Worker 和 Web；基础设施默认继续运行。使用 `just infra-down` 停止基础设施并保留数据卷；只有明确要删除开发数据库时才运行带警告的 `just infra-reset`。

## 常用命令

```bash
just check
just verify
just container-build
just infra-up
just provision
just stack-up
just infra-down
just infra-reset
just otel-logs
```

`just check` 是日常快速反馈，只执行只读 lint、类型检查和源码测试，不要求预先构建；测试由根 Vitest 配置运行一次。
`just verify` 在此基础上构建全部 workspace，适合作为提交或发布前的完整质量门禁。

命令分层如下：

| 命令 | 用途 |
| --- | --- |
| `just dev` | 检查依赖、启动基础设施、迁移与管理员 provisioning，并启动 API、Worker、Web |
| `just dev-only` | 只启动宿主机开发进程，要求 `infra-up` 和 `provision` 已完成 |
| `just infra-up` | 启动 PostgreSQL 和 Collector，等待健康后执行完整 provisioning |
| `just provision` | 顺序执行 Drizzle migration、BullMQ migration 和管理员 provisioning |
| `just check` | lint、typecheck、源码测试，不构建 `dist` |
| `just test-watch` | Vitest 监听模式 |
| `just verify` | `check` 后构建全部 workspace |
| `just container-build` | 构建单一生产镜像 |
| `just stack-up` | 启动 PostgreSQL、Collector 和应用容器 |
| `just stack-down` | 停止完整容器栈 |

日常开发使用 `just dev`，提交前使用 `just check`，发布或容器验证使用 `just verify` 与 `just stack-up`。`just launch` 等旧命令保留为兼容别名。测试直接消费 TypeScript 源码，不依赖预先存在的 `dist`。

`container/Dockerfile` 会在干净环境中安装锁定依赖，只构建 API、Web 及其 workspace 依赖（不构建文档站），最终生成一个同时提供 API 和 Web 的 Node 镜像：

```bash
podman build --file container/Dockerfile --tag full-stack-example:local .
```

镜像内只有一个 Node 进程：Hono 在 3000 端口提供 API、React SPA 和静态资源，Web 生产请求使用 same-origin 调用 API，
无需 Nginx。容器运行时通过环境变量配置数据库、Web Origin 和 OTLP 地址。

完整生产形态容器栈（PostgreSQL、Collector、migrator、admin provision、API 和 Worker）使用 Compose 启动。API 与 Worker 只使用 `app_runtime`，统一 `migrate` 服务使用 `app_migrator`；管理员初始密码只传给一次性 `admin-provision` 服务。所有应用服务共用一个镜像：

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

Health 端点为 `GET /health`，响应带 `Cache-Control: no-store`。浏览器端通过 Hono 的 `hc` 客户端和 TanStack Query 调用该端点。开发环境可从 `GET /docs` 打开 Swagger UI，并由同源的 `GET /openapi.json` 提供 OpenAPI 3.1 规范；文档站的 HTTP Reference 使用同一份规范，不生成 Orval 客户端。

`API_DOCS_ENABLED` 可显式控制这两个端点：开发和测试默认开启，生产默认关闭；在生产环境设置 `API_DOCS_ENABLED=true` 才会公开 API 文档。Swagger 包含登录、注册、会话与工作区接口；Todo 操作需要同源 Better Auth Session Cookie 和当前工作区，先在 Swagger 调用登录接口后即可使用 Try it out。

## Todo 示例

首页保留 API 与数据库健康检查。用户先注册或登录，再创建或选择工作区后进入 Todo。Todo 页面支持新增、完成/取消完成；仅工作区 owner/admin 可删除，数据写入 PostgreSQL；生产环境则从同源地址的 `/todos` 访问。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/todos` | 返回按最新创建顺序排列的 Todo 列表。 |
| `POST` | `/api/todos` | 创建 Todo，JSON body 为 `{ "title": "..." }`。 |
| `PATCH` | `/api/todos/:id` | 更新完成状态，JSON body 为 `{ "completed": true }`。 |
| `DELETE` | `/api/todos/:id` | 永久删除一个 Todo。 |

Todo schema 变更后生成并执行迁移：

```bash
pnpm --filter @full-stack-example/database db:generate
pnpm --filter @full-stack-example/database db:migrate
```

## 日志与遥测

LogTape 在开发环境输出可读日志，生产输出脱敏 JSON Lines。设置 `LOG_FILE` 后，API 会追加经过同样脱敏处理的 JSON Lines 文件；开发默认写入 `logs/api.jsonl`，生产 Compose 写入命名卷挂载的 `/app/logs/api.jsonl`。Trace 和 metrics 经 OTLP 发往本地 Collector；当前不包含 Loki、OpenObserve、Tempo、Prometheus、Redis 或缓存。

实时日志 SSE 默认关闭。设置 `LOG_STREAM_ENABLED=true` 后注册 `GET /api/logs/stream`；该路由要求有效 Session、`platform-admin` 和 fresh session：

```bash
curl -N --cookie "<Better Auth session cookie>" http://localhost:3000/api/logs/stream
```

该流只保留当前 API 进程的有限内存记录，重启即丢失；它不是审计或长期日志存储。生产环境默认关闭，可显式开启，鉴权规则不变。Swagger 的 Try it out 会保持长连接。

## 计划状态与边界

项目采用 React/Vite 与 Hono API workspace、TanStack Router 文件路由和按功能拆分的 RPC clients、Better Auth Session/Organization、Drizzle/PostgreSQL RLS、BullMQ named jobs、LogTape 脱敏日志及 OpenTelemetry Collector。API 强制认证组合；数据库和 BullMQ migration 由独立 migrator 命令/Compose service 执行；生产使用 Hono 单进程托管 Web。Biome、统一 Vitest、workspace typecheck/build 与 CI 覆盖代码、PostgreSQL 集成和镜像验证。

当前明确不包含 Loki、OpenObserve、Tempo、Prometheus、Redis、缓存或日志持久化。SSE 是单进程、易失、非审计的实时诊断流。OpenAPI 描述公开 Health，并收录认证、工作区、平台管理、Todo 和启用后的日志流合同；受保护操作使用 Session Cookie，不生成 Orval 客户端。HonoX 调研结论是暂不引入 SSR、SSG 或 islands。

后续可按需求增加管理员日志页面、多实例日志聚合或持久化后端，并保持现有 SSE 事件协议兼容。
