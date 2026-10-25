# Module extension examples

[English](extension-examples.md) · [简体中文](extension-examples.zh-CN.md) · [Development guide](development.md) · [Project overview](../README.md)

These are implementation walkthroughs built from the current Todo and profile-job
code. The proposed operations below are not already available. Apply each case
as one coordinated change; snippets explicitly identify their insertion points.
Commands run from the repository root unless stated otherwise.

Read the [architecture diagrams](development.md#architecture-overview) first to
trace the current Todo request and profile-job flow before extending them.

## Choose an example

| Change | Start here | Result to verify |
| --- | --- | --- |
| Rename an owned Todo | [Business](../packages/business/README.md#example-rename-an-owned-todo), [API](../packages/api/README.md#example-expose-todorename), case 1 below | User-scoped SQL through a typed browser mutation |
| Add a background job | [Business job](../packages/business/README.md#example-add-a-profile-summary-job), case 2 below | Server enqueues; independent Worker processes; owner reads status |
| Add a database field | [DB due-date example](../packages/db/README.md#example-add-an-optional-todo-due-date) | Reviewed migration and upgrade without losing old rows |
| Extend queue infrastructure | [Queue timeout example](../packages/queue/README.md#example-make-the-connection-timeout-configurable) | Both connection roles retain their retry behavior |
| Add a metric | [Observability export-size example](../packages/observability/README.md#example-measure-generated-export-size) | Bounded attributes and working business code without a Collector |
| Add a shared component | [UI PendingButton example](../packages/ui/README.md#example-add-a-shared-pendingbutton) | Accessible busy state; web retains business behavior |

## Case 1: rename a Todo

The user edits their own Todo text. Request input is `{ id, text }`; the result
remains `{ id, text, completed }`. No schema change is involved.

| Location | Concrete change |
| --- | --- |
| `packages/business/src/todos/repository.ts` | Add `rename` inside `forUser`, using `ownedTodo(id)` and the existing projection |
| `packages/business/src/todos/service.ts` | Validate/normalize text and observe `todos.rename` |
| `packages/api/src/routers/todo.ts` | Add the authenticated `rename` procedure and map no match to `NOT_FOUND` |
| `apps/server/src/services.ts` | Reuse the existing `createTodosService({ db })` instance |
| `apps/web/src/routes/_auth/todos.tsx` | Add an edit form and typed mutation; preserve identity-scoped cache invalidation |

First apply the [repository/service example](../packages/business/README.md#example-rename-an-owned-todo),
then the [API example](../packages/api/README.md#example-expose-todorename).
`Services.todosService` already uses the inferred `TodosService`, and
`appRouter.todo` is already mounted. Adding this operation needs no new server
client, `Services` property or package export. Update typed service fakes in tests.

In `TodosRoute`, add this alongside the existing mutations, after `refresh`:

```ts
const renameMutation = useMutation(
  orpc.todo.rename.mutationOptions({
    retry: false,
    onSuccess: refresh,
  }),
);
```

Include `renameMutation.isPending` in the existing `busy` expression. A new row
edit form should keep its own draft text, provide a labelled input, and submit
only when `!busy` and the trimmed value has 1–500 characters:

```ts
renameMutation.mutate({ id: todo.id, text: draftText });
```

Here `todo` is the rendered row and `draftText` is its local edit state; these
are not new router-context fields. Use the
[PendingButton example](../packages/ui/README.md#example-add-a-shared-pendingbutton)
if the busy behavior is shared by several forms. Keep drafts on failure; the
existing mutation error handler displays the failure. Preserve
`["user", userId, "todos"]` as the cache prefix and let `refresh` invalidate all
pages for that user. Never add an owner field to the request.

For a genuinely new service rather than a method, the server wiring expands:
add its business package export, construct its factory in `createServices`, add
its concrete type to API `Services`, include the instance in the returned
`services`, and register its router in `appRouter`. A service sharing `db` must
not close it. New owned clients need readiness, constructor rollback and drain
cleanup, with database close after dependent resources.

Run `pnpm check-types`, `pnpm check:boundaries` and `pnpm test`. With dedicated
`TEST_DATABASE_URL`/`TEST_REDIS_URL`, run `pnpm test:integration` and
`pnpm test:e2e`. Verify Alice's edit persists after reload, Bob cannot read or
rename Alice's Todo, invalid text never reaches SQL, and failed writes keep the
draft. Update the existing server tests and `apps/web/tests/session.spec.ts`.

## Case 2: add a background job

Create a separate `profile-summary` task that reads the current profile and
returns a verification summary. Start by implementing the five files described
in the [business job example](../packages/business/README.md#example-add-a-profile-summary-job).
Do not rename the existing queue or change its pending jobs.

Add these entries to the existing `exports` object in `packages/business/package.json`:

```json
"./users/jobs/profile-summary/contract": "./src/users/jobs/profile-summary.contract.ts",
"./users/jobs/profile-summary/producer": "./src/users/jobs/profile-summary.producer.ts",
"./users/jobs/profile-summary/worker": "./src/users/jobs/profile-summary.worker.ts"
```

Processor and status files remain internal. The producer exports
`createProfileSummaryClient`, `ProfileSummaryClient` (inferred with `ReturnType`)
and `ProfileSummaryJobsUnavailableError`. Keep the copied, renamed client type
alias (do not append a second declaration):

```ts
export type ProfileSummaryClient = ReturnType<typeof createProfileSummaryClient>;
```

In `apps/server/src/services.ts`, import the new client factory from its public
producer subpath and create it inside the existing startup `try` block:

```ts
const profileSummaryJobs = createProfileSummaryClient({
  redisUrl: config.REDIS_URL,
  logger,
});
```

Include it in the returned `services`. Extend `checkJobsReady` to check both
clients, and close both before the database. Update constructor rollback as well
as normal shutdown: failure creating the second client must close the first;
one failed close must not skip the other. Do not put either client in core
`checkReady`; Redis remains optional for ordinary API requests.

In `packages/api/src/context.ts`, import `ProfileSummaryClient` using `import type`
and add this field to `Services`:

```ts
profileSummaryJobs: Pick<
  ProfileSummaryClient,
  "enqueueProfileSummary" | "getProfileSummaryJob"
>;
```

In `src/routers/users.ts`, import the new unavailable error and extend
`withProfileJobs` to map either unavailable-error class to `SERVICE_UNAVAILABLE`.
Then add these properties to `usersRouter`:

```ts
enqueueProfileSummary: protectedProcedure.handler(({ context }) =>
  withProfileJobs(() => context.services.profileSummaryJobs.enqueueProfileSummary({
    userId: context.session.user.id,
    requestId: context.requestId,
  })),
),
getProfileSummaryJob: protectedProcedure
  .input(z.object({ id: z.string().min(1).max(128) }))
  .handler(async ({ input, context }) => {
    const job = await withProfileJobs(() =>
      context.services.profileSummaryJobs.getProfileSummaryJob({
        jobId: input.id,
        userId: context.session.user.id,
      }),
    );
    if (!job) throw new ORPCError("NOT_FOUND");
    return job;
  }),
```

In `apps/worker/src/runtime.ts`, import the contract and Worker factory through
their new public subpaths. Append this object to `consumerDefinitions` alongside
the existing profile consumer:

```ts
{
  name: PROFILE_SUMMARY_QUEUE,
  concurrency: 2,
  create: ({ redisUrl, services, concurrency, logger }) =>
    createProfileSummaryWorker({
      redisUrl,
      usersService: services.usersService,
      concurrency,
      logger,
    }),
},
```

The same users service is already in `WorkerServices`, so no new shared resource
or API dependency is needed. Keep `autorun: false` in the business factory;
runtime owns starting, readiness, fatal-loop handling and parallel drain. With
the existing default concurrency of 5, this example has a total of 7 across the
two consumers; review pool capacity. No scheduler is created by registration.

After server and worker restart, an authenticated client can call:

```ts
const job = await client.users.enqueueProfileSummary();
const status = await client.users.getProfileSummaryJob({ id: job.id });
```

Poll status with a deadline; it need not be completed immediately. The result is
`null` until completion or when the user no longer exists. Foreign/missing jobs
return `NOT_FOUND`; Redis failure returns `SERVICE_UNAVAILABLE`.

Run the same offline checks as case 1. With dedicated test services, extend
`apps/server/tests/integration/application.test.ts` to enqueue/complete the new
task, reject another user's status request, retain retries and close both
consumers before database shutdown. Add startup-failure/cleanup tests for the
new server client and update typed service fakes. If the new task needs new
tables instead, separately review worker grants and service/resource injection;
the Worker role currently reads only user profiles.
