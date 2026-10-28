# @full-stack-example/domain

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

Business services, scoped data access and business-owned jobs, reusable by HTTP
and Worker processes through injected dependencies.

This package groups modules by domain, including service orchestration, SQL repositories and job adapters. It is not restricted to a pure DDD domain layer.

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
`@full-stack-example/domain/users/jobs/profile-read/producer` (`createProfileReadClient`)
and `.../profile-read/worker` (`createProfileReadWorker`, `createProfileReadProcessor`).
The client accepts `enqueueProfileRead({ userId, requestId })` and
`getProfileReadJob({ userId, jobId })`; status helpers stay internal.
Worker factories return native Workers with `autorun: false` fixed internally.
Add one `consumerDefinitions` entry; runtime handles readiness, run failures and
concurrent drain for the entire group. Extend shared resources only if the new
consumer needs another dependency. `WORKER_CONCURRENCY` is per consumer; review the
sum against database pool and memory capacity. See the
[extension contract](../../docs/extension-design.md).

## Example: rename an owned Todo

This operation is implemented using the existing `todo.text` column, with no
migration or new package export. In [repository.ts](src/todos/repository.ts),
`rename` belongs to the immutable `forUser(userId)` scope alongside `setCompleted`:

```ts
async rename({ id, text }: { id: number; text: string }) {
  const [updated] = await db
    .update(todo)
    .set({ text })
    .where(ownedTodo(id))
    .returning(fields);
  return updated ?? null;
},
```

The corresponding method is part of the returned service object in
[service.ts](src/todos/service.ts):

```ts
async rename({ userId, id, text }: {
  userId: string;
  id: number;
  text: string;
}) {
  const normalized = text.trim();
  if (!normalized || normalized.length > 500) {
    throw new Error("Todo text must contain 1–500 characters");
  }
  return observeOperation("todos.rename", async () =>
    repository.forUser(userId).rename({ id, text: normalized }),
  );
},
```

The service enforces the rule for HTTP and future Worker callers. The repository
owns SQL and ownership; API maps a `null` result to `NOT_FOUND`. The inferred
`TodosService` type picks up the method automatically. Continue with the
[API example](../api/README.md#example-expose-todorename) and
[application walkthrough](../../docs/extension-examples.md#case-1-rename-a-todo).

[Repository tests](tests/todos-repository.test.ts) check both `id` and
`user_id` predicates, independent interleaved owners, and `null` for zero rows.
Service tests cover trimming and empty/overlong text. Integration tests
confirm Alice can rename her Todo and Bob cannot modify or discover it.

## Example: add a profile-summary job

This separate proposed extension reads the same user profile as the existing
job, returning `{ id, summary }` or `null`. It is read-only and can reuse the
Worker's existing users service and database permissions.

Copy all five `src/users/jobs/profile-read.*.ts` files, including the internal
status helper, to `profile-summary.*.ts`. In the copies, update imports and symbols:

| Existing | New |
| --- | --- |
| `profile-read` / `ProfileRead` | `profile-summary` / `ProfileSummary` |
| `USER_PROFILE_QUEUE` / `USER_PROFILE_TASK` | `PROFILE_SUMMARY_QUEUE` / `PROFILE_SUMMARY_TASK` |
| `UserProfileJobData` / `UserProfileJobResult` | `ProfileSummaryJobData` / `ProfileSummaryJobResult` |
| `userProfileJobSchema` / `profileReadJobOptions` | `profileSummaryJobSchema` / `profileSummaryJobOptions` |
| `ProfileJobsUnavailableError` | `ProfileSummaryJobsUnavailableError` |

Keep payload validation (`userId`, optional `requestId`), retries and retention.
Set the new queue to `user-profile-summary` and task to `summary`, leaving the
original job unchanged. Define the new result in the copied contract:

```ts
export type ProfileSummaryJobResult = {
  id: string;
  summary: string;
} | null;
```

In the copied processor, replace only its result projection:

```ts
return profile
  ? {
      id: profile.id,
      summary: profile.emailVerified ? "Verified account" : "Unverified account",
    }
  : null;
```

Preserve owner checks and completed-result reloading in the status helper, the
producer's metrics cleanup/error mapping, and the Worker's telemetry, error
listeners and `autorun: false`. Update task-specific log messages too. Copy
[profile-read tests](tests/profile-read.test.ts) for the new processor/status
helper, covering invalid input, missing users and foreign jobs. The
[background-job walkthrough](../../docs/extension-examples.md#case-2-add-a-background-job)
covers exports, server/API wiring and explicit consumer registration.

## Verify

Run from the workspace root:

```bash
pnpm --filter @full-stack-example/domain test
pnpm --filter @full-stack-example/domain check-types
```

Use `pnpm test:integration` with dedicated PostgreSQL/Redis for changes to SQL,
transactions, job retries or trace propagation. Cover cross-user access and
failure recovery. Worker code must not import API or browser/session modules.

## Roles and page access

[Implementation and extension rules](../../docs/access-control.md).
