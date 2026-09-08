# API Client package

`@full-stack-example/api-client` wraps Hono's `hc<AppType>` client so browser code can call the API without duplicating paths, parameters, or response types.

## Public API

- `createApiClient(baseUrl)` creates a credentialed typed client.
- `ApiClient` exposes the inferred client type.
- `parseResponse(response)` converts failed responses into `ApiError`.
- `ApiError` carries HTTP status, a safe message, and an optional request ID.

The package imports the API contract only for types; it does not start a server or make network requests during import.

## Quick start

Create one client at the browser boundary and use Hono's inferred route tree:

```ts
import { createApiClient, parseResponse } from "@full-stack-example/api-client";

const api = createApiClient("http://localhost:3000");
const response = await api.api.todos.$get();
const todos = await parseResponse(response);
```

For a mutation, pass the same path parameters and JSON body that the API route declares:

```ts
const response = await api.api.todos.$post({ json: { title: "Write docs" } });
const todo = await parseResponse(response);
```

## Development

```bash
pnpm --filter @full-stack-example/api-client typecheck
pnpm --filter @full-stack-example/api-client build
```

## Extension rules

Keep `AppType` sourced from `@full-stack-example/api/contract`. Do not create a second handwritten client contract or generate an alternative OpenAPI client. Preserve request IDs when converting errors so callers can correlate failures with API logs.

See the [TypeScript API Reference](/reference/) and [HTTP API Reference](/reference/http-api/).
