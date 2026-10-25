# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

一个 TypeScript 全栈示例，提供需要登录的个人待办、用户资料，以及由独立 worker 进程执行的后台任务。

前端使用 React 和 TanStack Router；后端在 Node.js 上运行 Hono 和 oRPC，搭配 Better Auth、Drizzle/PostgreSQL 与 BullMQ/Redis。共享 UI 组件使用 shadcn/ui 和 Tailwind CSS。

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

本地数据库和 Compose 项目默认命名为 `full-stack-example`。项目改名时，也要同步修改已有 server／worker 配置值文件中的 `DATABASE_URL`，`env:init` 会保留这些文件。Compose 项目名或卷名变化会使用新的数据卷，因此切换前应单独迁移已有数据。

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

先阅读[架构图解](docs/development.zh-CN.md#架构导览)，了解运行连接、已认证请求和后台任务的流转。

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

Todo 重命名、新增后台任务及 DB／queue／observability／UI 的具体扩展步骤，见[模块扩展示例](docs/extension-examples.zh-CN.md)。

具名业务参数、任务入口、消费者注册和包依赖规则，见[扩展约定](docs/extension-design.zh-CN.md)。

提交变更前，执行 `pnpm install`、`pnpm test`、`pnpm check-types`、`pnpm build`、`pnpm check:boundaries` 和 `pnpm exec biome check .`。依赖变更应限定在实际使用它的包中；提交标题使用简洁的 Conventional Commits 格式。

## 版本管理

使用 [Cocogitto](https://docs.cocogitto.io/) 6.4.0 为整个 workspace 管理统一的应用版本，以 `X.Y.Z` Git tag 和根目录 `CHANGELOG.md` 为准。各包 manifest 中的版本不代表应用发布版本，内部包不单独发布。

首次提交前安装 CLI（需要 [Rust/Cargo](https://rustup.rs/)），再安装 workspace 依赖以启用 Husky：

```bash
cargo install cocogitto --version 6.4.0 --locked
pnpm install --frozen-lockfile
```

Husky 通过 `cog verify` 检查每条提交消息；CI 检查全部提交历史，忽略 merge commits。使用 Conventional Commits，例如 `fix(api): handle missing sessions`、`feat(todos): add filtering` 和 `feat(api)!: change the response contract`。`fix` 升 PATCH，`feat` 升 MINOR；1.0.0 之后的破坏性变更升 MAJOR。0.x 开发阶段的自动升版保持在 1.0.0 以下，确认 API 稳定时显式执行 `cog bump --version 1.0.0`。

CI 通过后，在干净且与远端同步的 `master` 分支执行：

```bash
pnpm release:preview
pnpm release
```

预览只输出下一版本，不修改文件或运行发布 hooks。正式升版会依次检查提交格式、lint、包边界、测试、类型和构建，生成／更新 `CHANGELOG.md`，并创建本地版本 commit 和 tag。首次自动发布会分析已有历史。这两个命令都不推送、不发布 npm 包，也不部署应用。审查结果后再一起推送 `master` 和新 tag，例如 `git push --atomic origin master 0.1.0`（将 tag 替换为实际生成的版本）。

## 验证

CI 会运行 Conventional Commit 检查、代码规范及包依赖检查、离线测试、类型检查、构建、真实服务集成测试、Playwright，以及独立的生产 Compose 冒烟测试。

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
