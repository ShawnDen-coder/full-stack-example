# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

A TypeScript full-stack example with authenticated personal todos, user profiles, and background jobs running in a separate worker process.

The stack uses React and TanStack Router on the frontend, Hono and oRPC on Node.js, Better Auth, Drizzle/PostgreSQL, and BullMQ/Redis. Shared UI components use shadcn/ui and Tailwind CSS.

## Try it locally

After setup, open [localhost:3001](http://localhost:3001), create an account or sign in, then visit `/todos` to create, complete, and delete your own tasks. Each account has its own list.

Authenticated code can also use the typed oRPC client to read a profile and submit a background job:

```ts
const profile = await client.users.me();
const job = await client.users.enqueueProfileRead();
const status = await client.users.getProfileReadJob({ id: job.id });
```

The worker reads the profile and returns `id`, `name`, and `emailVerified`. Only the submitting user can inspect the job. Poll `getProfileReadJob` until it completes; results are retained for a limited time.

## Setup

Use Node.js 24 (`.node-version`), pnpm 11.0.9, and Docker Compose. Run commands from the repository root.

```bash
pnpm install
```

Initialize ignored development configuration (existing files are preserved):

```bash
pnpm env:init
```

This creates app-owned `.env` files for local ports 3000/3001, PostgreSQL on
5432 and Redis on 6379, with a random authentication secret. It prints filenames
only. Change local values or supply process environment overrides when needed;
never commit value files. `apps/server/.env.schema`, `apps/worker/.env.schema`
and `apps/web/.env.schema` document application configuration.

The default local database and Compose project are named `full-stack-example`.
When renaming the project, also update `DATABASE_URL` in existing server/worker
value files; `env:init` preserves them. Renaming Compose projects or volumes
selects new volumes, so migrate existing data explicitly before switching.

```bash
pnpm infra:up
pnpm db:migrate
pnpm dev
```

This starts PostgreSQL and Redis, applies the database schema, and runs web, API, and worker. The API listens at [localhost:3000](http://localhost:3000); its reference is at [/api-reference](http://localhost:3000/api-reference) and liveness at [/health](http://localhost:3000/health). Core database readiness is at [/ready](http://localhost:3000/ready); queue readiness is separate at [/ready/jobs](http://localhost:3000/ready/jobs). Redis outages do not prevent the API from starting.

### Database changes

Committed SQL migrations initialize an empty database and record every schema
change. Use `pnpm db:generate`, review and commit the generated SQL and snapshot,
then run `pnpm db:migrate`. Re-running migrations is safe. `pnpm db:push` is
available only for disposable local experiments; do not use it for releases.

The initial migration targets new databases. Existing databases previously
created with `db:push` require a separately reviewed baseline adoption; do not
run the initial migration over them or mark it applied without comparing schemas.
The nullable Todo owner column is preserved for compatibility: ownerless rows
remain inaccessible, and new API writes always bind the authenticated user.

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:web`, `pnpm dev:server`, `pnpm dev:worker` | Start one application |
| `pnpm test` | Run offline API, worker and deployment guard tests |
| `pnpm test:integration` | Exercise real PostgreSQL/Redis, auth, migrations and processes |
| `pnpm test:e2e` | Run Playwright account isolation and CRUD scenarios |
| `pnpm check-types` | Generate route types and check workspace types |
| `pnpm build` | Build applications |
| `pnpm check:boundaries` | Check package dependencies and public exports |
| `pnpm exec biome check .` | Check lint and formatting without changing files |
| `pnpm check` | Apply Biome fixes |
| `pnpm db:studio` | Inspect the database |
| `pnpm db:generate`, `pnpm db:migrate` | Generate and apply SQL migrations |
| `pnpm env:generate` | Regenerate environment types after schema changes |
| `pnpm infra:down` | Stop local PostgreSQL and Redis |

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
is baked into the frontend build; changing it requires rebuilding web.

See the [development and operations guide](docs/development.md) for migration,
backup, recovery, logging and validation procedures.

## Development

Start with the [architecture diagrams](docs/development.md#architecture-overview) to follow runtime connections, authenticated requests and background jobs.

| Location | Responsibility | Extension guide |
| --- | --- | --- |
| `apps/web` | React frontend and file-based routes | [Application wiring](docs/development.md#application-extension-entry-points) |
| `apps/server` | Hono API process; produces jobs | [Application wiring](docs/development.md#application-extension-entry-points) |
| `apps/worker` | Independent BullMQ consumer and lifecycle | [Application wiring](docs/development.md#application-extension-entry-points) |
| `packages/api` | HTTP/auth boundaries and oRPC procedures | [API](packages/api/README.md) |
| `packages/business` | Services, scoped repositories and business-owned jobs | [Business](packages/business/README.md) |
| `packages/db` | Database factory, schema, migrations and runtime grants | [Database](packages/db/README.md) |
| `packages/queue` | Generic BullMQ connections and telemetry adapter | [Queue](packages/queue/README.md) |
| `packages/observability` | Structured logs, traces, metrics and deadlines | [Observability](packages/observability/README.md) |
| `packages/ui` | Shared components and styles | [UI](packages/ui/README.md) |

The [development guide](docs/development.md) covers application wiring and operations;
each package guide lists its entry points, extension steps, boundaries and checks.
Root `tsconfig.base.json` owns shared TypeScript settings. Package manifests and
application configuration define the current stack; commands live in [package.json](package.json).

Follow the [module extension examples](docs/extension-examples.md) for a Todo
rename, a new background job, and focused DB/queue/observability/UI changes.

See the [extension contract](docs/extension-design.md) for named business inputs,
task-specific exports, consumer registration and dependency boundaries.

Before contributing, run `pnpm install`, `pnpm test`, `pnpm check-types`, `pnpm build`, `pnpm check:boundaries`, and `pnpm exec biome check .`. Keep dependency changes scoped to the owning package and use concise conventional commit subjects.

## Versioning

[Cocogitto](https://docs.cocogitto.io/) 6.4.0 manages one application version for
the entire workspace, recorded as an `X.Y.Z` Git tag and in the root
`CHANGELOG.md`. Workspace manifest versions are not release versions; packages
are not published independently.

Install the CLI before committing (requires [Rust/Cargo](https://rustup.rs/)),
then install workspace dependencies to activate Husky:

```bash
cargo install cocogitto --version 6.4.0 --locked
pnpm install --frozen-lockfile
```

Husky checks each commit message with `cog verify`; CI checks the entire commit
history, ignoring merge commits. Use
Conventional Commits such as `fix(api): handle missing sessions`,
`feat(todos): add filtering`, and `feat(api)!: change the response contract`.
`fix` increments PATCH, `feat` increments MINOR, and breaking changes increment
MAJOR after 1.0.0. During 0.x development, automatic bumps stay below 1.0.0;
use `cog bump --version 1.0.0` when intentionally declaring the API stable.

Release from a clean, up-to-date `master` checkout after CI passes:

```bash
pnpm release:preview
pnpm release
```

The preview prints the next version without changing files or running release
hooks. The release runs commit, lint, boundary, test, type and build checks,
generates/updates `CHANGELOG.md`, and creates a local version commit and tag.
The first automatic release considers the existing history. Neither command
pushes changes, publishes packages, or deploys the application. Review the
result before pushing `master` and the new tag together, for example
`git push --atomic origin master 0.1.0` (replace the tag with the generated one).

## Validation

CI runs Conventional Commit checks, lint, package dependency checks, offline tests, type checks, builds, real-service integration tests,
Playwright and an independent production Compose smoke test.

For integration/browser tests, set `TEST_DATABASE_URL` and `TEST_REDIS_URL` to
**dedicated disposable services**, then run:

```bash
pnpm test:integration
pnpm --filter web exec playwright install chromium
pnpm test:e2e
```

Integration tests apply committed migrations, create temporary accounts and
verify database failures, worker retries and process shutdown. Browser tests use
ports 43100/43101 and leave test accounts in the disposable database. Do not point
these commands at a development database you care about or a production service.

## Observability

Pino emits structured JSON with request/job IDs and active `trace_id`/`span_id`.
Set `OTEL_ENABLED=true` to export traces and metrics over OTLP/HTTP; it is disabled
by default. `pnpm telemetry:up` starts an optional local Collector with a Prometheus
endpoint on `127.0.0.1:8889`. See [observability operations](docs/observability.md)
for fields, sampling, queue metrics, health probes and failure verification.

Integration role tests also configure the fixed app_server/app_worker roles and public-schema grants; use a dedicated PostgreSQL instance.
