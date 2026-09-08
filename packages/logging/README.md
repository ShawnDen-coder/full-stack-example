# Logging package

`@full-stack-example/logging` centralizes LogTape configuration, child loggers, redaction, and the in-memory development log stream.

## Public API

- `configureLogging(options)` configures level, format, environment, and optional file output.
- `getAppLogger(category)` creates a structured child logger.
- Stream helpers support the opt-in development SSE diagnostics endpoint.

The package does not persist logs in a database, add a cache, or provide an audit store. The development stream is process-local and is lost on restart.

## Development

```bash
pnpm --filter @full-stack-example/logging typecheck
pnpm --filter @full-stack-example/logging build
```

Set `LOG_STREAM_ENABLED=true` only for local diagnostics. Production requires administrator authentication before exposing the stream.

## Extension rules

Use structured event names and child loggers. Apply the existing redaction policy before writing JSON Lines or sending telemetry. Do not add another logging backend without an explicit architecture change.

See the [Logging module guide](/modules/logging/) and [observability guide](/architecture/observability/).
