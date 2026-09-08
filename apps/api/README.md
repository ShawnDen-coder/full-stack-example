# API application

`@full-stack-example/api` is the Hono host for the application. It is the only composition root: middleware, feature routes, the OpenAPI endpoint, and production Web assets are assembled in `src/app.ts`.

## Responsibilities

- Install request IDs, CORS, secure headers, body limits, timeouts, logging, and OpenTelemetry middleware.
- Register `setupSystemApp`, `setupTodosApp`, and the development-only log stream.
- Serve `GET /openapi.json` and return uniform JSON errors for unknown routes and uncaught failures.
- Serve the built Web application in the production container.

The API does not own database schema or Todo business rules. Those are injected through package interfaces.

## Public entry points

- `createApp(options)` creates a fully composed Hono application for tests and servers.
- `AppType` is the RPC contract consumed by `@full-stack-example/api-client`.
- `src/server.ts` starts the Node process; `src/bootstrap.ts` creates runtime dependencies.

## Quick start

Start the complete local stack from the repository root:

```bash
just init
Copy-Item .env.example .env
just launch
```

To exercise the composed app without a listener, provide deterministic dependencies and call it directly:

```ts
const app = createApp({
  checkDatabase: async () => {},
  logger,
  webOrigin: "http://localhost:5173",
  todoService,
});

const response = await app.request("/health");
```

## Development

```bash
pnpm --filter @full-stack-example/api dev
pnpm --filter @full-stack-example/api typecheck
pnpm --filter @full-stack-example/api build
```

The normal local workflow is `just launch`, which starts infrastructure and the API/Web watch processes. The API listens on `http://localhost:3000`.

## Extension rules

Add features through `setupXxxApp(app, options)` and return the chained Hono app. Keep `apps/api/src/app.ts` as the explicit composition root and preserve the inferred `AppType`; do not introduce a generic route registry.

See the [HTTP API Reference](/reference/http-api/) and [API module guide](/modules/api/).
