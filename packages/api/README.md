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
| [src/routers/queues.ts](src/routers/queues.ts) | Page-protected queue, job, log and scheduler procedures |
| [src/auth.ts](src/auth.ts) | Better Auth factory |

## Extend

1. Implement the operation in [domain](../domain/README.md). Add its concrete
   service type to `Services`; instantiate it in
   [server services](../../apps/server/src/services.ts) and pass it through `createApi`.
2. Add a router under `src/routers`. Validate payloads with Zod and call
   `context.services`; use `protectedProcedure` for private data and derive the
   owner from `context.session.user.id`.
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
rename: protectedProcedure
  .input(z.object({
    id: z.number().int().positive(),
    text: z.string().trim().min(1).max(500),
  }))
  .handler(async ({ input, context }) => {
    const updated = await context.services.todosService.rename({
      userId: context.session.user.id,
      id: input.id,
      text: input.text,
    });
    if (!updated) throw new ORPCError("NOT_FOUND");
    return updated;
  }),
```

The existing `appRouter.todo` registration and inferred client expose
`client.todo.rename({ id: 7, text: "Book tickets" })`. There is no `userId`
input, new service instance or hand-written client interface. See the
[web example](../../docs/extension-examples.md#case-1-rename-a-todo) for callers.

Extend [server module tests](../../apps/server/tests/modules.test.ts): unauthenticated
requests fail; whitespace is trimmed; empty/overlong text and invalid IDs are
rejected; the service receives the session user ID. Test both missing and foreign
Todos as `NOT_FOUND` with dedicated database integration tests. Update typed
service fakes when their `TodosService` contract gains `rename`.

Queue monitoring searches exact job IDs or names across job states; scheduler reads accept a page and return 50 items at most with the total count.

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
