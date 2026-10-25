# 模块扩展示例

[English](extension-examples.md) · [简体中文](extension-examples.zh-CN.md) · [开发指南](development.zh-CN.md)

这些案例以当前 Todo 和资料任务代码为基础，说明如何完成一次扩展；下文的新操作尚未实现。每个案例需要配套修改，代码片段会说明具体插入位置。除非另有说明，命令均在仓库根目录执行。

## 选择案例

| 想做的改动 | 从哪里开始 | 验证结果 |
| --- | --- | --- |
| 重命名自己的 Todo | [Business](../packages/business/README.zh-CN.md#示例重命名自己的-todo)、[API](../packages/api/README.zh-CN.md#示例开放-todorename)及下方案例一 | 从用户范围 SQL 到前端类型安全 mutation |
| 增加后台任务 | [Business 任务示例](../packages/business/README.zh-CN.md#示例增加资料摘要任务)及下方案例二 | Server 入队、独立 Worker 执行、提交者查询状态 |
| 增加数据库字段 | [DB 截止时间示例](../packages/db/README.zh-CN.md#示例为-todo-增加可选截止时间) | migration 可审查，升级保留旧数据 |
| 扩展队列基础设施 | [Queue 超时示例](../packages/queue/README.zh-CN.md#示例允许配置-redis-连接超时) | 两种连接角色保留各自重试行为 |
| 增加指标 | [Observability 文件大小示例](../packages/observability/README.zh-CN.md#示例记录导出文件大小) | 属性值集合有界，Collector 缺席不影响业务 |
| 增加共享组件 | [UI PendingButton 示例](../packages/ui/README.zh-CN.md#示例增加共享-pendingbutton) | 忙碌状态可访问，业务行为留在 web |

## 案例一：重命名 Todo

用户编辑自己的 Todo 文本，请求为 `{ id, text }`，返回值仍是 `{ id, text, completed }`，不涉及 schema 变更。

| 位置 | 具体改动 |
| --- | --- |
| `packages/business/src/todos/repository.ts` | 在 `forUser` 中增加 `rename`，复用 `ownedTodo(id)` 和现有投影 |
| `packages/business/src/todos/service.ts` | 校验／规范文本，为 `todos.rename` 增加观测 |
| `packages/api/src/routers/todo.ts` | 增加认证后的 `rename` procedure，无匹配资源时返回 `NOT_FOUND` |
| `apps/server/src/services.ts` | 复用已有的 `createTodosService({ db })` 实例 |
| `apps/web/src/routes/_auth/todos.tsx` | 增加编辑表单和类型安全 mutation，保留按身份隔离的缓存失效逻辑 |

先完成 [Repository／Service 示例](../packages/business/README.zh-CN.md#示例重命名自己的-todo)，再完成 [API 示例](../packages/api/README.zh-CN.md#示例开放-todorename)。`Services.todosService` 已使用推导出的 `TodosService`，`appRouter.todo` 也已挂载；增加这个操作无需新建 Server client、增加 `Services` 属性或 package export。同步修改测试中的 typed service fake。

在 `TodosRoute` 内、`refresh` 之后，与已有 mutations 并列加入：

```ts
const renameMutation = useMutation(
  orpc.todo.rename.mutationOptions({
    retry: false,
    onSuccess: refresh,
  }),
);
```

将 `renameMutation.isPending` 加入已有 `busy` 表达式。每行的编辑表单维护自己的草稿，为输入框设置可访问标签，仅在 `!busy` 且 trim 后文本长度为 1–500 时提交：

```ts
renameMutation.mutate({ id: todo.id, text: draftText });
```

这里的 `todo` 是正在渲染的行，`draftText` 是该行的本地编辑状态，不是新增的 router context 字段。多个表单需要共享忙碌行为时，可使用 [PendingButton 示例](../packages/ui/README.zh-CN.md#示例增加共享-pendingbutton)。失败时保留草稿，沿用已有 mutation 错误提示。缓存前缀仍使用 `["user", userId, "todos"]`，由 `refresh` 使当前用户的所有分页失效；请求中不增加归属用户字段。

如果增加的是一个全新 Service，而不只是现有 Service 的方法，还需要：增加 business package export，在 `createServices` 调用工厂，将具体服务类型加入 API `Services`，将实例放入返回的 `services`，并在 `appRouter` 注册新 router。共享 `db` 的 Service 不负责关闭数据库；新增独立 client 时，要补齐就绪、构造失败回滚和 drain 清理，并在依赖数据库的资源关闭后再关闭数据库。

运行 `pnpm check-types`、`pnpm check:boundaries` 和 `pnpm test`。配置专用 `TEST_DATABASE_URL`／`TEST_REDIS_URL` 后，运行 `pnpm test:integration` 和 `pnpm test:e2e`。检查 Alice 修改后刷新仍能看到结果，Bob 不能读取或修改 Alice 的 Todo，非法文本不进入 SQL，写入失败保留草稿。测试位置包括现有 Server 测试和 `apps/web/tests/session.spec.ts`。

## 案例二：新增后台任务

增加独立的 `profile-summary` 任务，读取当前用户资料并返回认证状态摘要。先按 [business 任务示例](../packages/business/README.zh-CN.md#示例增加资料摘要任务)完成五个文件，不改名原有队列，也不改变其待处理任务。

向 `packages/business/package.json` 已有的 `exports` 对象加入：

```json
"./users/jobs/profile-summary/contract": "./src/users/jobs/profile-summary.contract.ts",
"./users/jobs/profile-summary/producer": "./src/users/jobs/profile-summary.producer.ts",
"./users/jobs/profile-summary/worker": "./src/users/jobs/profile-summary.worker.ts"
```

Processor 和 status 文件仍是内部实现。Producer 导出 `createProfileSummaryClient`、通过 `ReturnType` 推导的 `ProfileSummaryClient` 和 `ProfileSummaryJobsUnavailableError`。保留复制后已改名的 client 类型别名，不要重复追加声明：

```ts
export type ProfileSummaryClient = ReturnType<typeof createProfileSummaryClient>;
```

在 `apps/server/src/services.ts` 从新 producer 公共子路径导入工厂，并在现有启动 `try` 块内创建：

```ts
const profileSummaryJobs = createProfileSummaryClient({
  redisUrl: config.REDIS_URL,
  logger,
});
```

将它加入返回的 `services`；扩展 `checkJobsReady`，检查两个 client；关闭时先关闭两者，再关闭数据库。构造失败回滚与正常退出都要覆盖：第二个 client 创建失败时必须关闭第一个，一个 close 失败不能跳过另一个。不把队列 client 加入核心 `checkReady`，Redis 仍是普通 API 请求的可选能力。

在 `packages/api/src/context.ts` 通过 `import type` 引入 `ProfileSummaryClient`，向 `Services` 增加：

```ts
profileSummaryJobs: Pick<
  ProfileSummaryClient,
  "enqueueProfileSummary" | "getProfileSummaryJob"
>;
```

在 `src/routers/users.ts` 导入新的 unavailable error，扩展 `withProfileJobs`，让两种 unavailable error 都映射为 `SERVICE_UNAVAILABLE`。再向 `usersRouter` 增加：

```ts
enqueueProfileSummary: protectedProcedure.handler(({ context }) =>
  withProfileJobs(() => context.services.profileSummaryJobs.enqueueProfileSummary({
    userId: context.session.user.id,
    requestId: context.requestId,
  })),
),
getProfileSummaryJob: protectedProcedure
  .input(z.object({ id: z.string().min(1).max(128) }))
  .handler(async ({ input, context }) => {
    const job = await withProfileJobs(() =>
      context.services.profileSummaryJobs.getProfileSummaryJob({
        jobId: input.id,
        userId: context.session.user.id,
      }),
    );
    if (!job) throw new ORPCError("NOT_FOUND");
    return job;
  }),
```

在 `apps/worker/src/runtime.ts` 从新的公共子路径导入 contract 和 Worker 工厂，向 `consumerDefinitions` 追加下列对象，与已有资料消费者并列：

```ts
{
  name: PROFILE_SUMMARY_QUEUE,
  concurrency: 2,
  create: ({ redisUrl, services, concurrency, logger }) =>
    createProfileSummaryWorker({
      redisUrl,
      usersService: services.usersService,
      concurrency,
      logger,
    }),
},
```

`WorkerServices` 已有同一个 users service，无需新增共享资源或 API 依赖。业务工厂保留 `autorun: false`，启动、就绪、运行循环故障处理和并行 drain 仍由 runtime 负责。原消费者默认并发为 5，加上本例的 2，总并发为 7，应审查数据库池容量。注册消费者不会创建 scheduler。

重启 Server 和 Worker 后，登录状态下可调用：

```ts
const job = await client.users.enqueueProfileSummary();
const status = await client.users.getProfileSummaryJob({ id: job.id });
```

轮询状态时设置 deadline，不假设立即完成。尚未完成或用户已不存在时结果为 `null`；查询他人的 job 或不存在的 job 返回 `NOT_FOUND`，Redis 故障返回 `SERVICE_UNAVAILABLE`。

运行与案例一相同的离线检查。配置专用测试服务后，扩展 `apps/server/tests/integration/application.test.ts`，验证新任务入队／完成、拒绝跨用户查状态、重试有效，以及两个消费者均在数据库关闭前完成 drain。为新增 Server client 补齐启动失败／清理测试，并同步 typed service fake。如果任务需要读取新表，还要单独审查 Worker 授权以及 Service／资源注入；目前 Worker 角色仅读取用户资料。
