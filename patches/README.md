# Dependency patches

`bullmq@5.81.5.patch` fixes connection teardown during initialization in both
CommonJS and ESM builds. `RedisConnection.close()` must settle the in-flight
initialization after disconnecting, before removing error listeners. Otherwise
the constructor's initialization error handler emits into an EventEmitter with
no listeners and creates an unhandled rejection after shutdown completes.

This affects fast startup failures, such as PostgreSQL rejecting a connection
while the queue's Redis handshake is still running. See the related
[upstream issue](https://github.com/taskforcesh/bullmq/issues/3546).

The patch is registered in `pnpm-workspace.yaml` and hashed in `pnpm-lock.yaml`.
Do not edit installed `node_modules` files. When upgrading BullMQ, remove this
patch only after an equivalent upstream fix passes `pnpm --filter
@my-better-t-app/queue test` and the PostgreSQL/Redis integration suite.
