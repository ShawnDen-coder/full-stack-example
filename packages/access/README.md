# @full-stack-example/access

[English](README.md) · [简体中文](README.zh-CN.md)

Browser-safe page/navigation contracts and Better Auth plugin role declarations.
`./auth` defines Organization access control and separate global Admin roles.
There are no database resources or custom permission evaluators in this package.

## Extend

Add a page to pageKeys and pages, protect backing APIs with pageProcedure, then
grant read through native dynamic roles. Missing dynamic grants deny access.
`queues` is platform-only at `/queues`; workspace role grants never authorize it.
canVisit and landingPath consume a server snapshot; they never authorize APIs.
Keep settings/help accessible and preserve owner-scoped business queries.

See [architecture](../../docs/access-control.md). Validate with the package tests
and pnpm check-types.


`/apps` is the authenticated shell entry for every account. The `apps` page grant controls `/apps/integrations-demo`; unknown `/apps/*` paths remain denied. New tools need a stable page key and path, a web catalog entry and route, and a corresponding API page authorization. Keep owner scope in domain and explicitly register any new worker consumer.

## Workspace scope

`Access.platformRole` describes the account; `workspaceRole` describes membership in
`organizationId`. Owners are workspace administrators, never platform superadmins.
`workspaceToolKeys` lists real tools. New tools need a configuration row with
`enabled=true`, a role grant, catalog metadata, and workspace-scoped API/data access.
Missing configuration denies access. `/workspaces` and `/queues` require the platform
role. `/apps` remains available for users awaiting membership.

## Lx

L2. [Dependency policy / 依赖规则](../../docs/dependency-layers.md).
