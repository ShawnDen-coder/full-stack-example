# Database package

`@full-stack-example/database` owns the Drizzle schema, PostgreSQL client creation, migrations, and the database health probe used by the API.

## Public API

- `createDatabaseClient(connectionString)` creates the Drizzle/Postgres client.
- Schema exports describe the persisted Todo shape.
- Migration helpers run the checked-in SQL migrations.
- The health probe verifies database connectivity without exposing credentials.

## Development

```bash
pnpm --filter @full-stack-example/database typecheck
pnpm --filter @full-stack-example/database db:generate
pnpm --filter @full-stack-example/database db:migrate
pnpm --filter @full-stack-example/database db:studio
```

Database commands require `DATABASE_URL` and a running PostgreSQL instance. `just launch` starts the local infrastructure first.

## Extension rules

Change the Drizzle schema and migration together. Never put database access in Web or route handlers; inject the client or repository into the owning service. Health checks should return safe status data and must not leak connection errors.

See the [Database module guide](/modules/database/) and [architecture guide](/architecture/application/).
