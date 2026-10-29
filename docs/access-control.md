# Roles and page access

[English](access-control.md) · [简体中文](access-control.zh-CN.md)

Authorization uses Better Auth's official Organization plugin with dynamic access
control. One fixed internal organization (`application`) scopes the application.
There is no organization creation/switching UI. Better Auth stores memberships in
`member` and editable permissions in `organization_role`; the application has no
parallel permission tables or permission evaluator.

## Roles

| Role | Responsibility |
| --- | --- |
| `owner` | Workspace super administrator; appoint/demote administrators |
| `admin` | Edit page-role templates and assign them to ordinary members |
| `member` | Ordinary user identity; no page access by itself |
| Dynamic roles, initially `standard` | Sets of page `read` permissions |

Members can hold multiple roles; permissions are additive, as defined by Better
Auth. There is no per-user deny override or independent delegation scope. To
restrict a member, remove broader roles before assigning a narrower role. Editing
a template changes every member holding it. Admins and owners can use all registered
pages; they still obey Todo data ownership.

Registration enrolls users as `member,standard`. The migration seeds `standard`
with the existing five pages and enrolls existing users and sessions, preserving
access on upgrade. Future pages must be explicitly added to dynamic roles.
`queues` is one of those later pages: owners and admins receive it from the
static role definitions, and `standard` does not include it until an administrator
grants it.
`standard` cannot be deleted, and editable role keys cannot be renamed.

The Admin plugin is separate: `user.role` is the global account-management role,
not the workspace role. Bootstrap grants `superadmin` limited native account
list/get/ban and session list/revoke permissions. Ordinary workspace admins do not
receive global account permissions. No blanket `/admin/*` interception exists.

## Initialize

1. Run `pnpm db:migrate` using deployment credentials.
2. Register the intended owner normally and obtain the user ID.
3. Run `pnpm admin:bootstrap <user-id>` with deployment `DATABASE_URL`.
4. Sign in again and open `/admin/users`.

Bootstrap atomically provisions the first workspace owner and global superadmin,
revokes their sessions and refuses if a global superadmin already exists. Workspace
owner membership is immutable through HTTP; planned owner changes require deployment
provisioning. This avoids concurrent last-owner removal without replacing native
role mutations with a custom transaction engine.

## Enforcement and extension

- `packages/access` declares pages, navigation mapping and native plugin roles.
- `packages/api/src/auth.ts` configures plugins and narrow policy hooks: only owners
  manage admins; dynamic templates contain page-read permissions only; owner and
  registration-role protections. The native plugin validates and persists mutations.
- `packages/api/src/access.ts` adapts native `getActiveMember` and `hasPermission`
  responses into a navigation snapshot. It does not compute role inheritance.
- oRPC `access.me` returns this snapshot; management calls use native
  `/api/auth/organization/*` endpoints. `pageProcedure(key)` checks server-side
  permissions on each request, while Todo repositories still enforce ownership.
- Better Auth UI's role editor, member-role dialog and data hooks are reused with
  the existing Radix components. See [source and adaptations](../third-party/better-auth-ui.md).
- Worker receives no grants to organization tables and imports no API modules.

To add a page, declare its key/path in `packages/access`, protect all backing
operations with `pageProcedure`, and grant it to the desired dynamic roles through
the admin screen. Menus, search and routes consume the same server snapshot.
Settings/help remain available. Access refreshes on navigation, focus and API 403;
changed access clears business-query caches. An idle browser is not push-cleared.
The dashboard, integration examples, tasks and chats remain demo screens.

## Verify

Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm check-types`, `pnpm build`,
`pnpm exec biome check .`, then integration/E2E against dedicated
`TEST_DATABASE_URL`/`TEST_REDIS_URL`. Browser tests require a disposable database
without an existing superadmin. Tests cover native endpoint escalation attempts,
registration injection, role revocation, actual UI assignment and Todo API denial.


The authenticated `/apps` tool center is available without page grants. The existing `apps` grant controls `/apps/integrations-demo`; unknown child routes remain denied. Add new tools to the web catalog and route, access policy, page-protected API and owner-scoped domain, and register any worker consumer explicitly.
