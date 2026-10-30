# @full-stack-example/api

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

负责服务端的 HTTP 和认证边界：Hono 组装、Better Auth、oRPC 输入校验、session 解析和传输层错误映射。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/create-api.ts](src/create-api.ts) | 根据注入的依赖构建 Hono 应用，管理 HTTP 中间件和健康路由 |
| [src/context.ts](src/context.ts) | 定义 `Services`、session、request ID 和请求 logger |
| [src/procedures.ts](src/procedures.ts) | 公开及需要登录的 procedure 构造器 |
| [src/routers/todo.ts](src/routers/todo.ts) | 输入校验和用户范围 CRUD 的参考实现 |
| [src/routers/index.ts](src/routers/index.ts) | 注册路由并推导客户端类型 |
| [src/queue-monitor.ts](src/queue-monitor.ts) | 基于 `@bull-board/api` 的只读 BullMQ 投影 |
| [src/routers/queues.ts](src/routers/queues.ts) | 受平台权限保护的队列、任务、日志和定时过程 |
| [src/auth.ts](src/auth.ts) | Better Auth 工厂 |

## 扩展步骤

1. 先在 [domain](../domain/README.zh-CN.md) 实现操作。将具体服务类型加入 `Services`，在 [server services](../../apps/server/src/services.ts) 中实例化，再注入 `createApi`。
2. 在 `src/routers` 下增加路由，用 Zod 校验输入，再调用 `context.services`。`protectedProcedure` 要求登录；每个工具操作使用 `pageProcedure(page)` 检查页面权限，并从 `context.session.user.id` 获取归属用户。新工具不能只依赖登录保护。
3. 资源不存在和属于其他用户时统一返回 `NOT_FOUND`。将已知业务失败转换为稳定的 RPC 错误，不返回数据库驱动的内部错误信息。
4. 在 `src/routers/index.ts` 注册路由。操作名表达具体含义，例如 `setCompleted`；已有客户端需要时保留兼容别名。
5. 依赖创建、端口监听和退出仍由应用负责。只有其他包需要新入口时才增加 [package export](package.json)。

认证插件或表结构选项从 `src/auth.ts` 修改，先按[认证表结构生成流程](../../docs/development.zh-CN.md#生成-better-auth-表结构)生成，再走[数据库迁移流程](../db/README.zh-CN.md)。

## 示例：开放 todo.rename

[src/routers/todo.ts](src/routers/todo.ts) 已实现 `todoRouter.rename`，调用 [domain 的 rename 方法](../domain/README.zh-CN.md#示例重命名自己的-todo)。其校验与归属边界如下：

```ts
rename: pageProcedure("todos")
  .input(z.object({
    workspaceId: z.string().min(1).max(100),
    id: z.number().int().positive(),
    text: z.string().trim().min(1).max(500),
  }))
  .handler(async ({ input, context }) => {
    const updated = await context.services.todosService.rename({
      userId: context.session.user.id,
      workspaceId: context.workspaceId,
      id: input.id,
      text: input.text,
    });
    if (!updated) throw new ORPCError("NOT_FOUND");
    return updated;
  }),
```

当前 router 已实现此操作。已有 `appRouter.todo` 注册和推导出的客户端类型会开放 `client.todo.rename({ workspaceId, id: 7, text: "Book tickets" })`。无需接收 `userId`、创建新的 Service 实例或手写客户端接口。调用方式见[前端案例](../../docs/extension-examples.zh-CN.md#案例一重命名-todo)。

扩展 [Server 模块测试](../../apps/server/tests/modules.test.ts)：未登录调用被拒绝；文本会 trim；空文本、超长文本和非法 ID 被校验拦截；Service 收到的用户 ID 来自 session。使用专用数据库的集成测试确认资源不存在和属于其他用户时均返回 `NOT_FOUND`。`TodosService` 增加 `rename` 后，同步更新测试中的 typed service fake。

队列监控支持按状态浏览、精确任务 ID 和跨所有状态的完整名称匹配。名称搜索每个状态最多检查 100 条，额外读取一条判断是否截断，最多返回 50 个去重匹配，并报告扫描数和截断情况；结果不是快照或精确总数。旧 `jobId` 仅表示 ID 查询。调度读取每页最多返回 50 条。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @full-stack-example/api check-types
pnpm --filter server test
```

认证、数据库或队列行为变更还要使用专用测试服务运行 `pnpm test:integration`。API 契约变化时同步 web 调用方并运行 `pnpm check-types`。本包不启动 Worker 消费者，也不通过 RPC context 暴露原始数据库。

## 角色与页面授权

[实现与扩展规则](../../docs/access-control.zh-CN.md)。

## Workspace API

`createAccessService(auth, db)` 提供权限快照和空间管理适配器。`access.mine` 只列成员空间；
`access.workspaces` 是平台分页元数据列表。`access.createWorkspace` 在同一事务内创建组织、
指定 owner、standard 角色和工具配置，不自动将创建者加入空间。`access.setTool` 仅平台可用；
本地 owner/admin 通过 `access.addMember` 按已有账号邮箱幂等添加普通成员。

每个 Todo input 必须包含 `workspaceId`。`pageProcedure` 核实成员、工具启用与原生角色授权，
将同一个不可变 scope 传给 service。不能依靠 session 的 activeOrganizationId 选择业务对象。
原生 Organization 写接口使用允许列表，成员与角色必须属于显式指定的组织；owner 变更、移除、
邀请和删除仍未开放。Queues 使用 `platformProcedure`；账号资料任务继续按用户隔离。

普通业务规则和可复用用例属于 domain。access/workspaces 是 Better Auth 组织管理的特定适配层：可以解析会话、执行原生权限检查、在事务中配置组织成员和角色，并映射传输错误。此例外不适用于 Todo 普通业务。出现真实的非 HTTP 复用需求时再提取具体用例；domain 不接收 `Headers`、session 或 `ORPCError`。

队列监控注册项二选一：原生 BullMQ `Queue` 或包含日志读取的完整 `QueueReadAdapter`。两者只用于应用组装；procedure 接收监控能力，队列仍由 producer 负责关闭。

空间创建和账号封禁共享[用户行锁协议](../../docs/access-control.zh-CN.md)：在同一事务内检查和写入，并另行执行授权。参见[并发测试](../../apps/server/tests/integration/workspaces.test.ts)。
