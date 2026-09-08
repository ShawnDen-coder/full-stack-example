# Todos package

`@full-stack-example/todos` owns Todo validation, service and repository boundaries, and the Hono CRUD routes mounted by the API host.

## Public API

- `todoSchema`, `todoListSchema`, `createTodoSchema`, `updateTodoSchema`, and `todoIdSchema` define runtime validation.
- `TodoService` describes the application operations required by routes.
- `createTodoService(repository)` wires persistence to business operations.
- `setupTodosApp(app, options)` registers `/api/todos` routes without creating a second host app.

The repository is injected into the service. Routes never access Drizzle directly.

## Quick start

Wire a repository-backed service and mount the routes on the API composition root:

```ts
import { createTodoRepository, createTodoService, setupTodosApp } from "@full-stack-example/todos";

const repository = createTodoRepository(database.db);
const service = createTodoService(repository);
setupTodosApp(app, { service });
```

You can call the mounted route with the same contract used by the Web app:

```bash
curl http://localhost:3000/api/todos
curl -X POST http://localhost:3000/api/todos \
  -H 'content-type: application/json' \
  -d '{"title":"Write docs"}'
```

## HTTP behavior

`GET` lists newest Todos first; `POST` creates a trimmed title from 1 to 200 characters; `PATCH` changes completion; `DELETE` permanently removes a Todo. Invalid input is a documented `400`, missing records are `404`, and successful deletion is `204`.

## Development

```bash
pnpm --filter @full-stack-example/todos typecheck
pnpm --filter @full-stack-example/todos build
```

## Extension rules

Update the Zod schema, service behavior, OpenAPI metadata, API tests, and module README together. Preserve the `setupTodosApp(app, options)` return type so Hono RPC inference remains exact.

See the [Todos module guide](/modules/todos/) and [HTTP API Reference](/reference/http-api/).
