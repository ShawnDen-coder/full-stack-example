# Todos 包

`@full-stack-example/todos` 是首个真实租户业务模块，封装 Todo 校验、租户事务、Repository、Service 和 Hono CRUD 路由。

## 职责边界

负责 Todo 领域规则和租户数据访问；不解析 Session、不调用 Better Auth，租户身份和权限由 Auth 模块在组合根注入。

## 对外接口

- `todoSchema`、`todoListSchema`、`createTodoSchema`、`updateTodoSchema`、`todoIdSchema` 定义运行时校验。
- `TenantTodoService` 描述路由所需的租户业务操作。
- `createTodoService({ database })` 创建一次可复用的租户 Service。
- `setupTodosApp(app, options)` 把 `/api/todos` 路由挂载到现有 Hono 应用。
- `TodosApiType` 描述独立的 Todos 子路由，供 Web 创建只覆盖 Todo 端点的 Hono RPC client。

路由实现按复杂度分层：`route.desc.ts` 保存 OpenAPI 配置，`route.handler.ts` 使用模块自己的 `createFactory().createHandlers()` 组合 validator、授权和 handler，`route.ts` 链式定义带完整 API 路径的子应用。`setupTodosApp()` 将同一子应用挂载到宿主并导出其路由类型，消费者可独立创建小范围 RPC client。

Repository 由 Service 内部按请求创建，路由永远不直接访问 Drizzle。模块固定使用 PostgreSQL，schema 和迁移由 Database 统一维护；不单独拆分适配器包。getTenantId 在授权之后执行，返回已验证的租户 ID。

## 依赖关系

```text
API → Todos → Database
API → Auth（鉴权后通过 getTenantId 提供租户）
```

Todos 不导入 Auth server，也不自行解析 Cookie 或 Session。

## 用法

在 API 组合根创建一次 Service，并显式注入读写删除权限：

```ts
import { createTodoService, setupTodosApp } from "@full-stack-example/todos";

const service = createTodoService({ database: runtimeDatabase });
const withTodos = setupTodosApp(app, {
  service,
  getTenantId: (context) => context.get("tenantPrincipal")?.tenantId,
  authorization: {
    read: auth.require.requireTenantPermission({ resource: "todos", action: "read" }),
    write: auth.require.requireTenantPermission({ resource: "todos", action: "write" }),
    delete: auth.require.requireTenantPermission({ resource: "todos", action: "delete" }),
  },
});
```

调用 Service 时传入已经由 Auth 验证过的租户 ID：

```ts
const todos = await service.listTodos(tenantPrincipal.tenantId);
```

Web 按功能使用 Todo 路由类型创建独立 client；服务端路由合同仍由本模块实现：

```ts
import { hc } from "hono/client";
import type { TodosApiType } from "@full-stack-example/todos";

const todosApi = hc<TodosApiType>("http://localhost:3000", { init: { credentials: "include" } });
const response = await todosApi.api.todos.$get();
if (!response.ok) throw new Error(`Todo request failed: ${response.status}`);
const { todos } = await response.json();
```

请求必须携带有效 Session Cookie，并且 Session 已设置 `activeOrganizationId`。直接使用无 Cookie 的 curl 会返回 `401`，登录但未选择组织会返回 `400`。

## HTTP 行为

`GET` 按最新优先列出当前租户 Todo；`POST` 创建 1–200 字符标题；`PATCH` 修改完成状态；`DELETE` 删除 Todo。输入错误为 `400`，跨租户或不存在资源为 `404`，member 删除为 `403`。

## 数据访问流程

```text
HTTP 请求
→ Auth tenantPermission
→ tenantPrincipal.tenantId
→ TenantTodoService
→ withTenantTransaction
→ TenantTodoRepository 显式 tenant_id 条件
→ PostgreSQL RLS 最终防线
```

Service 在每次操作中开启租户事务并创建短生命周期 Repository，调用方只创建一个长期复用的 Service。

## 开发与验证

```bash
pnpm --filter @full-stack-example/todos typecheck
pnpm --filter @full-stack-example/todos build
```

## 扩展规则

新增字段时同步更新 Zod schema、Service、Repository、OpenAPI、API 测试和 README；所有查询必须携带租户条件，不能把 RLS 当作唯一防线。新增 Web 会调用的路由时，保持 Hono 路由链式定义并更新 `TodosApiType` 覆盖的子应用，让 Web 只实例化该业务路由类型。

参阅 [Todos 模块说明](/modules/todos/)和 [HTTP API 参考](/reference/http-api/)。
