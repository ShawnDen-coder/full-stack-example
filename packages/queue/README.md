# @full-stack-example/queue

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

Generic BullMQ infrastructure. This package exports Queue/Worker, Redis
connection options and the native telemetry adapter; business jobs live elsewhere.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/index.ts](src/index.ts) | `createQueueConnection`, `createQueueTelemetry`, Queue/Worker exports |
| [tests/connection.test.mjs](tests/connection.test.mjs) | Initialization/close race regression tests without Redis |

## Extend

1. Add shared connection, retry or telemetry behavior here only when it applies
   across business features. Keep queue names, payloads, retention and processors
   in [domain job modules](../domain/README.md).
2. Producers use `createQueueConnection(url)` for bounded retries and no offline
   command buffer. Workers use `createQueueConnection(url, "worker")` so blocking
   reads can reconnect without producer command deadlines. Preserve TLS, URL
   credentials and database selection when changing connection parsing.
3. Pass `createQueueTelemetry()` to both producers and consumers. Reuse native
   propagation rather than manually storing trace contexts in business payloads.
4. The creating process owns error listeners and shutdown. Stop queue metric
   observers before closing the queue; do not create clients at module import.
5. When updating BullMQ, check compatibility with `bullmq-otel` and the explicit
   `ioredis` peer dependency. BullMQ 6.4.2 guards late initialization error emissions
   after close, replacing our former 5.81.5 patch (see [upstream issue #3546](https://github.com/taskforcesh/bullmq/issues/3546)).
   Test early initialization failure and close, not only successful connections.
   Worker readiness accesses Redis through `worker.getBackend().client` in v6.

To add a task, extend domain, wire its producer in
[server services](../../apps/server/src/services.ts), and explicitly compose its
consumer in [Worker runtime](../../apps/worker/src/runtime.ts). This package has
no task registration table, and adding a contract alone does not start a consumer.

## Example: make the connection timeout configurable

Suppose several producers/consumers need a different Redis connection timeout.
Extend the existing `createQueueConnection` factory in [src/index.ts](src/index.ts)
with an optional third parameter (this option does not exist yet):

```ts
options: { connectTimeoutMs?: number } = {},
```

Before constructing the returned connection object, validate the value:

```ts
const connectTimeout = options.connectTimeoutMs ?? 5000;
if (!Number.isInteger(connectTimeout) || connectTimeout <= 0) {
  throw new Error("Redis connection timeout must be a positive integer");
}
```

Replace only `connectTimeout: 5000` with `connectTimeout` in the returned object.
Keep URL/TLS/credential parsing, producer command deadlines and the Worker's
`maxRetriesPerRequest: null` behavior. Existing two-argument callers keep working;
new callers inside business-owned job factories can use:

```ts
createQueueConnection(redisUrl, "worker", { connectTimeoutMs: 8000 });
```

Pass a setting through application config and factory parameters if it must vary
by deployment; do not read app env files in this package. Add tests alongside
[connection tests](tests/connection.test.mjs) for the default, override, invalid
values, TLS and both roles. Existing initialization/close regression tests must
still pass. A new business task instead follows the
[job example](../../docs/extension-examples.md#case-2-add-a-background-job), without
adding its contract or registry to queue.

## Verify

Run from the workspace root:

```bash
pnpm --filter @full-stack-example/queue test
pnpm --filter @full-stack-example/queue check-types
```

Connection, retry or propagation changes also require `pnpm test:integration`
with dedicated services. After dependency changes, build and check isolated
server/worker production deployments so the runtime receives compatible BullMQ,
telemetry and Redis driver dependencies rather than relying on workspace resolution.
