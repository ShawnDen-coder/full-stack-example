# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

一个 TypeScript 全栈示例，提供需要登录的个人待办、用户资料，以及由独立 worker 进程执行的后台任务。

项目最初由 [Better T Stack](https://github.com/AmanVarshney01/create-better-t-stack) 生成。前端使用 React 和 TanStack Router；后端在 Node.js 上运行 Hono 和 oRPC，搭配 Better Auth、Drizzle/PostgreSQL 与 BullMQ/Redis。共享 UI 组件使用 shadcn/ui 和 Tailwind CSS。

## 本地体验

完成配置后，打开 [localhost:3001](http://localhost:3001)，注册或登录，再进入 `/todos` 创建、完成和删除自己的任务。各账号的待办列表相互独立。

登录后的代码也可以通过类型安全的 oRPC 客户端读取用户资料并提交后台任务：

```ts
const profile = await client.users.me();
const job = await client.users.enqueueProfileRead();
const status = await client.users.getProfileReadJob({ id: job.id });
```

worker 会读取用户资料，返回 `id`、`name` 和 `emailVerified`。只有任务提交者可以查询该任务。轮询 `getProfileReadJob` 直到任务完成；结果仅保留一段时间。

## 安装与配置

使用 Node.js 24（见 `.node-version`）、pnpm 11.0.9 和 Docker Compose。以下命令均在仓库根目录执行。

```bash
pnpm install
```

初始化不会纳入 Git 的开发环境配置；已有文件会被保留：

```bash
pnpm env:init
```

该命令会为各应用创建 `.env` 文件，配置本地应用端口 3000/3001、PostgreSQL 端口 5432 和 Redis 端口 6379，并生成随机认证密钥。输出仅包含文件名。需要时可修改本地配置或通过进程环境变量覆盖；不要提交包含实际配置值的文件。应用配置定义见 `apps/server/.env.schema`、`apps/worker/.env.schema` 和 `apps/web/.env.schema`。

```bash
pnpm infra:up
pnpm db:migrate
pnpm dev
```

以上命令依次启动 PostgreSQL 和 Redis、应用数据库迁移，再启动前端、API 和 worker。API 地址为 [localhost:3000](http://localhost:3000)，接口文档位于 [/api-reference](http://localhost:3000/api-reference)，存活检查位于 [/health](http://localhost:3000/health)，依赖就绪检查位于 [/ready](http://localhost:3000/ready)。

### 数据库变更

仓库中的 SQL 迁移用于初始化空数据库，并记录每次数据库结构变更。执行 `pnpm db:generate`，审查并提交生成的 SQL 和快照，再运行 `pnpm db:migrate`。重复执行迁移是安全的。`pnpm db:push` 仅适合可随时丢弃的本地实验数据库，不用于发布。

初始迁移面向新数据库。对于此前通过 `db:push` 创建的数据库，需要单独审查并制定迁移基线接入方案；不要直接执行初始迁移，也不要在未比对结构时将其标记为已执行。为保持兼容，Todo 所属用户字段仍允许为空：没有所属用户的记录无法通过 API 访问，新建记录则始终绑定当前登录用户。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:web`, `pnpm dev:server`, `pnpm dev:worker` | 单独启动某个应用 |
| `pnpm test` | 运行离线 API、worker 和发布保护测试 |
| `pnpm test:integration` | 使用真实 PostgreSQL/Redis 验证认证、迁移和进程行为 |
| `pnpm test:e2e` | 通过 Playwright 验证账号隔离和增删改查场景 |
| `pnpm check-types` | 生成路由类型并检查工作区类型 |
| `pnpm build` | 构建应用 |
| `pnpm check:boundaries` | 检查包依赖和公共导出边界 |
| `pnpm exec biome check .` | 只读检查代码规范和格式 |
| `pnpm check` | 应用 Biome 自动修复 |
| `pnpm db:studio` | 查看数据库 |
| `pnpm db:generate`, `pnpm db:migrate` | 生成和执行 SQL 迁移 |
| `pnpm env:generate` | 修改环境配置定义后重新生成类型 |
| `pnpm infra:down` | 停止本地 PostgreSQL 和 Redis |

## 生产部署

支持的基线是单机 Docker Compose，前面配置 HTTPS 反向代理。通过进程环境或忽略的 `deploy/.env` 提供 `deploy/.env.schema` 中的值：`PUBLIC_APP_URL`、`BETTER_AUTH_SECRET`、`POSTGRES_PASSWORD` 和三个指向 `postgres:5432/app` 的数据库 URL：

- `MIGRATION_DATABASE_URL`：`postgres` schema owner，密码与 `POSTGRES_PASSWORD` 一致，仅供部署任务使用。
- `DATABASE_URL`：`app_server`，使用独立运行密码。
- `WORKER_DATABASE_URL`：`app_worker`，使用独立运行密码。

密码需 URL 编码，生产密码没有默认值。部署依次执行 migration、运行角色配置、Server/Worker 更新和 Web 更新。Server 仅获得业务表读写权限，Worker 仅读取用户资料；运行角色没有 DDL 权限。已有数据卷会在角色配置步骤中创建或更新这两个账号。

```bash
pnpm docker:up
pnpm docker:logs
# 停止容器，保留数据卷：
pnpm docker:down
```

部署命令会构建镜像，等待 PostgreSQL 和 Redis 就绪，执行一次新的迁移任务，再依次更新 API/worker 和前端。迁移失败会在替换现有应用容器之前停止发布。就绪检查失败会阻止后续部署步骤，但不会自动回滚应用。升级时应采用向后兼容的增量迁移。

将外部 TLS 代理指向 `127.0.0.1:8080`，可通过 `WEB_PORT` 修改端口。Nginx 提供 SPA 静态文件，并将认证、RPC 和接口文档路径代理到后端。生产环境不向宿主机发布 API、数据库或 Redis 端口。前端请求地址在构建时写入产物，修改后需要重新构建前端。

迁移、备份、恢复、日志和验证流程见[开发与运维指南](docs/development.zh-CN.md)。

## 开发

| 路径 | 职责 | 扩展指引 |
| --- | --- | --- |
| `apps/web` | React 前端和文件路由 | [应用接线](docs/development.zh-CN.md#应用扩展入口) |
| `apps/server` | Hono API 进程，负责生产队列任务 | [应用接线](docs/development.zh-CN.md#应用扩展入口) |
| `apps/worker` | 独立 BullMQ 消费者及其生命周期管理 | [应用接线](docs/development.zh-CN.md#应用扩展入口) |
| `packages/api` | HTTP／认证边界和 oRPC 过程 | [API](packages/api/README.zh-CN.md) |
| `packages/business` | 业务服务、Scoped Repository 和所属业务的任务 | [业务](packages/business/README.zh-CN.md) |
| `packages/db` | 数据库工厂、表结构、迁移和运行角色授权 | [数据库](packages/db/README.zh-CN.md) |
| `packages/queue` | 通用 BullMQ 连接和 telemetry 适配器 | [队列](packages/queue/README.zh-CN.md) |
| `packages/observability` | 结构化日志、trace、指标和超时控制 | [可观测性](packages/observability/README.zh-CN.md) |
| `packages/ui` | 共享组件和样式 | [UI](packages/ui/README.zh-CN.md) |

[开发指南](docs/development.zh-CN.md) 说明应用接线和运维流程；各包指引列出代码入口、扩展步骤、职责边界和验证命令。共享 TypeScript 配置位于根目录 `tsconfig.base.json`。当前技术栈以各包清单和应用配置为准，命令定义见 [package.json](package.json)。

具名业务参数、任务入口、消费者注册和包依赖规则，见[扩展约定](docs/extension-design.zh-CN.md)。

提交变更前，执行 `pnpm install`、`pnpm test`、`pnpm check-types`、`pnpm build`、`pnpm check:boundaries` 和 `pnpm exec biome check .`。依赖变更应限定在实际使用它的包中；提交标题使用简洁的 Conventional Commits 格式。

## 验证

CI 会运行代码规范及包依赖检查、离线测试、类型检查、构建、真实服务集成测试、Playwright，以及独立的生产 Compose 冒烟测试。

运行集成测试或浏览器测试前，将 `TEST_DATABASE_URL` 和 `TEST_REDIS_URL` 指向**专用、可随时丢弃的测试服务**，然后执行：

```bash
pnpm test:integration
pnpm --filter web exec playwright install chromium
pnpm test:e2e
```

集成测试会执行仓库中的迁移、创建临时账号，并验证数据库故障、worker 重试和进程退出。浏览器测试使用 43100/43101 端口，会在测试数据库中留下测试账号。不要将这些命令指向需要保留数据的开发数据库或生产服务。

## 可观测性

Pino 输出结构化 JSON，自动关联 `trace_id`/`span_id`，并携带 request/job ID。设置 `OTEL_ENABLED=true` 后通过 OTLP/HTTP 导出 traces 和 metrics，默认关闭。`pnpm telemetry:up` 启动可选本地 Collector，Prometheus 指标端点为 `127.0.0.1:8889`。详见[可观测性运维指南](docs/observability.zh-CN.md)。

`/health` 检查进程存活，`/ready` 检查核心数据库，`/ready/jobs` 单独检查队列。Redis 故障时仍可启动 API 并使用认证和 Todo；任务操作返回 `SERVICE_UNAVAILABLE`。Worker 容器通过消费循环、数据库和 Redis 探测更新本地心跳，Compose 等待其健康后才继续发布。

权限集成测试还会配置固定的 app_server/app_worker 角色和 public schema 授权，因此测试 PostgreSQL 实例必须专用。
