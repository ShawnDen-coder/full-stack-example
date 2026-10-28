# 运维指南

[English](operations.md) · [简体中文](operations.zh-CN.md) · [项目说明](../README.zh-CN.md)

本页说明生产部署、数据库迁移、运行限制与恢复。开发环境启动见[快速开始](../README.zh-CN.md#快速开始)。命令均在仓库根目录执行。

## 生产部署

支持的基线是单机 Podman Compose，前面配置 HTTPS 反向代理。`container/compose.yml` 用于本地开发，`container/compose.production.yml` 是独立生产栈，浏览器请求使用同一个公开 HTTPS origin。通过进程环境或忽略的 `deploy/.env` 提供 `deploy/.env.schema` 中的值：`PUBLIC_APP_URL`、`BETTER_AUTH_SECRET`（至少 32 个字符）、`POSTGRES_PASSWORD` 和三个指向 `postgres:5432/app` 的数据库 URL：

- `MIGRATION_DATABASE_URL`：`postgres` schema owner，密码与 `POSTGRES_PASSWORD` 一致，仅供部署任务使用。
- `DATABASE_URL`：`app_server`，使用独立运行密码。
- `WORKER_DATABASE_URL`：`app_worker`，使用独立运行密码。

密码需 URL 编码，生产密码没有默认值，不复用开发或 CI 凭据。部署依次执行 migration、运行角色配置、Server/Worker 更新和 Web 更新。Server 仅获得业务表读写权限，Worker 仅读取用户资料；运行角色没有 DDL 权限。已有数据卷会在角色配置步骤中创建或更新这两个账号。

```bash
pnpm podman:up
pnpm podman:logs
# 停止容器，保留数据卷：
pnpm podman:down
```

部署命令会构建镜像，等待 PostgreSQL 和 Redis 就绪，执行一次新的迁移任务，再依次更新 API/worker 和前端。迁移失败会在替换现有应用容器之前停止发布。就绪检查失败会阻止后续部署步骤，但不会自动回滚应用。升级时应采用向后兼容的增量迁移。

将外部 TLS 代理指向 `127.0.0.1:8080`，可通过 `WEB_PORT` 修改端口。Nginx 提供 SPA 静态文件，并将认证、RPC 和接口文档路径代理到后端。生产环境不向宿主机发布 API、数据库或 Redis 端口。前端请求地址在构建时写入产物，修改后需要重新构建前端。生产 Node 镜像以 `node` 用户运行，只携带构建产物和生产依赖，本地配置值文件不会复制到镜像层中。

## 数据库迁移

仓库中的 SQL 迁移用于初始化空数据库，并记录每次数据库结构变更。执行 `pnpm db:generate`，审查并提交生成的 SQL 和快照，再运行 `pnpm db:migrate`。重复执行迁移是安全的。`pnpm db:push` 仅适合可随时丢弃的本地实验数据库，不用于发布。

初始迁移面向新数据库。对于此前通过 `db:push` 创建的数据库，需要单独审查并制定迁移基线接入方案；不要直接执行初始迁移，也不要在未比对结构时将其标记为已执行。为保持兼容，Todo 所属用户字段仍允许为空：没有所属用户的记录无法通过 API 访问，新建记录则始终绑定当前登录用户。

迁移语句默认上限 300 秒，锁等待上限 5 秒，与请求查询超时独立。新增表时审查 `packages/db/src/provision.ts` 的显式运行角色授权。

## 运行时与日志

API 和 worker 各自管理客户端及退出流程。API 在 PostgreSQL 就绪后监听端口；队列可用性由 `/ready/jobs` 单独检查。`/health` 表示进程能够响应，`/ready` 在两秒内检查数据库，在退出排空阶段或依赖故障时返回 503。就绪检查不会解析会话。它用于探测依赖状态，不能代替迁移校验或队列积压监控。

API 默认启动超时为 10 秒，退出超时为 30 秒；Compose 为 API 和 worker 预留 40 秒。按进程配置 `DB_POOL_MAX`，默认值为 10；通过 `DB_QUERY_TIMEOUT_MS` 同时限制客户端查询等待时间和数据库语句执行时间，默认 10 秒。部署多个副本时，应统筹计算数据库连接总数。worker 的启动与退出超时独立于查询超时。

Pino 将 JSON 日志输出到 stdout，包含 `service`、请求 ID、耗时和状态码。HTTP 响应通过 `X-Request-ID` 返回请求 ID，队列任务会携带该 ID，并在完成或失败时记录任务 ID。数据库和 Redis 驱动异常仅序列化经过脱敏的消息和堆栈。不要记录请求体、认证头、会话对象、完整配置对象或 SQL 绑定参数。将日志接入部署平台的采集系统，对持续出现的 503、任务失败和不断增长的队列延迟设置告警。

### Worker 运行限制

Worker 的 `DATABASE_URL` 和 `REDIS_URL` 指向与 API 相同的服务，不需要 Better Auth 密钥。`pnpm dev:worker` 可单独启动消费者，`pnpm start:worker` 运行构建产物。生产 Worker 使用独立镜像，不暴露 HTTP 端口。

| 配置 | 默认值 | 含义 |
| --- | --- | --- |
| `WORKER_STARTUP_TIMEOUT_MS` | 10,000 ms | 数据库和消费者各就绪阶段的预算 |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | 30,000 ms | 全组 drain 和资源清理预算 |
| `WORKER_CONCURRENCY` | 5 | 每个消费者并发，允许 1–100 |

总并发为各消费者并发之和，扩展时评估数据库池和内存。启动失败会在关闭预算内清理已创建资源，退出信号会取消启动等待。启动不会创建或重置 scheduler；调度配置、持久化、暂停／恢复和 reconciliation 不属于当前功能。

收到 `SIGINT`／`SIGTERM` 后，API 停止接收请求并关闭队列 client 和数据库；Worker 停止消费，等待活动任务完成，再关闭自己的数据库。超时会非零退出，由 BullMQ 恢复 stalled 任务。业务处理必须能承受重复执行。长任务需同时调整应用关闭预算和 Compose 的 40 秒停止宽限期。Worker 使用无限 Redis 请求重试，HTTP producer 使用有限重试；`msgpackr-extract` 原生构建关闭，使用 JavaScript fallback。

## 备份与恢复

发布涉及数据库结构的变更前，使用部署环境管理的凭据执行 `pg_dump -Fc`，创建 PostgreSQL 逻辑备份，并存放在宿主机之外。通过 `pg_restore` 将备份恢复到新的空数据库，验证恢复流程。为队列任务保留 Redis AOF 数据卷，并确保处理函数能承受重复执行。仅保存在同一台机器上的备份，或从未验证过的恢复流程，都不足以支持可靠恢复。

回滚应用时，只有此前验证过的镜像版本仍兼容当前数据库结构，才能重新部署它。系统不会自动执行破坏性的反向迁移。恢复数据库时，先停止生产者和消费者，将备份恢复到新数据库，检查表结构和数据归属，再让服务连接该数据库。在恢复消费者之前，核对并处理队列中的任务。不要在生产升级过程中执行 `podman compose down -v`。

## 可观测性

日志、trace、指标、健康探针及故障验收统一见[可观测性运维](observability.zh-CN.md)。Collector 和 exporter 不参与 readiness。
