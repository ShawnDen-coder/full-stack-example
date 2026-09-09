# Auth package

`@full-stack-example/auth` is the server/client boundary for internal multi-tenant authentication. It wraps Better Auth Organization and Admin plugins while keeping platform administration and tenant authorization explicit.

## Server setup

Create the module once at the API composition root and mount it with `setupAuthApp`:

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

Public signup is disabled. Accounts are provisioned by `auth.platform.createUser`; call `requestPasswordReset` to send the first password setup/reset email.

## Client setup

```ts
import { createAppAuthClient } from "@full-stack-example/auth/client";
const authClient = createAppAuthClient({ baseURL: "http://localhost:3000" });
```

Use the Organization client plugin to select the active organization. The server always revalidates the session, membership, and organization status; client checks are only for UI behavior.

## Authorization

Use `requireSession`, `requireTenant`, `requirePermission`, `requirePlatformAdmin`, and `requireFreshSession` in route composition. `requireTenant` derives the tenant from Better Auth's `activeOrganizationId` and exposes a `TenantPrincipal` in the request context.

Platform Admin HTTP mutation routes are intentionally hidden. Use `PlatformAuthService` for user provisioning, organization creation, status changes, and password resets.

## Environment

Required values are documented in the repository `.env.example`:

- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET` (at least 32 characters)
- `WEB_ORIGIN`

## Testing

```bash
pnpm --filter @full-stack-example/auth typecheck
pnpm vitest packages/auth/tests --run
```
