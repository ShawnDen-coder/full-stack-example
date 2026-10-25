# @full-stack-example/business

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

新增任务时参考 `users/jobs`：先定义契约、校验输入，再实现 processor、producer 和 Worker 工厂；返回任务状态或结果时检查归属。处理函数须能承受重试，结果字段和保留策略应明确受限。连接复用 [queue 基础设施](../queue/README.zh-CN.md)，消费者在 [Worker runtime](../../apps/worker/src/runtime.ts) 显式注册。任务使用明确的公共入口，如 `@full-stack-example/business/users/jobs/profile-read/producer`（`createProfileReadClient`）和 `.../profile-read/worker`（`createProfileReadWorker`、`createProfileReadProcessor`）。Client 接收 `enqueueProfileRead({ userId, requestId })` 和 `getProfileReadJob({ userId, jobId })`；状态 helper 留在内部。

Worker 工厂返回原生 Worker，内部固定 `autorun: false`。增加一个 `consumerDefinitions` 注册项即可接入全组就绪、运行失败追踪和并行 drain；只有新增业务依赖时才扩展共享资源组装。`WORKER_CONCURRENCY` 表示每个消费者的并发，总并发要结合数据库池和内存容量评估。详见[扩展约定](../../docs/extension-design.zh-CN.md)。

## 示例：重命名自己的 Todo

这是待实现的扩展示例，当前 API 尚无此操作。它复用已有 `todo.text` 列，不需要 migration 或新增 package export。在 [repository.ts](src/todos/repository.ts) 的 `forUser(userId)` 返回对象内，与 `setCompleted` 并列添加：

```ts
async rename({ id, text }: { id: number; text: string }) {
  const [updated] = await db
    .update(todo)
    .set({ text })
    .where(ownedTodo(id))
    .returning(fields);
  return updated ?? null;
},
```

在 [service.ts](src/todos/service.ts) 的返回对象中增加业务方法：

```ts
async rename({ userId, id, text }: {
  userId: string;
  id: number;
  text: string;
}) {
  const normalized = text.trim();
  if (!normalized || normalized.length > 500) {
    throw new Error("Todo text must contain 1–500 characters");
  }
  return observeOperation("todos.rename", async () =>
    repository.forUser(userId).rename({ id, text: normalized }),
  );
},
```

Service 保证 HTTP 和未来的 Worker 调用都遵守文本规则。Repository 负责 SQL 和归属约束，API 将 `null` 映射为 `NOT_FOUND`。`TodosService` 由返回值推导，会自动包含新方法。接着阅读 [API 示例](../api/README.zh-CN.md#示例开放-todorename)和[应用接线案例](../../docs/extension-examples.zh-CN.md#案例一重命名-todo)。

扩展 [Repository 测试](tests/todos-repository.test.ts)，检查 SQL 同时包含 `id` 和 `user_id` 条件、交错调用不串用户，以及没有匹配行时返回 `null`。增加 Service 测试覆盖 trim、空文本和超长文本。集成测试验证 Alice 可以重命名自己的 Todo，Bob 既不能修改，也无法据此判断它是否存在。

## 示例：增加资料摘要任务

这是另一个待实现的扩展示例：读取已有用户资料，返回 `{ id, summary }` 或 `null`。任务只读，可复用 Worker 已有的 users service 和数据库权限。

将 `src/users/jobs/profile-read.*.ts` 的五个文件全部复制为 `profile-summary.*.ts`，包括内部 status helper。在副本中同步修改 import 和符号：

| 已有名称 | 新名称 |
| --- | --- |
| `profile-read` / `ProfileRead` | `profile-summary` / `ProfileSummary` |
| `USER_PROFILE_QUEUE` / `USER_PROFILE_TASK` | `PROFILE_SUMMARY_QUEUE` / `PROFILE_SUMMARY_TASK` |
| `UserProfileJobData` / `UserProfileJobResult` | `ProfileSummaryJobData` / `ProfileSummaryJobResult` |
| `userProfileJobSchema` / `profileReadJobOptions` | `profileSummaryJobSchema` / `profileSummaryJobOptions` |
| `ProfileJobsUnavailableError` | `ProfileSummaryJobsUnavailableError` |

保留 payload 校验（`userId` 和可选 `requestId`）、重试及结果保留策略。新 queue 使用 `user-profile-summary`，task 使用 `summary`，原有任务保持不变。在复制后的 contract 中定义新结果：

```ts
export type ProfileSummaryJobResult = {
  id: string;
  summary: string;
} | null;
```

在复制后的 processor 中，仅替换结果投影：

```ts
return profile
  ? {
      id: profile.id,
      summary: profile.emailVerified ? "Verified account" : "Unverified account",
    }
  : null;
```

保留 status helper 的归属检查和完成后重新读取结果的逻辑、producer 的指标清理和错误映射，以及 Worker 的 telemetry、错误监听和 `autorun: false`，同时更新任务相关日志。参考 [profile-read 测试](tests/profile-read.test.ts)给新 processor／status helper 增加用例，覆盖非法输入、用户不存在和跨用户查询。[后台任务接线案例](../../docs/extension-examples.zh-CN.md#案例二新增后台任务)继续说明 exports、Server／API 接线和消费者显式注册。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @full-stack-example/business test
pnpm --filter @full-stack-example/business check-types
```

SQL、事务、任务重试或 trace 传播变更，需要使用专用 PostgreSQL／Redis 运行 `pnpm test:integration`，覆盖跨用户访问和失败恢复。Worker 代码不导入 API、浏览器或 session 模块。
