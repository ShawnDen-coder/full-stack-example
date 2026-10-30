# Workspace access

[简体中文](access-control.zh-CN.md)

Better Auth Organization is the workspace model. Global `user.role=superadmin`
permits platform management; local owner/admin/member roles govern one workspace.
A workspace owner does not become a platform superadmin. A platform superadmin
cannot read workspace business data without membership and applicable grants.

## User flow

The sidebar switcher lists memberships. `/apps?workspace=<id>` is the tool home;
links retain the explicit URL scope and every Todo RPC captures `workspaceId` in its
input. A workspace is never selected through shared session mutable state, so tabs
can operate independently. Switching clears query state and rejects late oRPC
responses; Todo query keys and editor lifetimes include the workspace.

Tool home uses existing theme, Sidebar and Card components. Cards are three columns
on wide content, two on medium content and one on phones. Desktop double-click,
keyboard activation and touch click open a full tool page. The Hammer is a neutral
fallback logo. Only real enabled tools appear. Template examples remain separate.
The former Tasks demo is not a workspace task center.

## Management and authorization

- `/workspaces`: platform metadata list, transactional creation with an existing
  account owner, and tool enable/disable. Creator membership is never implicit.
- `/admin/users?workspace=<id>`: local owner/admin adds existing accounts by exact
  email and manages native page-role templates. Only owners may manage admins.
- `/queues`: platform-only operational monitoring, outside workspace tool grants.
- Todo: membership **and** enabled configuration **and** native page permission;
  domain SQL additionally filters workspace and authenticated owner on every operation.
- Missing tool configuration denies access, including owner/admin. Disable preserves
  data and role grants; re-enable restores access subject to current membership.
- New accounts have no automatic workspace membership. Settings and a waiting state
  remain accessible. No organization/owner removal or transfer API is exposed.

Native Organization writes are allowlisted. Unsupported creation/update/invitation/
removal paths reject requests; member/role mutations require an explicit organization
and same-scope target. Dynamic templates cannot grant platform or administrative
capabilities. The standard role cannot be deleted. Owner accounts cannot be banned
or removed via the Admin API while they own workspaces.

## Deployment

1. Apply committed migrations with deployment credentials. Existing Todo records
   are assigned to `application`; ownerless rows remain inaccessible.
2. Run runtime role provisioning to grant the server access to `workspace_tool`.
3. To initialize a fresh installation, register an account and run
   `pnpm admin:bootstrap <user-id>` with deployment `DATABASE_URL`; sign in again.
4. Create workspaces through `/workspaces` and specify the owner account email.

Migration unique constraints deliberately reject duplicate memberships/role names.
Resolve legacy duplicates before rollout. No future Todo insert defaults to a workspace.

## Extend and verify

Add a tool key and metadata, schema-backed enabled configuration, native role grants,
workspace-aware RPC input and immutable domain scope. Do not merely add a menu entry.
Worker contracts/registration stay in domain and worker; workspace scheduling, outbox,
email invitations, owner transfer and workspace deletion are outside this increment.

Run install, unit tests, type checks, build and Biome. Dedicated PostgreSQL/Redis
integration tests cover multi-workspace CRUD, metadata visibility, creation rollback,
raw native endpoint bypass, tool disable, and removed membership. Browser tests cover
real creation, switching, double-click/keyboard entry, sidebar selection and layouts.

Bootstrap only assigns the platform role by default. To explicitly grant ownership of
an existing workspace as well, use `pnpm admin:bootstrap <user-id> --workspace-owner <workspace-id>`.

Workspace creation and account bans share a row-lock protocol: [`workspaces.ts`](../packages/api/src/workspaces.ts) and [`auth.ts`](../packages/api/src/auth.ts) lock the same target user row and recheck and write inside the transaction. An owner cannot be banned, and a banned user cannot become an owner. New paths must follow this protocol; an outside-transaction check is insufficient, and the lock does not replace authorization. See the [concurrency integration test](../apps/server/tests/integration/workspaces.test.ts).
