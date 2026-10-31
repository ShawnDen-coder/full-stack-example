# @full-stack-example/identity

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

L2 identity and workspace capabilities. Owns Better Auth configuration, native permission checks, workspace membership transactions and the owner-row lock protocol.

## Public capabilities

`./auth` creates Better Auth from an injected database. `./access` exposes the authorization/workspace facade. SQL and transaction behavior moved from API without changing endpoint contracts.

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
