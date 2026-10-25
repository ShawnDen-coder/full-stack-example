# 开发指南

[English](development.md) · [简体中文](development.zh-CN.md)

[返回 README](../README.zh-CN.md)

## UI 定制

本项目的 React 前端通过 `packages/ui` 共享 shadcn/ui 基础组件。

- 在 `packages/ui/src/styles/globals.css` 修改设计变量和全局样式。
- 在 `packages/ui/src/components/*` 修改共享基础组件。
- 在 `packages/ui/components.json` 和 `apps/web/components.json` 调整 shadcn 别名或样式配置。

### 添加共享组件

在项目根目录执行以下命令，将更多基础组件加入共享 UI 包：

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

按以下方式导入共享组件：

```tsx
import { Button } from "@my-better-t-app/ui/components/button";
```

### 添加应用专用区块

如果要添加仅供当前应用使用的区块，而不是共享基础组件，请在 `apps/web` 中运行 shadcn CLI。

## 环境配置

各应用通过自己的 `.env.schema` 定义环境配置。安装依赖时，Varlock 会生成 `src/env.ts`；修改配置定义后，运行 `pnpm run env:generate`。提交配置定义文件，将密钥保存在被 Git 忽略的环境文件中，或交由部署平台管理。

应用代码通过生成的 `ENV` 对象读取配置。共享数据库和认证包由应用传入配置或已初始化的客户端。详情见 [Varlock monorepo 指南](https://varlock.dev/guides/monorepos/)。

Vite 集成和 Node 服务启动入口会加载 Varlock。Node 部署产物包含应用配置定义、Varlock 及其依赖。

使用 Varlock 的独立 Node 工具应从所属应用的目录运行，以加载该应用的配置定义和环境文件。`env:generate` 只生成 TypeScript 文件，不会为后续命令初始化环境变量值。

## 生成 Better Auth 表结构

修改认证插件或表结构相关选项后，在项目根目录运行 `pnpm run auth:generate`。该脚本会进入所属应用目录，通过 `varlock run` 执行 Better Auth CLI，并从 `src/auth-schema.ts` 加载认证实例。审查生成的表结构变更，再通过 ORM 的迁移流程应用到数据库。

## 应用组装

应用采用 [claude-vps](https://github.com/grmkris/claude-vps/tree/d972236) 中的显式工厂和依赖注入模式：

- `apps/server/src/index.ts` 负责进程启动和退出，创建 API 运行时并启动 Hono HTTP 服务，不启动队列消费者。
- `apps/worker/src/index.ts` 启动独立 Node.js 消费进程；`apps/worker/src/runtime.ts` 创建该进程的数据库和用户服务，检查依赖就绪后启动用户资料 worker。
- `apps/server/src/services.ts` 为每个进程创建一组数据库、Better Auth、队列客户端、用户服务和 Todo 服务。仅导入模块不会建立连接或启动 worker。
- `packages/api/src/create-api.ts` 导出 `createApi(...)`，接收已初始化的依赖。它将 Better Auth 挂载到 `/api/auth/*`，oRPC 挂载到 `/rpc`，OpenAPI 挂载到 `/api-reference`，并提供 `/health` 存活检查和 `/ready` 依赖就绪检查。存活检查和未匹配的 URL 不会解析会话。
- `packages/api/src/context.ts` 解析请求会话，并向过程提供服务。`protectedProcedure` 在调用业务服务之前要求用户完成认证。
- `packages/business/src/users` 通过注入的数据库读取用户资料，`packages/business/src/todos` 提供 Todo 服务；两者的 HTTP 路由都调用注入的服务。`packages/business/src/users/jobs` 管理任务契约、生产者配置、保留策略、重试和归属检查，`packages/queue` 仅负责通用连接和 BullMQ telemetry。worker 工厂位于 `packages/business/src/users/jobs`，与 HTTP 请求复用同一套服务工厂，但各进程分别创建自己的实例和连接。

Todo API 要求登录，每项操作都限定在当前会话用户的数据范围内。users API 同样要求登录，始终从会话中取得用户 ID，不提供用户列表或任意用户查询接口。

登录后的客户端可通过现有的类型安全 oRPC 客户端验证完整的服务与队列调用链路：

```ts
const profile = await client.users.me();
const job = await client.users.enqueueProfileRead();
const status = await client.users.getProfileReadJob({ id: job.id });
```

示例后台任务读取当前用户资料，只返回 `id`、`name` 和 `emailVerified`。调用者只能查看自己的任务；任务不存在或属于其他用户时，均返回 `NOT_FOUND`。完成结果保留一小时，超过 1,000 条时可能提前清理；失败任务最多保留一天，上限同样为 1,000 条。清理在后续任务结束时触发。

`REDIS_URL` 定义在 `apps/server/.env.schema` 中，本机开发默认使用 `redis://localhost:6379`。Docker Compose 将其覆盖为 `redis://redis:6379`，启用 Redis 持久化和 `noeviction` 策略，API 等待 PostgreSQL，Worker 同时等待 PostgreSQL 和 Redis。Redis 凭据应保存在被 Git 忽略的本地环境配置中，或由部署环境的密钥管理服务提供。

Better Auth 接收显式传入的数据库和配置对象。Cookie 安全属性遵循 Better Auth 根据 URL 和运行环境确定的默认值，因此本地 HTTP 开发不需要强制使用跨站 Secure Cookie。生产环境应使用 HTTPS。认证表结构生成入口只初始化数据库和认证实例，不启动队列、worker 或 HTTP 服务。

收到 `SIGINT` 或 `SIGTERM` 后，API 停止接收新请求，再关闭队列连接和 PostgreSQL 连接池。独立 worker 停止领取任务，等待正在执行的任务结束，然后关闭自己的 PostgreSQL 连接池。worker 的 Redis 请求允许无限重试，HTTP 生产者的请求重试次数则有上限。可选的 `msgpackr-extract` 原生构建已禁用，运行时使用其 JavaScript 实现。

新增模块时，先导出服务工厂，在 `createServices` 中实例化，将具体服务类型加入 `Services`，再在 `packages/api/src/routers/index.ts` 挂载 oRPC 路由。新增后台任务时，定义类型化任务契约，并在所属业务包中提供 worker 工厂，最后在 worker 运行时中显式注册并负责关闭它。

## 独立 worker

API 请求将任务写入 Redis，`apps/worker` 使用共享的队列名、任务名和 Zod 载荷定义消费任务。worker 直接调用用户服务，不经过 HTTP 或浏览器会话。worker 包不依赖 API 或认证包。仅导入其运行时或用户资料 worker 工厂，不会建立连接或开始消费。

本地开发时，在被 Git 忽略的 `apps/worker/.env` 中设置 worker 的 `DATABASE_URL`，也可通过进程环境变量提供。worker 应与 API 使用相同的数据库和 Redis。它拥有独立的 `.env.schema`，不需要 Better Auth 密钥。然后运行：

```bash
pnpm infra:up
pnpm db:migrate
pnpm dev
```

`pnpm dev` 通过 pnpm workspace 同时启动前端、API 和 worker。需要单独重启或调试消费者时，使用 `pnpm dev:worker`。生产环境通过 `pnpm start:worker` 运行已构建的入口；Docker Compose 提供独立的 `worker` 服务，使用自己的镜像，不向宿主机发布 HTTP 端口。

运行时先检查 PostgreSQL，再以 `autorun: false` 创建 worker，等待 Redis 就绪后开始消费。`WORKER_STARTUP_TIMEOUT_MS` 默认 10,000 毫秒，分别限制各个就绪阶段的等待时间。就绪前发生失败时，会关闭尚未运行的 worker 和数据库连接，并以失败状态退出。启动过程不会创建或重置任何调度配置。

`WORKER_CONCURRENCY` 默认为 5，允许 1–100 的整数。退出操作是幂等的，会等待活动任务结束后再关闭数据库。`WORKER_SHUTDOWN_TIMEOUT_MS` 默认 30,000 毫秒；超时后进程以失败状态退出，由 BullMQ 恢复停滞任务。Compose 为容器预留 40 秒退出时间；任务耗时较长时，应同时提高这两个值。重试或进程故障可能导致同一任务再次执行，因此业务处理函数必须能承受重复执行。示例任务只读取数据。

当前实现覆盖了所参考调度方案中的进程与生命周期管理部分。调度配置、持久化、暂停与恢复，以及调度器状态协调属于独立的应用功能，此处尚未实现。

HTTP 应用使用 Hono 和 oRPC Fetch 适配器。Better Auth 直接通过自己的 Fetch handler 挂载。`createApi()` 返回可安全导入、不会自行启动服务的 Hono 应用，`apps/server` 通过 `@hono/node-server` 启动它。Hono 处理路由、CORS、请求日志和 HTTP 错误，oRPC 管理业务过程。CORS 覆盖认证、RPC、文档和健康检查路径，包括预检请求。运行环境仍为 Node.js 和 pnpm，没有使用 Bun 配置或脚本。

## 完整模块示例

以 `packages/business/src/todos` 作为增删改查模块的参考。其工厂接收数据库，`createServices` 将服务注入 `context.services`。路由负责校验输入，对不存在和属于其他用户的资源统一返回 `NOT_FOUND`。不要接受浏览器传入的资源所属用户 ID。

`repository.ts` 负责 SQL、字段投影和用户范围：`createTodosRepository(db).forUser(session.user.id)` 返回的操作始终按该用户过滤，创建时也固定填入该用户 ID。方法返回执行结果，不暴露可修改的查询构造器。每个 scope 使用独立闭包，共享 repository 不存储可变的当前用户。`service.ts` 保留分页、业务判断和原有操作级 span、指标。Repository 工厂可接收数据库或事务，不负责创建和关闭连接。归属规则重复时再引入 scoped repository，简单模块无需额外层次，也不引入通用基类。这是应用层约束，直接使用原始数据库仍然可以绕过。

`todo.list({ cursor?, limit? })` 返回 `{ items, nextCursor }`，按 ID 降序排列。每页默认 20 条，最多 100 条；游标为上一页最后一条记录的 ID。文本会去除首尾空白，长度限制为 1–500 个字符。创建和切换完成状态操作返回 `{ id, text, completed }`，删除操作返回 `{ id }`。旧的 `todo.getAll` 接口已移除。引入新的查询方式时，应同时增加相应索引和经过审查的迁移，并使用 PostgreSQL 验证。

需要登录的页面放在 `_auth` 布局下，查询键包含当前用户 ID。身份发生变化时，会话边界组件会取消并清除查询缓存，使路由上下文失效；来自旧身份的延迟 RPC 响应会被拒绝。收到 `UNAUTHORIZED` 响应后，清除私有状态并跳转到登录页，返回地址仅接受经过校验的相对路径。写操作统一显示错误通知，页面可通过自己的 `onError` 覆盖。不要自动重试写操作。

## 运行时与日志

API 和 worker 各自管理客户端及退出流程。API 在 PostgreSQL 就绪后监听端口；队列可用性由 `/ready/jobs` 单独检查。`/health` 表示进程能够响应，`/ready` 在两秒内检查数据库，在退出排空阶段或依赖故障时返回 503。就绪检查不会解析会话。它用于探测依赖状态，不能代替迁移校验或队列积压监控。

API 默认启动超时为 10 秒，退出超时为 30 秒；Compose 为 API 和 worker 预留 40 秒。按进程配置 `DB_POOL_MAX`，默认值为 10；通过 `DB_QUERY_TIMEOUT_MS` 同时限制客户端查询等待时间和数据库语句执行时间，默认 10 秒。部署多个副本时，应统筹计算数据库连接总数。worker 的启动与退出超时独立于查询超时。

Pino 将 JSON 日志输出到 stdout，包含 `service`、请求 ID、耗时和状态码。HTTP 响应通过 `X-Request-ID` 返回请求 ID，队列任务会携带该 ID，并在完成或失败时记录任务 ID。数据库和 Redis 驱动异常仅序列化经过脱敏的消息和堆栈。不要记录请求体、认证头、会话对象、完整配置对象或 SQL 绑定参数。将日志接入部署平台的采集系统，对持续出现的 503、任务失败和不断增长的队列延迟设置告警。

## 生产升级与恢复

通过 Varlock 加载 `deploy/.env.schema` 中定义的生产配置。`pnpm docker:up` 会在替换应用容器前执行一次新的迁移任务。API 更新后会重新创建前端容器，让 Nginx 重新解析当前上游地址。生产 Node 镜像以 `node` 用户运行，只携带构建后的应用代码和生产依赖。本地配置值文件不会复制到镜像层中。

发布涉及数据库结构的变更前，使用部署环境管理的凭据执行 `pg_dump -Fc`，创建 PostgreSQL 逻辑备份，并存放在宿主机之外。通过 `pg_restore` 将备份恢复到新的空数据库，验证恢复流程。为队列任务保留 Redis AOF 数据卷，并确保处理函数能承受重复执行。仅保存在同一台机器上的备份，或从未验证过的恢复流程，都不足以支持可靠恢复。

回滚应用时，只有此前验证过的镜像版本仍兼容当前数据库结构，才能重新部署它。系统不会自动执行破坏性的反向迁移。恢复数据库时，先停止生产者和消费者，将备份恢复到新数据库，检查表结构和数据归属，再让服务连接该数据库。在恢复消费者之前，核对并处理队列中的任务。不要在生产升级过程中执行 `docker compose down -v`。

## 质量检查

GitHub Actions 使用 Node 24、pnpm 11.0.9 和已提交的锁文件进行验证。离线测试覆盖 HTTP 边界、就绪检查、日志脱敏和 worker 生命周期。集成测试使用真实 PostgreSQL/Redis、已提交的迁移和 Better Auth，并验证任务重试、连接中断和 SIGTERM 退出。Playwright 覆盖账号切换（包括延迟响应）、写入失败和会话过期。生产冒烟测试验证构建后的 Nginx/API/worker 整体链路、Secure Cookie 和 SPA 深层路由。发布保护测试确保迁移失败后不会继续替换应用容器。

Husky/lint-staged 只处理暂存文件；以 CI 结果作为最终依据，本地钩子不能替代 CI。保持 `.node-version`、Node 类型定义和 Docker 运行时版本一致。依赖升级，尤其是 Drizzle RC 版本变更，必须通过完整验证流程，不要与无关功能变更混在一起。

## 本轮结构与运行边界

共享包收敛为 api、business、db、queue、observability、ui 六个。Auth 工厂位于 api，users/Todo 位于 business，TypeScript 共享配置移至根目录。推荐 API 名称为 `todo.setCompleted`、`users.enqueueProfileRead`、`users.getProfileReadJob`，旧名称保留为兼容别名。

生产使用三个独立 URL：schema owner 的 `MIGRATION_DATABASE_URL`、app_server 的 `DATABASE_URL`、app_worker 的 `WORKER_DATABASE_URL`。迁移后执行角色配置，成功后才更新应用。新增表时应审查 `packages/db/src/provision.ts` 的显式授权。迁移语句默认上限 300 秒，锁等待上限 5 秒，与请求查询超时独立。遗留 Todo 数据不自动分配归属或删除。

核心 `/ready` 只检查数据库，队列能力由 `/ready/jobs` 检查，Worker 容器另有健康心跳。类型检查单独生成路由，不再执行 Vite build。参见[可观测性运维指南](observability.zh-CN.md)。
