# @full-stack-example/api

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

HTTP and authentication boundaries for the server: Hono composition, Better Auth,
oRPC input validation, session resolution and transport error mapping.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/create-api.ts](src/create-api.ts) | Build the Hono app from injected dependencies; HTTP middleware and health routes |
| [src/context.ts](src/context.ts) | `Services`, session, request ID and request logger |
| [src/procedures.ts](src/procedures.ts) | Public and authenticated procedure builders |
| [src/routers/todo.ts](src/routers/todo.ts) | Reference for validated, owner-scoped CRUD |
| [src/routers/index.ts](src/routers/index.ts) | Router registration and inferred client types |
| [src/queue-monitor.ts](src/queue-monitor.ts) | Read-only BullMQ projection over `@bull-board/api` |
| [src/routers/queues.ts](src/routers/queues.ts) | Platform-protected queue, job, log and scheduler procedures |
| [src/auth.ts](src/auth.ts) | Better Auth factory |

## Extend

1. Implement the operation in [domain](../domain/README.md). Add its concrete
   service type to `Services`; instantiate it in
   [server services](../../apps/server/src/services.ts) and pass it through `createApi`.
2. Add a router under `src/routers`. Validate payloads with Zod and call
   `context.services`. `protectedProcedure` requires login; use
   `pageProcedure(page)` for page authorization on every tool operation, and
   derive the owner from `context.session.user.id`. New tools must not rely on
   login protection alone.
3. Map missing and foreign resources to the same `NOT_FOUND`. Translate known
   domain failures to stable RPC errors, without returning driver error details.
4. Register the router in `src/routers/index.ts`. Prefer explicit operation names
   such as `setCompleted`; preserve aliases when existing clients require them.
5. Keep dependency creation, listening and shutdown in the application. Add a
   [package export](package.json) only when another package needs a new entry point.

Auth plugin/schema changes start in `src/auth.ts`; follow
[auth schema generation](../../docs/development.md#better-auth-schema-generation),
then the [database migration workflow](../db/README.md).

## Example: expose todo.rename

The implemented `todoRouter.rename` in [src/routers/todo.ts](src/routers/todo.ts)
calls the [domain rename method](../domain/README.md#example-rename-an-owned-todo).
Its validation and ownership boundary follow this pattern:

```ts
rename: pageProcedure("todos")
  .input(z.object({
    workspaceId: z.string().min(1).max(100),
    id: z.number().int().positive(),
    text: z.string().trim().min(1).max(500),
  }))
  .handler(async ({ input, context }) => {
    const updated = await context.services.todosService.rename({
      userId: context.session.user.id,
      workspaceId: context.workspaceId,
      id: input.id,
      text: input.text,
    });
    if (!updated) throw new ORPCError("NOT_FOUND");
    return updated;
  }),
```

The existing `appRouter.todo` registration and inferred client expose
`client.todo.rename({ workspaceId, id: 7, text: "Book tickets" })`. There is no `userId`
input, new service instance or hand-written client interface. See the
[web example](../../docs/extension-examples.md#case-1-rename-a-todo) for callers.

Extend [server module tests](../../apps/server/tests/modules.test.ts): unauthenticated
requests fail; whitespace is trimmed; empty/overlong text and invalid IDs are
rejected; the service receives the session user ID. Test both missing and foreign
Todos as `NOT_FOUND` with dedicated database integration tests. Update typed
service fakes when their `TodosService` contract gains `rename`.

Queue monitoring supports state browsing, exact job ID lookup and full-name matching across all states. Name search checks at most 100 jobs per state, reads one extra per state to detect truncation, and returns at most 50 deduplicated matches with scanned and truncation indicators; it is not a snapshot or an exact total. Legacy `jobId` means ID lookup only. Scheduler reads return at most 50 items per page.

## Verify

Run from the workspace root:

```bash
pnpm --filter @full-stack-example/api check-types
pnpm --filter server test
```

For auth, database or queue behavior, also run `pnpm test:integration` against
dedicated test services. Update web callers and run `pnpm check-types` when the
API contract changes. This package does not start Worker consumers or expose a
raw database through the RPC context.

## Roles and page access

[Implementation and extension rules](../../docs/access-control.md).

## Workspace APIs

`createAccessService(auth, db)` owns the authorization facade and workspace management
adapter. `access.mine` lists only memberships; `access.workspaces` is the paginated
platform metadata list. `access.createWorkspace` atomically creates the organization,
owner, standard role and tool configuration; its creator is not implicitly a member.
`access.setTool` is platform-only; `access.addMember` accepts an existing account email
and requires a local owner/admin. Membership insertion is idempotent.

Every Todo input requires `workspaceId`. `pageProcedure` verifies membership, tool
configuration and native role authorization, then passes the same immutable scope into
the service. Never use session `activeOrganizationId` as a business target. Raw
Organization writes are allowlisted; role and member targets must belong to the explicit
organization. Owner changes, removal, invitations and deletion remain unavailable.
Queues use `platformProcedure`; account-level profile jobs retain their user scope.

Ordinary business rules and reusable use cases belong in domain. The access/workspaces adapter is a specific exception for Better Auth organization management: it may resolve sessions, enforce native permissions, transact organization membership and role configuration, and map transport errors. This exception does not cover ordinary Todo business logic. Extract a concrete use case when a real non-HTTP reuse need arises; domain must not accept `Headers`, sessions, or `ORPCError`.

Queue monitoring registrations choose either a native BullMQ `Queue` or a complete `QueueReadAdapter`, including logs. Both are assembly-only; procedures receive the monitor capability, and the producer remains responsible for closing the queue.

Workspace creation and account bans share the [user-row lock protocol](../../docs/access-control.md): check and write under the same transaction, alongside authorization. See the [concurrency test](../../apps/server/tests/integration/workspaces.test.ts).
