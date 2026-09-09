# Database 模块（字段语义与关系说明）

`@full-stack-example/database` 负责 PostgreSQL 连接、Drizzle schema、migration、健康检查，以及 Better Auth 持久化表。Auth 模块通过 Drizzle adapter 使用这些表。

## 职责边界

统一持有所有数据库 schema、迁移和连接工厂；不负责 HTTP 鉴权决策。运行时连接由 API、Auth 和 Repository 共用，迁移连接只用于 DDL。

## 对外接口

`createDatabase` 创建连接池，`migrateDatabase` 执行迁移，`withTenantTransaction` 设置事务级租户上下文；schema 表从包根导出供 Repository 使用。

## 依赖关系

Database 是底层基础设施包，不依赖 Auth、Todos 或任何 App。Auth 使用认证表，业务 Repository 使用业务表和 `TenantTransaction`。

## 启动流程

```ts
await migrateDatabase({
  databaseUrl: process.env.DATABASE_MIGRATOR_URL!,
  migrationsFolder: defaultMigrationsFolder,
});

const database = createDatabase({
  databaseUrl: process.env.DATABASE_RUNTIME_URL!,
});

// 把 database.db 注入 Auth、Service 和健康检查。
// 进程退出时：
await database.close();
```

迁移连接只在启动阶段短暂使用；应用监听端口后只保留 runtime 连接。

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
| `todos` | `id`, `tenant_id`, `title`, `completed` | 租户业务数据；`tenant_id` 决定归属，`title` 是任务标题，`completed` 表示是否完成 |

## 关系图

```text
user 1 ─── N session
user 1 ─── N account
user 1 ─── N member N ─── 1 organization
organization 1 ─── N invitation
organization 1 ─── N todos
session.active_organization_id ─── organization.id
```

`session.user_id` 决定谁登录，`active_organization_id` 决定当前操作哪个租户，`member` 决定用户是否属于该租户。

## 业务表租户约束

业务表必须包含非空 `tenant_id`，并外键引用 `organization.id`。当前示例：

- `todos.tenant_id`：Todo 所属组织，不能为空。

租户内唯一约束必须包含 `tenant_id`；跨租户关系应使用复合关系，避免错误连接不同组织的数据。

## RLS 和数据库角色

- Better Auth 表不启用 RLS，它们属于认证控制面。
- `todos` 等业务表启用并强制 RLS。
- `app_runtime` 只有业务表 DML 和序列权限，不能绕过 RLS。
- `app_migrator` 专用于 schema/migration 管理。

租户上下文只在事务内设置：

```ts
await withTenantTransaction(databaseContext.db, tenantId, async (tx) => {
  const repository = createTenantTodoRepository(tx, tenantId);
  return repository.list();
});
```

`set_config(..., true)` 只在当前事务有效，连接池复用不会泄漏租户；没有租户上下文时 RLS 默认拒绝访问。

## 连接串与 Migration

运行时和迁移必须使用不同数据库账号：

- `DATABASE_RUNTIME_URL`：API、Better Auth、业务 Repository 使用，只能执行允许的 DML，并受业务表 RLS 保护。
- `DATABASE_MIGRATOR_URL`：只由 migration 使用，拥有 DDL/schema 权限。
- `DATABASE_URL`：仅作为本地开发兼容回退，不应在生产使用超级用户连接。

```bash
pnpm --filter @full-stack-example/database db:generate
pnpm --filter @full-stack-example/database db:migrate
```

迁移位于 `packages/database/migrations`，包含 Better Auth 表、Organization 状态约束、租户业务表、数据库角色和 RLS 策略。修改 schema 时必须同步审查 migration。

新增或修改业务表时按以下顺序操作：

1. 修改 `src/schema`。
2. 执行 `db:generate` 并人工审查 SQL。
3. 确认遗留数据如何获得 `tenant_id`，禁止猜测性回填。
4. 添加 runtime DML、序列权限和强制 RLS。
5. 使用 migrator 执行迁移，再使用 runtime 账号跑隔离测试。

## 错误与边界行为

- `withTenantTransaction` 收到空 `tenantId` 会立即失败。
- 未设置 `app.tenant_id` 时，业务表 RLS 默认拒绝访问。
- runtime 账号不得执行 DDL、关闭 RLS、`SET ROLE` 为 migrator 或绕过 RLS。
- Better Auth 表属于控制面，不启用 RLS，但 runtime 账号只获得所需 CRUD 权限。

## 开发与验证

```bash
pnpm --filter @full-stack-example/database typecheck
pnpm --filter @full-stack-example/database db:generate
pnpm --filter @full-stack-example/database db:migrate
pnpm --filter @full-stack-example/database db:studio
just db-test-integration
```

真实 PostgreSQL 测试覆盖租户 A/B 串租、写入策略、连接池隔离和 Todo RLS。不要在 Web 或 HTTP handler 中直接访问数据库。

## 扩展规则

新增业务表必须有非空 `tenant_id`、组织外键、显式租户条件和强制 RLS；不得把运行时连接升级为 DDL、SUPERUSER 或 BYPASSRLS 角色。
