# @my-better-t-app/business

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

Business services, scoped data access and business-owned jobs, reusable by HTTP
and Worker processes through injected dependencies.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/todos/service.ts](src/todos/service.ts) | Operations, cursor pagination and operation telemetry |
| [src/todos/repository.ts](src/todos/repository.ts) | SQL, projections and immutable `forUser(userId)` scopes |
| [src/users/service.ts](src/users/service.ts) | A small query that does not need a separate repository |
| [src/users/jobs/profile-read.contract.ts](src/users/jobs/profile-read.contract.ts) | Queue/task names, Zod payload, result type and retry/retention defaults |
| [src/users/jobs/profile-read.producer.ts](src/users/jobs/profile-read.producer.ts) | Enqueue, status access, queue observation and cleanup |
| [src/users/jobs/profile-read.processor.ts](src/users/jobs/profile-read.processor.ts) | Payload validation and business execution without a Worker connection |
| [src/users/jobs/profile-read.worker.ts](src/users/jobs/profile-read.worker.ts) | Consumer factory, attempt logs and metrics |

## Extend

1. Add a feature directory with a `create...Service` factory and infer its type
   with `ReturnType`. Service, Repository and job factories take one named
   dependency object, e.g. `createTodosRepository({ db: tx })`. Use named objects
   for multiple business fields (`service.setCompleted({ userId, id, completed })`);
   single IDs can stay primitive (`forUser(userId)`). Inject clients; importing the module must not open resources.
2. Add a scoped `repository.ts` when ownership filters repeat. Bind the trusted
   owner once with `forUser(userId)`, enforce it on reads and writes, and assign
   it explicitly on insert. Return data rather than a mutable query builder.
3. Keep simple queries in the service. For multi-statement use cases, open a
   transaction at the service boundary and pass the same `tx` to repositories.
   Keep network calls and queue publishing outside database transactions; design
   an outbox if a new use case requires atomic database writes and job delivery.
4. Wrap named business operations with `observeOperation`. Keep RPC errors and
   sessions in API, and add only required subpaths to [exports](package.json).
5. Wire HTTP services through [API](../api/README.md) and
   [server services](../../apps/server/src/services.ts).

For a new job, follow the `users/jobs` files: define the contract, validate inputs,
implement the processor, producer and Worker factory, and enforce ownership when
returning job status/results. Handlers must tolerate retries; choose bounded
retention and safe result fields. Reuse [queue infrastructure](../queue/README.md).
Register consumers explicitly in [Worker runtime](../../apps/worker/src/runtime.ts).
Use task-specific exports such as
`@my-better-t-app/business/users/jobs/profile-read/producer` (`createProfileReadClient`)
and `.../profile-read/worker` (`createProfileReadWorker`, `createProfileReadProcessor`).
The client accepts `enqueueProfileRead({ userId, requestId })` and
`getProfileReadJob({ userId, jobId })`; status helpers stay internal.
Worker factories return native Workers with `autorun: false` fixed internally.
Add one `consumerDefinitions` entry; runtime handles readiness, run failures and
concurrent drain for the entire group. Extend shared resources only if the new
consumer needs another dependency. `WORKER_CONCURRENCY` is per consumer; review the
sum against database pool and memory capacity. See the
[extension contract](../../docs/extension-design.md).

## Verify

Run from the workspace root:

```bash
pnpm --filter @my-better-t-app/business test
pnpm --filter @my-better-t-app/business check-types
```

Use `pnpm test:integration` with dedicated PostgreSQL/Redis for changes to SQL,
transactions, job retries or trace propagation. Cover cross-user access and
failure recovery. Worker code must not import API or browser/session modules.
