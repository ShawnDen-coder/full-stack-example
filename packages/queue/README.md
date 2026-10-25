# @my-better-t-app/queue

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

Generic BullMQ infrastructure. This package exports Queue/Worker, Redis
connection options and the native telemetry adapter; business jobs live elsewhere.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/index.ts](src/index.ts) | `createQueueConnection`, `createQueueTelemetry`, Queue/Worker exports |
| [tests/connection.test.mjs](tests/connection.test.mjs) | Initialization/close race regression tests without Redis |
| [Dependency patch notes](../../patches/README.md) | The pinned BullMQ lifecycle fix and removal conditions |

## Extend

1. Add shared connection, retry or telemetry behavior here only when it applies
   across business features. Keep queue names, payloads, retention and processors
   in [business job modules](../business/README.md).
2. Producers use `createQueueConnection(url)` for bounded retries and no offline
   command buffer. Workers use `createQueueConnection(url, "worker")` so blocking
   reads can reconnect without producer command deadlines. Preserve TLS, URL
   credentials and database selection when changing connection parsing.
3. Pass `createQueueTelemetry()` to both producers and consumers. Reuse native
   propagation rather than manually storing trace contexts in business payloads.
4. The creating process owns error listeners and shutdown. Stop queue metric
   observers before closing the queue; do not create clients at module import.
5. When updating BullMQ, check compatibility with `bullmq-otel` and the
   [versioned patch](../../patches/README.md). Test early initialization failure
   and close, not only successful connections.

To add a task, extend business, wire its producer in
[server services](../../apps/server/src/services.ts), and explicitly compose its
consumer in [Worker runtime](../../apps/worker/src/runtime.ts). This package has
no task registration table, and adding a contract alone does not start a consumer.

## Verify

Run from the workspace root:

```bash
pnpm --filter @my-better-t-app/queue test
pnpm --filter @my-better-t-app/queue check-types
```

Connection, retry or propagation changes also require `pnpm test:integration`
with dedicated services. After dependency changes, build and check isolated
server/worker production deployments so the runtime receives the patched,
compatible dependency rather than relying on workspace resolution.
