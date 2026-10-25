# @my-better-t-app/business

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

负责业务服务、带数据范围的数据访问，以及归属具体业务的任务。HTTP 和 Worker 通过注入依赖复用这些工厂。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/todos/service.ts](src/todos/service.ts) | 业务操作、游标分页和操作级 telemetry |
| [src/todos/repository.ts](src/todos/repository.ts) | SQL、字段投影和独立的 `forUser(userId)` scope |
| [src/users/service.ts](src/users/service.ts) | 无需额外 Repository 的简单查询示例 |
| [src/users/jobs/profile-read.contract.ts](src/users/jobs/profile-read.contract.ts) | 队列／任务名、Zod payload、结果类型及重试／保留配置 |
| [src/users/jobs/profile-read.producer.ts](src/users/jobs/profile-read.producer.ts) | 入队、状态查询、队列观测和关闭 |
| [src/users/jobs/profile-read.processor.ts](src/users/jobs/profile-read.processor.ts) | 不依赖 Worker 连接的 payload 校验和业务执行 |
| [src/users/jobs/profile-read.worker.ts](src/users/jobs/profile-read.worker.ts) | 消费者工厂、每次尝试的日志和指标 |

## 扩展步骤

1. 新建业务目录，导出 `create...Service` 工厂，用 `ReturnType` 推导类型。Service、Repository 和任务工厂均接收一个具名依赖对象，例如 `createTodosRepository({ db: tx })`。多个业务字段使用对象，如 `service.setCompleted({ userId, id, completed })`；单个 ID 可保留原始参数，如 `forUser(userId)`。客户端通过参数注入，导入模块时不创建运行资源。
2. 归属过滤反复出现时，再增加 `repository.ts`。通过 `forUser(userId)` 绑定可信用户，读写均约束归属，创建时显式填入用户 ID。返回执行结果，不暴露可修改的查询构造器。
3. 简单查询可以留在服务里。多语句用例由服务开启事务，各 Repository 使用同一个 `tx`；网络调用和队列发布放在数据库事务之外。确有数据库写入与任务投递原子性要求时，再设计 outbox。
4. 使用 `observeOperation` 包裹有稳定名称的业务操作。RPC 错误和 session 留在 API，仅向 [exports](package.json) 增加调用方需要的子路径。
5. HTTP 服务通过 [API](../api/README.zh-CN.md) 和 [server services](../../apps/server/src/services.ts) 接线。

新增任务时参考 `users/jobs`：先定义契约、校验输入，再实现 processor、producer 和 Worker 工厂；返回任务状态或结果时检查归属。处理函数须能承受重试，结果字段和保留策略应明确受限。连接复用 [queue 基础设施](../queue/README.zh-CN.md)，消费者在 [Worker runtime](../../apps/worker/src/runtime.ts) 显式注册。任务使用明确的公共入口，如 `@my-better-t-app/business/users/jobs/profile-read/producer`（`createProfileReadClient`）和 `.../profile-read/worker`（`createProfileReadWorker`、`createProfileReadProcessor`）。Client 接收 `enqueueProfileRead({ userId, requestId })` 和 `getProfileReadJob({ userId, jobId })`；状态 helper 留在内部。

Worker 工厂返回原生 Worker，内部固定 `autorun: false`。增加一个 `consumerDefinitions` 注册项即可接入全组就绪、运行失败追踪和并行 drain；只有新增业务依赖时才扩展共享资源组装。`WORKER_CONCURRENCY` 表示每个消费者的并发，总并发要结合数据库池和内存容量评估。详见[扩展约定](../../docs/extension-design.zh-CN.md)。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @my-better-t-app/business test
pnpm --filter @my-better-t-app/business check-types
```

SQL、事务、任务重试或 trace 传播变更，需要使用专用 PostgreSQL／Redis 运行 `pnpm test:integration`，覆盖跨用户访问和失败恢复。Worker 代码不导入 API、浏览器或 session 模块。
