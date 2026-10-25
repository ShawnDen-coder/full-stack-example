# Operations guide

[English](operations.md) · [简体中文](operations.zh-CN.md) · [Project overview](../README.md)

Deploy, migrate, tune runtime limits, and recover production services. For local development, use the [quick start](../README.md#quick-start). Run commands from the repository root.

## Production deployment

The supported baseline is one Docker Compose host behind an HTTPS reverse proxy.
`docker-compose.yml` is for local development; `compose.production.yml` is the
independent production stack. All browser requests use one public HTTPS origin.

Supply production values via the environment or an ignored `deploy/.env` file,
following `deploy/.env.schema`: `PUBLIC_APP_URL`, `BETTER_AUTH_SECRET` (32+
characters), `POSTGRES_PASSWORD`, and three database URLs targeting `postgres:5432/app`:

- `MIGRATION_DATABASE_URL`: schema owner `postgres`, with the configured `POSTGRES_PASSWORD`.
- `DATABASE_URL`: login role `app_server`, with a separate runtime password.
- `WORKER_DATABASE_URL`: login role `app_worker`, with a separate runtime password.

URL-encode passwords. No production password has a fallback. The deployment
provisions these fixed runtime roles after migration: Server gets table CRUD;
Worker can only read user profiles. Runtime roles cannot change the schema.
Never reuse development or CI credentials.

```bash
pnpm docker:up
pnpm docker:logs
# Stop containers while preserving data volumes:
pnpm docker:down
```

The deployment command builds images, waits for PostgreSQL and Redis, runs a
fresh migration task and runtime-role provisioning, and only then updates server/worker and web. A migration
failure stops the release before replacing existing application containers.
A readiness failure stops subsequent deployment steps; there is no automatic
application rollback. Use additive, backward-compatible migrations during updates.

Point your external TLS proxy to `127.0.0.1:8080` (`WEB_PORT` can change this).
Nginx serves the SPA and proxies auth/RPC/API-reference paths to the server.
The API, database and Redis have no published production ports. The browser URL
is baked into the frontend build; changing it requires rebuilding web. Production Node images run as the `node` user, carry built code and production dependencies, and exclude local value files.

## Database migrations

Committed SQL migrations initialize an empty database and record every schema
change. Use `pnpm db:generate`, review and commit the generated SQL and snapshot,
then run `pnpm db:migrate`. Re-running migrations is safe. `pnpm db:push` is
available only for disposable local experiments; do not use it for releases.

The initial migration targets new databases. Existing databases previously
created with `db:push` require a separately reviewed baseline adoption; do not
run the initial migration over them or mark it applied without comparing schemas.
The nullable Todo owner column is preserved for compatibility: ownerless rows
remain inaccessible, and new API writes always bind the authenticated user.

Migration statement and lock-wait deadlines default to 300 seconds and 5 seconds, independently of request query timeouts. Review the explicit runtime-role grants in `packages/db/src/provision.ts` when adding tables.

## Runtime and logs

Both processes own their clients and shutdown. The API waits for PostgreSQL before listening; Redis is an optional capability probed at `/ready/jobs`. `/health` means the process responds; `/ready` checks
the database within two seconds and returns 503 during drain or failure.
It does not resolve sessions. Readiness is a dependency probe, not a substitute
for migration validation or worker-lag monitoring.

Server startup defaults to 10 seconds; shutdown defaults to 30 seconds. Compose
gives server and worker 40 seconds. Configure `DB_POOL_MAX` (default 10) per
process and `DB_QUERY_TIMEOUT_MS` (default 10 seconds) for both client query and
database statement deadlines. Budget total database connections across replicas.
Worker startup/exit settings remain separate from query timeouts.

Pino emits JSON to stdout with `service`, request ID, duration and status. HTTP
responses expose `X-Request-ID`; queued jobs retain it and log their job ID on
completion/failure. Driver exceptions are serialized with sanitized messages and
stacks. Do not log request bodies, authentication headers, session objects,
configuration objects or SQL bind values. Attach logs to your platform's collector
and alert on repeated 503s, job failures and growing queue delay.

### Worker runtime limits

Point the Worker's `DATABASE_URL` and `REDIS_URL` at the same services as the API; it needs no Better Auth secret. Use `pnpm dev:worker` to start only the consumer or `pnpm start:worker` to run its build. Production uses a separate Worker image without an HTTP port.

| Setting | Default | Meaning |
| --- | --- | --- |
| `WORKER_STARTUP_TIMEOUT_MS` | 10,000 ms | Budget for each database/consumer readiness phase |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | 30,000 ms | Group drain and resource cleanup budget |
| `WORKER_CONCURRENCY` | 5 | Per-consumer concurrency, from 1 to 100 |

Total concurrency is the sum across consumers; review database pool and memory capacity. Startup failure cleans up created resources within the shutdown budget, and exit signals cancel startup waits. Startup never creates or resets schedulers. Schedule configuration, persistence, pause/resume, and reconciliation are not implemented.

On `SIGINT` or `SIGTERM`, the API stops accepting requests and closes its queue client and database. The Worker stops consuming, drains active jobs, then closes its database. A shutdown timeout causes an unsuccessful exit so BullMQ can recover stalled jobs; handlers must tolerate repeated execution. For long jobs, increase both the application deadline and Compose's 40-second grace period. Workers use unlimited Redis request retries; HTTP producers use bounded retries. The optional `msgpackr-extract` native build is disabled in favor of its JavaScript fallback.

## Backup and recovery

Before a schema-changing release, create a PostgreSQL logical backup with
`pg_dump -Fc` using your deployment-managed credentials, and store it outside the
host. Test `pg_restore` into a new empty database. Preserve Redis AOF volumes for
queued work, and remember handlers must tolerate repeated execution. Backups on
the same machine or untested restores are insufficient.

For an application rollback, redeploy the previously validated image versions
only when they remain compatible with the current schema. There is no automatic
destructive down-migration. For a database restore, stop producers and consumers,
restore into a fresh database, verify schema and ownership, then start services
against that database. Reconcile queued jobs before resuming consumers. Never use
`docker compose down -v` as part of a production update.

## Observability

See [observability operations](observability.md) for logs, traces, metrics, health probes, and failure checks. Collectors and exporters are never readiness dependencies.
