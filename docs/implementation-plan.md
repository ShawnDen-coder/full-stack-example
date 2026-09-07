# 轻量化 TypeScript 全栈模板实施计划

## 1. 建设目标

将当前仅含 `packages/core` 的 pnpm workspace 改造成可运行的轻量模块化单体：

```text
前端          React + Vite
路由          React Router
服务端状态    TanStack Query
样式          Tailwind CSS v4 + daisyUI
主题          固定 forest 暗色主题
HTTP/RPC       Hono + Hono Client (`hc`)
校验          Zod + @hono/zod-validator
客户端状态    TanStack Query（封装 Hono RPC 调用）
数据访问      Drizzle ORM + postgres.js
数据库        PostgreSQL
日志          Pino（生产 JSON、开发 pretty）
工程工具      pnpm + 根级 Biome
测试          Vitest
本地服务      Podman + Podman Compose
命令入口      justfile
```

首版通过一个无虚构业务含义的 System 模块贯通：

```text
React
→ TanStack Query Hook
→ Hono RPC Client (`hc`)
→ GET /health
→ Hono System Module
→ Drizzle SELECT 1
→ PostgreSQL
```

首版不包含：

- BullMQ、Redis 和 Worker；
- 通用 Module Registry、Capability、Lifecycle；
- oasdiff；
- Todo、Customers、Orders 等示例业务；
- 独立 UI 组件库；
- 多主题切换；
- repo-scaffold 成员生成命令；
- 强制 Ports/Adapters 分层。

## 2. 最终目录

业务模块直接位于 `packages/<module-name>`，不再增加 `packages/modules/` 中间层。

```text
full-stack-example/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ config.ts
│  │  │  ├─ middleware.ts
│  │  │  ├─ modules.ts
│  │  │  ├─ app.ts
│  │  │  ├─ bootstrap.ts
│  │  │  └─ server.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ web/
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ providers.tsx
│     │  │  └─ router.tsx
│     │  ├─ routes/
│     │  │  └─ home.tsx
│     │  ├─ styles/
│     │  │  └─ index.css
│     │  └─ main.tsx
│     ├─ index.html
│     ├─ vite.config.ts
│     ├─ package.json
│     └─ tsconfig.json
│
├─ packages/
│  ├─ api-client/
│  │  ├─ src/
│  │  │  ├─ client.ts
│  │  │  ├─ errors.ts
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ database/
│  │  ├─ migrations/
│  │  ├─ src/
│  │  │  ├─ schema/
│  │  │  │  └─ index.ts
│  │  │  ├─ client.ts
│  │  │  ├─ health.ts
│  │  │  └─ index.ts
│  │  ├─ drizzle.config.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ logging/
│  │  ├─ src/
│  │  │  ├─ logger.ts
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ system/
│     ├─ src/
│     │  ├─ schemas.ts
│     │  ├─ service.ts
│     │  ├─ routes.ts
│     │  └─ index.ts
│     ├─ tests/
│     ├─ package.json
│     └─ tsconfig.json
│
├─ container/
│  └─ compose.yaml
├─ scripts/
│  └─ launch.ts
├─ docs/
│  └─ implementation-plan.md
├─ .env.example
├─ .gitignore
├─ biome.json
├─ justfile
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
└─ tsconfig.base.json
```

Workspace 只需要两层匹配：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

包名统一为：

```text
@full-stack-example/api
@full-stack-example/web
@full-stack-example/api-client
@full-stack-example/database
@full-stack-example/logging
@full-stack-example/system
```

删除：

```text
packages/core
.prettierrc.json
.prettierignore
.repo-scaffold.toml
```

`.repo-scaffold.toml` 一并删除，因为当前固定的 `repo-scaffold==1.0.0` 不存在，相关 `add-member` 命令无法执行。

## 3. 根工程配置

### 3.1 根 package.json

根包只负责声明 workspace 元数据和共享工程依赖；仓库级命令统一由 `justfile` 编排，避免在根 `package.json` 中维护一层同名转发脚本：

```json
{
  "name": "full-stack-example",
  "private": true,
  "packageManager": "pnpm@<locked-version>",
  "engines": {
    "node": ">=22"
  }
}
```

安装时使用相互兼容的稳定版本，并将最终解析版本写入 `pnpm-lock.yaml`。Biome、TypeScript、Vitest、`tsx` 和 `concurrently` 等通用工程工具放在根 `devDependencies`，各包不重复安装 Biome。各包只保留 `build`、`dev`、`start`、`typecheck`、`test` 和数据库工具等包自身生命周期命令。

### 3.2 根级 Biome

仓库只保留根 `biome.json`：

- 统一检查所有 apps、packages、JSON 和 CSS；
- 使用两个空格、双引号和自动整理 imports；
- 启用推荐 lint 规则；
- 启用 Tailwind CSS 指令解析；
- 忽略构建、覆盖率和代码生成内容。

忽略范围：

```text
**/dist/**
**/coverage/**
**/node_modules/**
packages/database/migrations/**
```

Migration 由 Drizzle Kit 管理，不参与格式化。

### 3.3 TypeScript

根 `tsconfig.base.json` 采用严格基线：

```text
target                    ES2022
module                    ESNext
moduleResolution          Bundler
strict                    true
noUncheckedIndexedAccess  true
exactOptionalPropertyTypes true
verbatimModuleSyntax      true
noUnusedLocals            true
noUnusedParameters        true
skipLibCheck              true
```

Web 子配置包含 DOM；Node 包不引入 DOM 类型。可复用包输出声明文件，应用交给 Vite 或服务端构建器输出。

## 4. justfile 命令

`justfile` 保持为薄入口；复杂启动逻辑统一交给 `scripts/launch.ts`，不在 Bash 和 PowerShell recipe 中各维护一套状态机：

```text
default              just --list
init                 pnpm install

launch               启动 PostgreSQL、等待就绪、迁移数据库，再启动 Web 和 API
launch-clean         与 launch 相同，但退出时停止 Compose 服务
dev                  concurrently 启动 API 与 Web 的包级 dev 命令
dev-web              pnpm --filter @full-stack-example/web dev
dev-api              pnpm --filter @full-stack-example/api dev

build                pnpm -r run build
typecheck            pnpm -r run typecheck
test                 pnpm -r --if-present run test
lint                 pnpm exec biome lint .
lint-fix             pnpm exec biome lint --write .
format               pnpm exec biome format --write .
format-check         pnpm exec biome format .
check                顺序调用 lint、format-check、typecheck、test、build

db-generate          pnpm --filter @full-stack-example/database db:generate
db-migrate           pnpm --filter @full-stack-example/database db:migrate
db-studio            pnpm --filter @full-stack-example/database db:studio
launch-doctor        只执行启动前置检查，不改变任何服务状态

infra-up             podman compose -f container/compose.yaml up -d
infra-down           podman compose -f container/compose.yaml down
infra-logs           podman compose -f container/compose.yaml logs -f postgres
```

`launch`、`launch-clean` 和 `launch-doctor` 分别调用根脚本的默认模式、`--stop-infra-on-exit` 模式和 `--doctor` 模式。`infra-down` 不携带 `--volumes`，避免意外删除数据库数据。

不再提供：

```text
add-member
add-lib
add-cli
add-package
plan-member
```

## 5. Database 包

使用：

```text
drizzle-orm
drizzle-kit
postgres
zod
```

环境变量：

```dotenv
DATABASE_URL=postgres://app:app@localhost:5432/app
```

公开接口：

```ts
interface DatabaseContext {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

function createDatabase(options: {
  readonly databaseUrl: string;
}): DatabaseContext;

function checkDatabase(db: Database): Promise<void>;

function migrateDatabase(options: {
  readonly databaseUrl: string;
  readonly migrationsFolder: string;
}): Promise<void>;
```

实现要求：

- 不创建模块级数据库单例；
- API 启动时显式创建连接；
- API 在监听端口前运行 `migrateDatabase`；
- 首次运行时由 Drizzle migrator 创建迁移记录并执行所有未应用 Migration；
- 后续启动重复运行 migrator，但只应用尚未执行的 Migration；
- 关闭进程时调用 `close()`；
- `checkDatabase` 通过 Drizzle 执行 `SELECT 1`；
- 外部环境变量先经 Zod 校验；
- 错误不得包含密码或完整连接字符串；
- 首版 Schema 入口为空，不创建业务表；
- Migration 保持全仓唯一时间线。

Database scripts：

```text
db:generate    drizzle-kit generate
db:migrate     drizzle-kit migrate
db:studio      drizzle-kit studio
```

### 5.1 Launch 的职责边界

本地统一入口为 `just launch`，其实现仅调用：

```bash
pnpm exec tsx scripts/launch.ts
```

根 `devDependency` 增加 `tsx`。`launch.ts` 使用 Node 标准库的 `child_process.spawn` 管理外部进程，不拼接 shell 字符串、不使用无限轮询，也不把数据库密码写入日志。

职责分为三层：

```text
justfile       稳定、易记的用户入口
launch.ts      本地基础设施与子进程状态机
API bootstrap  数据库迁移、资源创建、HTTP 生命周期
```

Launcher 不检查业务表是否存在，也不直接执行 SQL；数据库状态只由 Drizzle Migration 历史判断。

### 5.2 Launch 状态机

状态和转换固定为：

```text
PREFLIGHT
  → INFRA_STARTING
  → INFRA_READY
  → DATABASE_MIGRATING
  → APPLICATION_STARTING
  → RUNNING
  → STOPPING
  → EXITED
```

任何阶段失败都转入 `FAILED`，打印阶段名、失败命令和下一步诊断命令，并返回非零退出码。

#### PREFLIGHT

按顺序验证：

1. Node 版本满足根 `engines.node`；
2. `pnpm` 可执行；
3. `podman` 可执行且客户端版本不低于 5；
4. `podman info` 成功，证明 Podman Machine/connection 已启动且可访问；
5. `podman compose version` 成功，并记录实际 Compose provider；
6. `podman compose up --help` 包含 `--wait` 与 `--wait-timeout`；
7. `container/compose.yaml`、`.env` 或 `.env.example`、Migration 目录存在；
8. API 端口 `3000`、Web 端口 `5173` 和 PostgreSQL 端口 `5432` 未被非本项目进程占用。

当前环境已确认使用 Podman Client 5.5.1、Server 5.5.2 和 WSL2 Podman Machine。`podman compose` 委托给 Compose v2.38.2，并支持 `--wait` 和 `--wait-timeout`。Launcher 不要求安装或运行 Docker Engine。`just launch-doctor` 只执行上述检查，不启动容器。

Windows 上如果 `podman info` 失败，Launcher 输出 `podman machine list` 和 `podman system connection list` 的结果，并提示执行 `podman machine start`；它不会擅自创建、删除或重置 Podman Machine。若 Machine 不存在，必须由用户显式运行 `podman machine init`。

环境加载优先级固定为：进程环境变量高于根 `.env`，根 `.env` 不存在时使用 `.env.example` 的开发默认值。日志只输出变量名、Host 和 Port，不输出 `DATABASE_URL` 的认证部分。

#### INFRA_STARTING 与 INFRA_READY

Launcher 执行：

```bash
podman compose --project-name full-stack-example \
  --env-file <resolved-env-file> \
  -f container/compose.yaml \
  up -d --wait --wait-timeout 60 postgres
```

行为约束：

- Compose 项目名通过 `--project-name full-stack-example` 固定，防止目录改名产生新项目；
- 所有 Compose 操作都通过 `podman compose` 发起，不直接调用其外部 provider；
- PostgreSQL healthcheck 使用 `pg_isready`；
- `--wait` 成功是进入下一阶段的唯一条件；
- 超时或 unhealthy 时打印 `podman compose ps`、`podman ps -a` 和 PostgreSQL 最后 100 行日志；
- 失败时保留容器和 volume 供排障，不自动删除数据；
- 已运行且 healthy 的 PostgreSQL 由 Compose 幂等复用。

#### DATABASE_MIGRATING

基础设施 ready 后，Launcher 显式运行：

```bash
pnpm --filter @full-stack-example/database db:migrate
```

同时，API bootstrap 在每次直接启动时也调用同一个 `migrateDatabase()`，确保 `just dev-api`、生产 `start` 或其他入口不会绕过迁移。重复调用必须幂等。

迁移规则：

- 首次启动创建 Drizzle Migration 记录并执行全部未应用 SQL；
- 后续启动只执行未记录的 Migration；
- 使用专用 `postgres.js` 连接，`max: 1`；
- 迁移前获取固定 PostgreSQL advisory lock；
- 获取锁最多等待 30 秒，避免多个 API 实例并发迁移；
- Migration 成功或失败都在 `finally` 中释放连接；
- Migration 失败时不启动 Web/API，不自动回滚、删库或重建 volume；
- 日志记录 Migration 阶段和文件名，不记录 SQL 参数和连接凭据。

Migration 目录由 Database 包内部基于 `import.meta.url` 解析，不依赖当前工作目录。源码运行和构建产物都必须解析到 `packages/database/migrations`。

#### APPLICATION_STARTING 与 RUNNING

Migration 成功后 Launcher 使用根依赖中的 `concurrently` 管理两个明确命名的包级进程：

```text
api  → pnpm --filter @full-stack-example/api dev
web  → pnpm --filter @full-stack-example/web dev
```

配置要求：

- 日志前缀分别为 `api`、`web`；
- 任一进程异常退出时终止另一个进程；
- API 必须在 Migration 完成后才监听 `3000`；
- Vite 监听 `5173`；
- Launcher 收到 SIGINT/SIGTERM 后只转发一次终止信号；
- 等待子进程退出，超过 10 秒才强制结束；
- 正常 Ctrl+C 返回退出码 `0`，子进程失败返回其非零退出码。

默认 `just launch` 在退出时保留 PostgreSQL 运行，以缩短再次启动时间。`just launch-clean` 在应用退出后额外执行 Compose `down`，但同样不删除 volume。

### 5.3 API bootstrap

API 的 `bootstrap.ts` 固定执行：

```text
解析并校验环境变量
→ migrateDatabase
→ createDatabase
→ createApp/registerModules
→ listen
→ 注册 SIGINT/SIGTERM
```

错误处理：

- Migration 失败：不创建长期连接，不监听端口，退出 `1`；
- App 创建失败：关闭数据库连接，退出 `1`；
- Listen 失败：关闭数据库连接，退出 `1`；
- 正常终止：先停止接受新请求，再关闭数据库连接；
- 关闭超过 10 秒：记录错误并强制退出 `1`。

API 包提供：

```text
dev       watch 模式启动 bootstrap
start     从构建产物启动同一 bootstrap
```

`db:migrate` 仍保留给 CI、排障和显式运维使用；正常启动不要求开发者手工执行。

## 6. Pino 日志规划

### 6.1 包边界与依赖

`packages/logging` 是一个很薄的 Node 日志包，只统一 Pino 初始化、字段、脱敏和开发 transport，不建设完整 Observability 平台。

依赖：

```text
pino          runtime dependency
pino-pretty   root development dependency
```

公开接口：

```ts
import type { Logger } from "pino";

interface CreateLoggerOptions {
  readonly service: string;
  readonly environment: "development" | "test" | "production";
  readonly level: string;
  readonly version?: string;
  readonly pretty: boolean;
}

function createLogger(options: CreateLoggerOptions): Logger;
```

不包装 `debug/info/warn/error` 方法，也不创建自定义日志框架；调用方直接使用 Pino `Logger`。API、Database migrator 和 Launcher 分别创建带固定绑定的 child logger：

```ts
const apiLogger = rootLogger.child({ component: "http" });
const dbLogger = rootLogger.child({ component: "database" });
const launchLogger = rootLogger.child({ component: "launcher" });
```

Child logger 的绑定只允许应用定义的固定字段，禁止将请求体或用户对象直接展开到顶层。

### 6.2 环境与输出

新增环境变量：

```dotenv
NODE_ENV=development
LOG_LEVEL=debug
LOG_PRETTY=true
```

行为固定为：

| 环境 | 默认级别 | 输出 |
|---|---:|---|
| development | `debug` | `pino-pretty` 彩色单行终端日志 |
| test | `silent` | 默认静默，单测显式注入目标 stream |
| production | `info` | stdout，一行一个 JSON，不使用 pretty transport |

`LOG_LEVEL` 可以覆盖默认级别，但必须由 Zod 限制为 `trace/debug/info/warn/error/fatal/silent`。`LOG_PRETTY` 只允许在非 production 环境生效；生产即使误配为 true 也保持 JSON。

服务根字段：

```text
service       api | launcher | database
component     http | bootstrap | migration | system | podman
environment   development | test | production
version       package/app version（可用时）
```

保留 Pino 标准字段 `level`、`time`、`pid`、`hostname` 和 `msg`，不覆盖它们。

### 6.3 事件字段规范

每条关键日志增加稳定的 `event` 字段，消息文本用于人读，`event` 用于过滤：

```text
launch.preflight.started
launch.preflight.failed
launch.infrastructure.ready
database.migration.started
database.migration.applied
database.migration.failed
api.started
api.shutdown.started
api.shutdown.completed
http.request.completed
http.request.failed
```

HTTP 完成日志字段：

```ts
interface HttpLogFields {
  readonly event: "http.request.completed" | "http.request.failed";
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly remoteAddress?: string;
  readonly userAgent?: string;
}
```

请求日志规则：

- 请求开始时创建 `logger.child({ requestId })`，并放入 Hono Context；
- 使用 Hono 内置 `requestId()`；接受其允许的安全字符并限制长度为 128，非法值使用 `crypto.randomUUID()`；
- 响应始终返回最终 `X-Request-ID`；
- 2xx/3xx 记录 `info`，4xx 记录 `warn`，5xx 或未捕获异常记录 `error`；
- `/health` 成功请求降为 `debug`，失败仍记录 `warn/error`；
- 默认不记录 query value、请求体、响应体或完整 headers；
- Route、Service 和 Database 调用复用同一个 request child logger。

### 6.4 错误序列化和敏感信息

错误统一写为：

```ts
logger.error({ err, event: "http.request.failed", requestId }, "Request failed");
```

使用 Pino 标准 Error serializer，保留错误类型、消息和 stack。预期内的 4xx 不输出 stack；未预期的 5xx 输出 stack，但 HTTP 响应不返回内部错误。

Pino `redact` 至少覆盖：

```text
authorization
cookie
set-cookie
password
token
accessToken
refreshToken
apiKey
secret
databaseUrl
req.headers.authorization
req.headers.cookie
res.headers.set-cookie
```

匹配项使用 `[Redacted]` 替换，不使用 `remove`，便于确认字段存在但内容已隐藏。任何包含 URL 的诊断信息在记录前先移除用户名和密码。禁止记录 `.env`、完整进程环境、SQL 参数、Health 异常详情和 RPC 请求载荷。

### 6.5 Launch 与关闭日志

`scripts/launch.ts` 也使用 `@full-stack-example/logging`，每次状态转换记录：

```text
event
phase
elapsedMs
command（仅可执行文件与安全参数）
exitCode（命令结束时）
```

Podman 和子进程的 stdout/stderr 保持原样转发并带 `podman`、`api`、`web` 前缀，不尝试把第三方文本重新解析成 Pino JSON。

应用关闭时停止接收请求、关闭数据库，然后 flush logger。正常关闭记录 `info`；超时强制退出记录 `fatal`。生产环境不写本地日志文件，由容器或运行平台采集 stdout/stderr。

## 7. System 模块与 API

### 7.1 模块组合

不建立通用插件框架。API 在 `apps/api/src/modules.ts` 中显式注册：

```ts
const systemModule = createSystemModule({
  checkDatabase: () => checkDatabase(database.db),
  logger: rootLogger.child({ component: "system" }),
});

const routes = app.route("/", systemModule);

export type AppType = typeof routes;
```

`systemModule` 自身注册 `GET /health`。所有模块通过链式 `route()` 组合到 `routes`，确保顶层 `AppType` 保留完整路由类型；`app.ts` 只负责创建应用，不监听端口或执行 Migration。

模块默认采用：

```text
Route → Service → Database
```

只有未来出现复杂领域规则时，才增加 Domain、Port 和 Adapter。

### 7.2 Health API

公开接口：

```http
GET /health
```

数据库正常时返回 HTTP `200`：

```json
{
  "status": "ok",
  "services": {
    "database": {
      "status": "up"
    }
  },
  "timestamp": "2026-09-06T10:00:00.000Z"
}
```

数据库不可用时返回 HTTP `503`：

```json
{
  "status": "degraded",
  "services": {
    "database": {
      "status": "down"
    }
  },
  "timestamp": "2026-09-06T10:00:00.000Z"
}
```

约束：

- 请求的 `json`、`query`、`param`、`header` 或 `form` 输入统一使用 `@hono/zod-validator` 的 `zValidator` 校验，并通过 `c.req.valid()` 读取；
- `status` 使用字面量联合类型；
- 时间使用 UTC ISO 8601；
- 不向客户端返回数据库异常文本；
- 数据库检查设置短超时；
- 显式使用 `c.json(body, 200)` 与 `c.json(body, 503)`，让 RPC 客户端推导成功与降级响应类型。

### 7.3 API 宿主

API 默认环境：

```text
HOST=0.0.0.0
PORT=3000
WEB_ORIGIN=http://localhost:5173
```

提供：

- Hono 内置 `requestId()` 与 Factory Helper 管理 Request ID 和 Context 变量类型；
- 结构化请求日志；
- Hono `cors`，仅允许配置来源；
- Hono `secureHeaders`、`bodyLimit` 和请求 `timeout`；
- 统一 404 和错误响应；
- SIGINT/SIGTERM 优雅关闭；
- 启动前数据库 Migration。

`bootstrap.ts` 负责严格的启动顺序：解析环境变量、执行 Migration、创建数据库连接、注册模块，最后才调用 HTTP listen。任何一步失败都关闭已创建的资源并以非零状态退出。

## 8. Hono RPC 客户端

API 仍通过 HTTP 提供 `GET /health` 等端点，但客户端契约由 TypeScript 路由类型推导，不生成 OpenAPI 或 Orval 代码。

API 顶层路由链式组合后导出 `AppType`：

```ts
const routes = app.route("/", systemModule)

export type AppType = typeof routes
```

`@full-stack-example/api` 通过仅含类型的子路径（例如 `@full-stack-example/api/contract`）暴露 `AppType`。该入口不得导入 `bootstrap.ts`、数据库客户端或 Node.js 专用模块。

`@full-stack-example/api-client` 仅包含手写的 RPC 基础设施：用 `hc<AppType>(baseUrl)` 创建客户端、配置 `credentials`/公共 headers，以及将非预期响应转换为统一错误。它只能以 `import type` 引用 API 的 contract 子路径，不得在浏览器中引入 API 的运行时代码。`parseResponse()` 仅用于所有非 2xx 都视为异常的调用；Health 的 `503` 是可展示的降级状态，必须按 `res.status` 分支解析。

API contract 使用 Hono `ApplyGlobalResponse` 将统一 `500` JSON 响应加入 RPC 类型；API Client 包在构建时预计算 `hc<AppType>` 的返回类型，避免 Web IDE 重复实例化完整服务端路由类型。

Web 层以小型 Query 函数或 Hooks 封装 RPC 方法；例如 `api.health.$get()` 作为 `useQuery` 的 `queryFn`。不得重复手写路由路径、请求体或成功响应类型。

浏览器环境变量：

```dotenv
VITE_API_BASE_URL=http://localhost:3000
NODE_ENV=development
LOG_LEVEL=debug
LOG_PRETTY=true
```

客户端错误结构：

```ts
interface ApiErrorShape {
  readonly status: number;
  readonly message: string;
  readonly requestId?: string;
}
```

调用链路：

```text
Hono/Zod Route
→ export type AppType
→ hc<AppType>
→ 手写的 TanStack Query hook
→ React
```

前后端所在 monorepo 的 `tsconfig.json` 均必须启用 `strict: true`。未来需要对外、多语言或独立版本化 API 时，再在边界上增加 OpenAPI；它不是首版交付物。

## 9. Web 与样式系统

### 9.1 首页

首版首页负责：

- 显示应用名称；
- 使用基于 Hono RPC 的 Health Query hook；
- 显示 API 和数据库状态；
- Loading 使用 daisyUI loading；
- 成功使用 `alert-success`；
- 降级或请求失败使用 `alert-error`；
- 提供重新检查按钮；
- 不手写重复的 Fetch 调用或响应类型。

### 9.2 Tailwind 和 daisyUI

Web 包安装：

```text
tailwindcss
@tailwindcss/vite
daisyui
```

Vite 同时加载 React 和 Tailwind 插件。样式统一放在 `apps/web/src/styles/index.css`：

```css
@import "tailwindcss";

@plugin "daisyui" {
  themes: false;
}

@plugin "daisyui/theme" {
  name: "forest";
  default: false;
  prefersdark: false;
  color-scheme: "dark";

  --color-base-100: oklch(20.84% 0.008 17.911);
  --color-base-200: oklch(18.522% 0.007 17.911);
  --color-base-300: oklch(16.203% 0.007 17.911);
  --color-base-content: oklch(83.768% 0.001 17.911);
  --color-primary: oklch(68.628% 0.185 148.958);
  --color-primary-content: oklch(0% 0 0);
  --color-secondary: oklch(69.776% 0.135 168.327);
  --color-secondary-content: oklch(13.955% 0.027 168.327);
  --color-accent: oklch(70.628% 0.119 185.713);
  --color-accent-content: oklch(14.125% 0.023 185.713);
  --color-neutral: oklch(30.698% 0.039 171.364);
  --color-neutral-content: oklch(86.139% 0.007 171.364);
  --color-info: oklch(72.06% 0.191 231.6);
  --color-info-content: oklch(0% 0 0);
  --color-success: oklch(64.8% 0.15 160);
  --color-success-content: oklch(0% 0 0);
  --color-warning: oklch(84.71% 0.199 83.87);
  --color-warning-content: oklch(0% 0 0);
  --color-error: oklch(71.76% 0.221 22.18);
  --color-error-content: oklch(0% 0 0);
  --radius-selector: 1rem;
  --radius-field: 2rem;
  --radius-box: 1rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 0;
  --noise: 0;
}
```

`apps/web/index.html` 固定启用主题：

```html
<html lang="zh-CN" data-theme="forest">
```

样式约定：

- 组件使用 daisyUI 的 `btn`、`card`、`alert`、`badge` 和 `loading`；
- 颜色使用 `base-*`、`primary`、`success`、`warning` 和 `error`；
- Tailwind 负责布局、间距和响应式；
- 避免在业务组件散落固定色阶；
- 不实现主题切换和系统主题监听；
- 不引入 Sass、CSS-in-JS 或其他组件库。

## 10. Podman 与环境配置

Compose 首版只运行 PostgreSQL：

```text
service       postgres
port          5432
database      app
user          app
password      app（仅本地开发）
volume        postgres-data
healthcheck   pg_isready
```

Launcher 使用 Compose 原生 `up --wait --wait-timeout 60` 等待 healthcheck，不额外维护轮询实现。真正的 Schema 初始化仍由 Database migration 命令和 API bootstrap 中的 Drizzle migrator 完成。

`.env.example`：

```dotenv
DATABASE_URL=postgres://app:app@localhost:5432/app
HOST=0.0.0.0
PORT=3000
WEB_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000
```

不提交真实 `.env`。

## 11. 测试方案

### 单元测试

- System service 在数据库正常时生成 `ok/up`；
- 数据库异常时生成 `degraded/down`；
- 时间戳符合 ISO 8601；
- 响应不包含内部异常信息；
- RPC 客户端将非预期的非 2xx 响应转换为统一错误。

### API 集成测试

- 使用 Vitest 直接调用 `app.request()`，默认不监听真实端口；数据库检查通过依赖注入替换为可控实现；
- `GET /health` 正常时返回 `200` 和约定 Schema；
- 数据库不可用时返回 `503`；
- 未知路径返回统一 `404`；
- CORS 仅允许配置的 Web Origin；
- JSON 路由测试必须设置正确的 `Content-Type`，并覆盖 Zod 校验失败的 `400` 响应；
- `AppType` 可被 Web 的 RPC 客户端在严格模式下引用。

### 数据库集成测试

- PostgreSQL 可通过 Drizzle 连接；
- 空数据库首次启动时自动初始化迁移记录并应用 Migration；
- 已初始化数据库再次启动时不会重复执行 Migration；
- Migration 执行失败时 API 不开始监听；
- `SELECT 1` 检查成功；
- 关闭 API 后数据库连接正常释放；
- 无业务 Schema 时 Drizzle 配置仍可加载。

### Launch 集成测试

- Podman 缺失时 `launch-doctor` 明确指出缺少的命令并返回非零状态；
- Podman Machine 未启动或 connection 不可用时停在 preflight，不尝试自动重置环境；
- Podman Compose provider 缺失时输出 provider 诊断并返回非零状态；
- Compose 不支持 `--wait` 时在 preflight 阶段失败；
- 全新 volume 能完成首次迁移并进入 RUNNING；
- 已初始化 volume 可重复启动且不重复应用 Migration；
- PostgreSQL unhealthy 或 60 秒超时时输出容器状态和最近日志；
- 迁移锁被占用超过 30 秒时启动失败，且不会拉起应用进程；
- Migration SQL 失败时 Web/API 均不启动，数据库 volume 保留；
- API 或 Web 异常退出时另一个子进程被停止，Launcher 返回非零状态；
- Ctrl+C 能在 10 秒内停止 Web/API，并按命令模式保留或停止 PostgreSQL；
- 重复执行 `just launch` 不创建不同 Compose project 或重复容器。

### Web 测试

- Loading 状态可见；
- Health 成功状态正确渲染；
- Database down 状态正确渲染；
- 网络错误可重试；
- 页面只通过 Hono RPC Client 获取 Health 数据。

### 日志测试

- 开发环境使用 pretty transport，生产环境始终输出合法的单行 JSON；
- 非法 `LOG_LEVEL` 在启动配置校验阶段失败；
- 符合 Hono Request ID 安全字符和长度限制的入站值被保留，无效值被替换为新 UUID；
- HTTP 完成日志包含 requestId、method、path、statusCode 和 durationMs；
- authorization、cookie、密码、Token、API Key 和数据库凭据均被替换为 `[Redacted]`；
- 4xx 不记录错误 stack，未预期 5xx 使用标准 Error serializer；
- Health 成功日志为 debug，Health 失败日志不被抑制；
- 正常关闭会 flush 日志，关闭超时产生 fatal 事件；
- 日志测试写入内存 stream，不依赖控制台文本快照。

### RPC 契约与工程检查

- API 与 Web 在 `strict` 模式下通过 TypeScript；
- API contract 入口不导入 bootstrap、数据库或 Node.js 运行时代码；
- RPC 客户端能推导 Health 的 `200` 和 `503` 响应类型；
- 路由、请求参数或响应结构变更后，受影响的 RPC 调用在类型检查阶段失败；
- 根级 Biome 覆盖全部手写源码；
- `just check` 完成 lint、格式检查、类型检查、测试和构建。

## 12. 实施顺序

1. 删除 `core`、Prettier 和失效的 repo-scaffold 配置。
2. 建立根 package、workspace、TypeScript、Biome 和 justfile。
3. 创建 Database 包、Drizzle migrator 与 PostgreSQL Compose。
4. 实现 `launch.ts` 状态机、前置检查、Compose 等待和进程信号管理。
5. 实现数据库迁移锁、首次初始化和幂等启动链路。
6. 创建 `packages/logging`、Pino 配置、脱敏规则和 child logger 约定。
7. 创建 `packages/system` 和 Health Schema。
8. 创建 Hono API、Request ID 日志中间件、RPC `AppType` 导出和优雅关闭。
9. 创建 Hono RPC Client、统一错误转换和 Health Query hook。
10. 创建 React/Vite Web 和 Query/Router Provider。
11. 接入 Tailwind v4、daisyUI 和固定 forest 主题。
12. 用 RPC Health Query hook 完成首页。
13. 增加测试、RPC 契约检查和 README 使用说明。
14. 执行完整验收。

## 13. 完成标准

以下命令全部成功：

```bash
just init
just launch-doctor
just check
just launch
```

`just launch` 必须能在一个全新的 PostgreSQL volume 上完成数据库初始化并启动应用，也必须能在已有数据和迁移记录的 volume 上安全重复执行。

浏览器访问 Web 后能够看到：

- forest 暗色主题；
- API 运行状态；
- PostgreSQL 连接状态；
- 请求失败时的提示与重试操作。

仓库中不得残留：

- Prettier 配置；
- 包级 Biome 配置；
- `packages/core`；
- `packages/modules` 中间目录；
- 不可运行的 repo-scaffold 命令；
- OpenAPI、Orval 或生成的 API Client；
- 手写的 Health API 请求或响应类型；
- Redis、BullMQ、Worker 或 oasdiff 依赖。
