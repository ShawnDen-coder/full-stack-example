# @full-stack-example/identity

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

L2 identity and workspace capabilities. Owns Better Auth configuration, native permission checks, workspace membership transactions and the owner-row lock protocol.

## Public capabilities

`./auth` creates Better Auth from an injected database. `./access` exposes the authorization/workspace facade. SQL and transaction behavior moved from API without changing endpoint contracts.

Workspace basics are updated atomically through the workspace service. Platform
superadmins and the target workspace's owner/admin may change name and logo;
slug remains immutable. The server accepts static PNG/WebP data URLs up to 32 KiB
and 256 × 256 pixels, fully decodes and re-encodes them as WebP without metadata.
Animated PNG input is rejected. Saving an unchanged logo preserves its exact bytes;
changing only the name does not recompress it. Read access is limited to platform
administrators or members.

## Extend

Follow the [layer policy](../../docs/dependency-layers.md). Add narrow public exports,
not infrastructure re-export barrels. Factories take explicit configuration and
injected dependencies; imports never acquire resources. Preserve transaction/lock
boundaries and return service capabilities rather than raw infrastructure handles.
Applications still own invocation, signals and shutdown. Consumer registration stays
in `apps/worker/src/runtime.ts`; adding a factory does not register a consumer.

Update both guides and run `pnpm check:boundaries`, `pnpm test`, `pnpm check-types`
and `pnpm build`. Auth, SQL, queue and resource changes also require dedicated
`pnpm test:integration` and `pnpm test:e2e` services. Existing server/worker tests
exercise these capabilities through their application integration points.
