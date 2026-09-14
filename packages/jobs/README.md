# Jobs

BullMQ + PostgreSQL 的后台任务模块。任务定义与 BullMQ 解耦；BullMQ PostgreSQL backend、Worker 生命周期和 Bull Board 只存在于基础设施 adapter 中。

## 快速开始

任务由业务模块显式定义，Worker 组合根明确列出要启动的任务：

```ts
import { exampleJob } from "@full-stack-example/jobs";
import { createBullMqJobs } from "@full-stack-example/jobs/server";
import { createJobsWorker } from "@full-stack-example/jobs/worker";
import { getAppLogger } from "@full-stack-example/logging";

const logger = getAppLogger(["jobs", "worker"]);
const runtime = await createBullMqJobs({
  databaseUrl: process.env.DATABASE_RUNTIME_URL!,
  logger,
});
const worker = createJobsWorker({
  databaseUrl: process.env.DATABASE_RUNTIME_URL!,
  definitions: [exampleJob],
  logger,
});

await runtime.producer.enqueue(exampleJob, { message: "hello" });
await worker.close();
await runtime.close();
```

数据库迁移必须使用 migrator 账号执行 `runMigrations`；API/worker 只使用 runtime 账号。生产环境建议将 API、worker、migration 分成独立进程。

## 依赖关系

业务模块定义任务和副作用；API 组合根只使用 producer 入队，Worker 组合根显式注册 definitions。Jobs 提供 BullMQ adapter、Worker factory、migration 和 Bull Board，不依赖 API 或某个业务任务模块。

## 生命周期

迁移命令先完成 BullMQ PostgreSQL schema 和 runtime grants；API 创建 producer，Worker 等待 `waitUntilReady()` 后消费显式注册的任务。关闭时先停止任务处理，再关闭队列连接。业务 handler 必须按 at-least-once 语义保持幂等。

## 定义和注册任务

使用 `defineJob()` 声明任务名称、Zod 输入 schema 和处理器。Schema 输入类型用于入队，解析后的输出类型用于处理器，因此默认值和转换在执行前完成：

```ts
import { defineJob } from "@full-stack-example/jobs";
import { z } from "zod";

export const sendEmailJob = defineJob({
  name: "email.send",
  input: z.object({ to: z.email(), template: z.string() }),
  async process({ data, log }) {
    await log(`Sending ${data.template} to ${data.to}`);
    return { sent: true as const };
  },
});
```

业务模块可按 `jobs/*.job.ts` 拆分，并在 `jobs/index.ts` 汇总导出：

```ts
export const emailJobs = [sendEmailJob, sendReceiptJob] as const;
```

Worker 组合根显式注册模块任务：

```ts
const worker = createJobsWorker({
  databaseUrl,
  logger,
  definitions: [...emailJobs, ...reportJobs, exampleJob],
});
```

任务依赖通过业务模块工厂注入，例如 `createEmailJobs({ mailer })` 返回 definitions。模块导出是显式的；不依赖装饰器副作用或运行时目录扫描。BullMQ 官方采用一个 Worker 按 `job.name` 分派的方式，本包以任务定义表实现同一模型，并在启动时拒绝重复名称。

`JobDefinition` 和 `JobExecutionContext` 不依赖 BullMQ。执行上下文提供 `data`、`id`、`attempt`、`updateProgress` 和 `log`；业务处理器可以独立单测，也可在 adapter 边界替换队列实现。未知任务和不符合 schema 的 payload 会作为不可重试错误失败。

Producer 将任务描述对象与 payload 绑定，避免任意字符串任务名与错误 payload 组合：

```ts
await runtime.producer.enqueue(sendEmailJob, {
  to: "user@example.com",
  template: "welcome",
});
```

HTTP 路由不会自动为任意任务生成接口。当前示例 `POST /api/admin/jobs/examples` 由 API 组合层持有，并注入 `JobProducer`；Jobs 包不会暴露示例 service 或业务路由。新增业务 enqueue endpoint 时，在 API/业务模块定义自己的 Zod schema、鉴权和 HTTP 处理，不开放通用 `unknown` enqueue API。

## 公开入口

- `@full-stack-example/jobs`：任务合同、`defineJob()` 和示例任务定义/schema。
- `@full-stack-example/jobs/server`：BullMQ PostgreSQL adapter、Bull Board setup。
- `@full-stack-example/jobs/worker`：显式 definitions 的 Worker factory。
- `@full-stack-example/jobs/migration`：官方 BullMQ PostgreSQL migration。

管理员页面默认为 `/admin/queues`，要求平台管理员、fresh session、CSRF 和 same-origin 保护。Bull Board 展示前会递归脱敏 payload (`data`) 和返回值 (`returnValue`)；日志与错误文本不经过这些 formatter，任务代码不得在其中写入敏感信息。BullMQ migration 固定授予 `app_runtime` 对 BullMQ schema 的运行权限，与 API 和 Worker 使用的 runtime 角色一致；角色名不可配置。

## 职责边界

本包负责 BullMQ PostgreSQL adapter、Worker 生命周期、迁移和 Bull Board 挂载。业务模块负责任务输入 schema、依赖注入、幂等策略和具体处理逻辑；API 组合根负责示例 enqueue HTTP 行为及 HTTP 权限策略，Worker 组合根负责显式注册任务。本包不负责业务副作用和租户级队列模型。

## 配置与运行资源

Producer 和 Worker 使用 `DATABASE_RUNTIME_URL`；migration 只使用 `DATABASE_MIGRATOR_URL`。Worker 并发度和 pool 上限由 `JOBS_WORKER_CONCURRENCY`、`JOBS_POOL_MAX` 控制。队列数据持久化在 BullMQ PostgreSQL schema，任务名称和 payload 属于兼容合同。

## 错误与边界行为

- 重复 definition 名称在 Worker 创建时失败。
- 未注册任务和 schema 校验失败作为不可重试失败处理。
- 数据库连接或 migration 不可用时，Worker readiness 失败并返回非零退出状态。
- Bull Board 脱敏只覆盖 `data` 和 `returnValue`；日志和错误文本由任务实现负责避免敏感内容。

## 开发与验证

```bash
just jobs-migrate
just jobs-worker
just jobs-test-integration
```

`just jobs-migrate` 直接用 `tsx` 执行 migration 源码，不会构建整个 API workspace；常规完整开发环境由 `just dev` 管理，已 provision 的基础设施可用 `just dev-only`。`just jobs-worker` 用于启动构建后的 Worker。PostgreSQL 集成测试不会被普通 `just test` 自动触发；启动数据库后用 `just jobs-test-integration` 显式运行。完整验证仍应执行 `just typecheck`、`just test`、`just build` 和 `just container-build`。

## 扩展规则

- 处理器必须按 BullMQ at-least-once 语义设计为幂等。
- 不要在 Job data 或日志中写入密码、token、Cookie 等敏感信息。
- 新任务使用自己的 schema、service 和 API 路由，不把所有输入合并为通用 `unknown` 接口。
- 不要从根入口暴露 BullMQ、`pg` 或 Bull Board 类型；基础设施实现只从 `server`、`worker` 和 `migration` 子路径引入。
