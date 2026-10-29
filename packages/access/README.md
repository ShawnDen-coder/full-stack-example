# @full-stack-example/access

[English](README.md) · [简体中文](README.zh-CN.md)

Browser-safe page/navigation contracts and Better Auth plugin role declarations.
`./auth` defines Organization access control and separate global Admin roles.
There are no database resources or custom permission evaluators in this package.

## Extend

Add a page to pageKeys and pages, protect backing APIs with pageProcedure, then
grant read through native dynamic roles. Missing dynamic grants deny access.
`queues` follows that path at `/queues` so it is not treated as an `/admin` role page.
canVisit and landingPath consume a server snapshot; they never authorize APIs.
Keep settings/help accessible and preserve owner-scoped business queries.

See [architecture](../../docs/access-control.md). Validate with the package tests
and pnpm check-types.


`/apps` is the authenticated shell entry for every account. The `apps` page grant controls `/apps/integrations-demo`; unknown `/apps/*` paths remain denied. New tools need a stable page key and path, a web catalog entry and route, and a corresponding API page authorization. Keep owner scope in domain and explicitly register any new worker consumer.
