# Dependency layers

[English](dependency-layers.md) · [简体中文](dependency-layers.zh-CN.md)

Internal dependencies target only the adjacent lower layer. Explicit same-layer
references are allowed, but the complete graph must be acyclic. L0 means external
libraries, not internal modules: every internal layer may import external libraries.
Composition roots and type-only imports have no exemption from internal layering.

## General Lx rule

```text
Lx -> L(x-1)       allowed: adjacent lower internal layer
Lx/A -> Lx/B       allowed only by explicit grant, without cycles
Lx -> L0          allowed: third-party/platform dependencies
Lx -> L(x-2...)   forbidden for internal targets
Lx -> higher L    forbidden
```

## Project mapping

| Layer | Modules | Responsibility |
| --- | --- | --- |
| L3 | apps/web, apps/server, apps/worker, packages/api | User/transport entry points and process policy |
| L2 | domain, identity, runtime, access, ui | Business, identity, resource assembly, permission contracts and reusable UI |
| L1 | db, queue, observability | Database, queue and instrumentation primitives |
| L0 | External libraries and Node built-ins | Vendor/platform dependencies |

The level describes a dependency boundary, not a required directory depth. UI and
access are L2 reusable application capabilities even when they need no L1 module.
API and application entries share L3; server may use API, while web may import only
its router client type. Worker must not import API. L2 runtime composes domain and
identity; identity uses access; L1 db uses observability. These peer edges are
explicitly allowed, not a general permission to import any peer.

L3 must not import db, queue or observability, including through types or private
paths. Server calls `runtime/server` for resource acquisition and cleanup; Worker
calls `runtime/worker` and still explicitly registers consumers in its own runtime.
HTTP adapters consume identity capabilities rather than SQL. Resource factories
return services and lifecycle operations, not a raw database. Deployment-only
migration/provision/schema capabilities live in `runtime/deployment`.

`runtime/process` owns process logging/telemetry configuration and lifecycle
deadlines; `runtime/http` owns request recording. These are bounded capabilities,
not wildcard re-export barrels for arbitrary L1 operations. Do not create pass-through
exports solely to evade layering. SDKs, pools and consumers are never started at import.

## Enforcement

[scripts/architecture-policy.mjs](../scripts/architecture-policy.mjs) is the single
source for layer assignments and permitted internal edges. `pnpm check:boundaries`
checks production src (including CSS), root JS/TS configs, package dependency fields
(including dev/peer/optional dependencies), TypeScript project references, public
exports and cycles. Type imports, re-exports, literal dynamic imports and require
are checked equally. Adding an allowlist entry cannot authorize a skipped layer.

Tests/fixtures and root development tooling are a separate harness, not shipped
application modules. Cross-layer integration-test dependencies are declared in the
root devDependencies, never in production application manifests. Production imports
are still rejected even if Node can resolve a root harness dependency. The scanner
is static: computed module specifiers and arbitrary runtime loading are not supported;
do not use them for internal module loading. It does not prove semantic business isolation.

When adding a module, assign a positive layer, grant the narrow public edges, update
project references, and add a boundary regression test. Do not relabel a module L0,
flatten layers, or add a composition-root exception to make a failing check pass.
