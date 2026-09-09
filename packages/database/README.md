# Database 模块（字段语义与关系说明）

`@full-stack-example/database` 负责 PostgreSQL 连接、Drizzle schema、migration、健康检查，以及 Better Auth 持久化表。Auth 模块通过 Drizzle adapter 使用这些表。

## 表和字段语义

| 表 | 关键字段 | 语义 |
| --- | --- | --- |
| `user` | `id`, `email`, `name`, `role`, `banned` | 用户主身份；role 区分平台管理员和普通用户；banned 表示账号禁用 |
| `session` | `token`, `expires_at`, `user_id`, `active_organization_id` | 登录会话；active organization 是当前租户选择 |
| `account` | `user_id`, `provider_id`, `account_id` | 密码或外部身份提供商凭据 |
| `verification` | `identifier`, `value`, `expires_at` | 邮箱验证、密码重置等一次性记录 |
| `organization` | `id`, `name`, `slug`, `status` | 一个租户；status 只能是 active/disabled |
| `member` | `organization_id`, `user_id`, `role` | 用户加入组织的关系；role 为 owner/admin/member |
| `invitation` | `organization_id`, `email`, `role`, `status`, `expires_at` | 尚未入组的邀请；接受后才产生 member |

## 关系图

```text
user 1 ─── N session
user 1 ─── N account
user 1 ─── N member N ─── 1 organization
organization 1 ─── N invitation
session.active_organization_id ─── organization.id
```

`session.user_id` 决定谁登录，`active_organization_id` 决定当前操作哪个租户，`member` 决定用户是否属于该租户。

## 业务表租户约束

业务表必须包含非空 `tenant_id`，并外键引用 `organization.id`。当前示例：

- `todos.tenant_id`：Todo 所属组织，不能为空。
- `tenant_notes.tenant_id`：租户笔记所属组织，不能为空。

租户内唯一约束必须包含 `tenant_id`；跨租户关系应使用复合关系，避免错误连接不同组织的数据。

## RLS 和数据库角色

- Better Auth 表不启用 RLS，它们属于认证控制面。
- `todos`、`tenant_notes` 等业务表启用并强制 RLS。
- `app_runtime` 只有业务表 DML 和序列权限，不能绕过 RLS。
- `app_migrator` 专用于 schema/migration 管理。

租户上下文只在事务内设置：

```ts
await withTenantTransaction(database, tenantId, async (tx) => {
  const repository = createTenantTodoRepository(tx, tenantId);
  return repository.list();
});
```

`set_config(..., true)` 只在当前事务有效，连接池复用不会泄漏租户；没有租户上下文时 RLS 默认拒绝访问。

## Migration

```bash
pnpm --filter @full-stack-example/database db:generate
pnpm --filter @full-stack-example/database db:migrate
```

迁移位于 `packages/database/migrations`，包含 Better Auth 表、Organization 状态约束、租户业务表、数据库角色和 RLS 策略。修改 schema 时必须同步审查 migration。

## 开发与测试

```bash
pnpm --filter @full-stack-example/database typecheck
pnpm --filter @full-stack-example/database db:studio
just db-test-integration
```

真实 PostgreSQL 测试覆盖租户 A/B 串租、写入策略、连接池隔离和 Todo RLS。不要在 Web 或 HTTP handler 中直接访问数据库，应把 `TenantTransaction` 注入业务 Repository。
