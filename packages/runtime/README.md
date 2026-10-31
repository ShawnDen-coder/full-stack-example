# @full-stack-example/runtime

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

L2 resource assembly and operational capabilities. Imports L1 infrastructure and explicitly allowed L2 identity/domain peers; never imports API or an application.

## Public capabilities

`./server` creates HTTP process services and bounded startup cleanup. `./worker` creates independent worker DB/services. `./process` configures logger/telemetry and deadlines. `./http` records requests. `./queue-monitor` owns read-only queue projection. `./queue-summaries` projects safe fields. `./deployment` owns migrations, runtime-role provisioning and auth-schema generation.

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
