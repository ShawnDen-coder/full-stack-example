# Auth 模块（企业内部多租户认证）

`@full-stack-example/auth` 是认证与租户鉴权的独立模块，封装 Better Auth 的邮箱密码、Session、Admin 和 Organization 能力。

## 三种身份

| 身份 | 含义 | 数据来源 |
| --- | --- | --- |
| 用户 | 能登录系统的账号 | `user` |
| 平台管理员 | 管理全平台用户和组织，不自动拥有任何组织数据权限 | `user.role = platform-admin` |
| 租户成员 | 某个 Organization 内的成员，角色为 owner/admin/member | `member` |

平台管理员与组织成员是两条独立关系。平台管理员代建组织时，仍需明确指定首位 owner。

## 服务端接入

```ts
import { createAuthModule, setupAuthApp } from "@full-stack-example/auth";

const auth = createAuthModule({
  database: database.db,
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  trustedOrigins: [process.env.WEB_ORIGIN!],
});
const appWithAuth = setupAuthApp(app, { auth });
```

公开注册已关闭。用户由 `auth.platform.createUser` 创建，再通过密码重置邮件设置初始密码。

## 客户端接入

```ts
import { createAppAuthClient } from "@full-stack-example/auth/client";
const authClient = createAppAuthClient({ baseURL: "http://localhost:3000" });
```

客户端 Organization plugin 负责切换当前组织；服务端以 Session 的 `activeOrganizationId` 为唯一租户选择来源。客户端检查不能代替服务端鉴权。

## 请求鉴权顺序

1. `requireSession`：无有效 Session 返回 `401`。
2. `requireTenant`：重新查询 Session、membership 和 organization。
3. 组织不存在、用户不是成员或组织 `status=disabled` 时拒绝访问。
4. `requirePermission`：按 owner/admin/member 和业务策略判断操作权限。
5. Repository 必须在 `withTenantTransaction` 中执行，数据库 RLS 做最终隔离。

常用守卫：`requirePlatformAdmin`（平台后台）、`requireFreshSession`（敏感操作）、`requirePermission(resource, action)`（资源权限）。

## 安全策略

- Session 默认 7 天有效并定期更新，生产使用 Secure Cookie。
- 启用 CSRF、trusted origins 和 Better Auth 限流。
- `BETTER_AUTH_SECRET` 至少 32 个字符。
- `/api/auth/admin/*` 管理变更端点不对外暴露，统一使用 `PlatformAuthService`。
- 日志不得写入密码、Cookie、Session token 或完整邀请 URL。

## 环境变量

`BETTER_AUTH_URL`（API 地址）、`BETTER_AUTH_SECRET`（至少 32 字符）、`WEB_ORIGIN`（前端来源）和 `DATABASE_URL`（PostgreSQL 连接串）。

## 测试

```bash
pnpm --filter @full-stack-example/auth typecheck
pnpm vitest packages/auth/tests --run
```

设置 `DATABASE_URL` 后会执行真实 PostgreSQL 的用户、组织、登录和 Session 测试。
