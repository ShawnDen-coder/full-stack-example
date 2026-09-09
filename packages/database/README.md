# Database package

`@full-stack-example/database` owns the Drizzle schema, PostgreSQL client creation, migrations, and the database health probe used by the API. It also owns Better Auth's persisted tables; the Auth package consumes this schema through the Drizzle adapter.

## Public API

- `createDatabaseClient(connectionString)` creates the Drizzle/Postgres client.
- Schema exports describe the persisted Todo, Better Auth, and tenant-scoped business shapes.
- Migration helpers run the checked-in SQL migrations.
- The health probe verifies database connectivity without exposing credentials.

## Quick start

Create the database context at the application bootstrap boundary, then inject its `db` and `close` functions into services:

```ts
import { createDatabase, checkDatabase } from "@full-stack-example/database";

const database = createDatabase({ databaseUrl: process.env.DATABASE_URL! });
await checkDatabase(database.db);
// pass database.db to repositories; call database.close() during shutdown
```

For a local PostgreSQL instance, run migrations before starting the API:

```bash
pnpm --filter @full-stack-example/database db:migrate
```

### Auth and tenant changes

The Auth schema adds `user`, `session`, `account`, `verification`, `organization`, `member`, and `invitation` tables. `organization.status` is constrained to `active` or `disabled`; Better Auth tables are deliberately outside RLS.

The `tenant_notes` sample table and the Todos feature demonstrate the business-side isolation contract. Both carry a `tenant_id` reference to `organization.id`; their migrations enable and force RLS. New Todos should be written through `createTenantTodoRepository` inside `withTenantTransaction`. The `app_runtime` role receives only table/sequence DML privileges, while `app_migrator` is reserved for schema migration ownership.

Use `withTenantTransaction(database, tenantId, work)` to set transaction-local `app.tenant_id`, and pass the resulting `TenantTransaction` to tenant-scoped repositories. This prevents tenant context leaking across pooled connections.

Migrations are checked in under `packages/database/migrations`; run `just db-test-integration` with `DATABASE_URL` to execute the real PostgreSQL isolation test.

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
