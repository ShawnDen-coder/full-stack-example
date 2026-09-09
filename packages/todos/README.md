# Todos 包

`@full-stack-example/todos` 是首个真实租户业务模块，封装 Todo 校验、租户事务、Repository、Service 和 Hono CRUD 路由。

## Responsibilities

负责 Todo 领域规则和租户数据访问；不解析 Session、不调用 Better Auth，租户身份和权限由 Auth 模块在组合根注入。

## Public API

- `todoSchema`、`todoListSchema`、`createTodoSchema`、`updateTodoSchema`、`todoIdSchema` 定义运行时校验。
- `TenantTodoService` 描述路由所需的租户业务操作。
- `createTodoService({ database })` 创建一次可复用的租户 Service。
- `setupTodosApp(app, options)` 把 `/api/todos` 路由挂载到现有 Hono 应用。

Repository 由 Service 内部按请求创建，路由永远不直接访问 Drizzle。

## 用法

在 API 组合根创建一次 Service，并显式注入读写删除权限：

```ts
import { createTodoService, setupTodosApp } from "@full-stack-example/todos";
const service = createTodoService({ database: runtimeDatabase });
setupTodosApp(app, { service, authorization });
```

Web 或 API Client 可以直接调用同一合同：

```bash
curl http://localhost:3000/api/todos
curl -X POST http://localhost:3000/api/todos \
  -H 'content-type: application/json' \
  -d '{"title":"Write docs"}'
```

## HTTP behavior

`GET` 按最新优先列出当前租户 Todo；`POST` 创建 1–200 字符标题；`PATCH` 修改完成状态；`DELETE` 删除 Todo。输入错误为 `400`，跨租户或不存在资源为 `404`，member 删除为 `403`。

## Development

```bash
pnpm --filter @full-stack-example/todos typecheck
pnpm --filter @full-stack-example/todos build
```

## Extension rules

新增字段时同步更新 Zod schema、Service、Repository、OpenAPI、API 测试和 README；所有查询必须携带租户条件，不能把 RLS 当作唯一防线。

See the [Todos module guide](/modules/todos/) and [HTTP API Reference](/reference/http-api/).
