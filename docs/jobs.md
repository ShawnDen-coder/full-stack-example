# Background jobs

The repository uses one reusable package, `@full-stack-example/jobs`, for BullMQ integration. Domain-level job definitions and execution contracts do not depend on BullMQ; the `server`, `worker`, and `migration` subpaths contain infrastructure adapters. The runtime uses BullMQ's PostgreSQL backend in the `bullmq` schema and the official `@bull-board/hono` adapter.

## Local flow

`just launch` runs the database migrations before starting the API, web app, and a watch-mode jobs worker. With infrastructure already running, use `just dev`. For a production-style worker, build the API package and run `pnpm --filter @full-stack-example/api jobs:worker`.

The API enqueues the example job through `POST /api/admin/jobs/examples`. Bull Board is available at `/admin/queues` to a platform administrator with a fresh session. Its writes require the `XSRF-TOKEN` cookie, matching `x-xsrf-token` header, a same-origin request, and a fresh platform-admin session. Set `BULL_BOARD_CSRF_SECRET` to a random value of at least 32 characters in production.

Worker entrypoints explicitly register definitions. Use `defineJob()` with a Zod schema and processor, group definitions in business modules, then compose them in `apps/api/src/jobs-worker.ts`. A single Worker dispatches by `job.name`, matching BullMQ's documented named-processor pattern. Definitions are explicitly imported; there is no decorator side effect or runtime directory scan. Producer calls take the definition object so the task name and payload type stay linked.

The worker uses BullMQ's Worker lifecycle and closes gracefully on `SIGTERM`. BullMQ provides at-least-once delivery, so handlers must be idempotent. Unknown task names, duplicate registrations, and payloads that fail schema validation are rejected. Queue and worker events flow through the injected LogTape logger.

Bull Board recursively redacts the job payload (`data`) and return value (`returnValue`) before display. Log entries and error text are not passed through those formatters, so handlers must never place credentials or tokens in them.

Completed and failed jobs use lazy cleanup: BullMQ removes them when later jobs complete or fail. A removed ID may be reused, so a BullMQ job ID is not a permanent idempotency record.

`jobs:migrate` uses BullMQ's idempotent, concurrency-safe `runMigrations` API with the migrator connection. It also grants the existing `app_runtime` role access to the `bullmq` schema. The API and worker use `DATABASE_RUNTIME_URL` and never perform DDL.

BullMQ's first enqueue for a queue creates its job-ID sequence. The migration entrypoint hardens BullMQ's `next_job_id` function as a `SECURITY DEFINER` with `search_path = bullmq, pg_temp`, so this one-time sequence creation runs as the migrator-owned function while `app_runtime` retains no schema `CREATE` privilege.
