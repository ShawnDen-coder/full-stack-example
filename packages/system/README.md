# System package

`@full-stack-example/system` provides the health response contract, database health service, and `GET /health` route.

## Public API

- `healthResponseSchema` and `HealthResponse` define the stable health payload.
- `setupSystemApp(app, options)` registers the health route on the host Hono app.
- The route returns `200` with `status: "ok"` when the database probe succeeds and `503` with `status: "degraded"` when it fails.

The package receives the database probe and logger through options; it does not create infrastructure clients itself.

## Development

```bash
pnpm --filter @full-stack-example/system typecheck
pnpm --filter @full-stack-example/system build
```

## Extension rules

Keep the health payload safe for public diagnostics. Never include raw database errors or secrets. Add route metadata and behavior tests whenever the response contract changes.

See the [System module guide](/modules/system/) and [HTTP API Reference](/reference/http-api/).
