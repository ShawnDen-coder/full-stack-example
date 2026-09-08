# Web application

`@full-stack-example/web` is the React/Vite single-page application. It owns browser routes, page components, TanStack Query data fetching, and the browser-facing API client boundary.

## Responsibilities

- Render the home and Todo routes with React Router.
- Use TanStack Query for server state and `@full-stack-example/api-client` for typed requests.
- Resolve the API origin from development configuration and use same-origin requests in production.

The Web app does not duplicate API schemas or call PostgreSQL directly.

## Development

```bash
pnpm --filter @full-stack-example/web dev
pnpm --filter @full-stack-example/web typecheck
pnpm --filter @full-stack-example/web build
```

Vite serves the app at `http://localhost:5173`; `just launch` starts it together with the API.

## Extension rules

Keep route components focused on UI and query state. Put shared request behavior in `packages/api-client`, and update query invalidation when a mutation changes Todo data. Production requests must remain same-origin so the single Node container can serve both applications.

See the [Web module guide](/modules/web/) and [API Client module guide](/modules/api-client/).
