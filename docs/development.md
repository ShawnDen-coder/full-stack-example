# Development guide

[Back to README](../README.md)

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@my-better-t-app/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `pnpm run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

The Vite integration and Node server bootstrap load Varlock. Node deployments include Varlock and its dependencies alongside the app schema.

Run standalone Node tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Better Auth Schema Generation

After changing auth plugins or schema options, run `pnpm run auth:generate` from the project root. The script runs the Better Auth CLI through `varlock run` from the owning app directory, loading the auth instance from `src/auth-schema.ts`. Review the schema changes, then use your ORM's migration workflow to apply them.

## Application composition

The integration follows the explicit factory and dependency injection pattern in
[claude-vps](https://github.com/grmkris/claude-vps/tree/d972236):

- `apps/server/src/index.ts` owns process startup and shutdown. It creates the API runtime and serves the Hono application; it never starts consumers.
- `apps/worker/src/index.ts` starts a separate Node.js consumer process. `apps/worker/src/runtime.ts` creates its database and users service, checks readiness, then starts the user-profile worker.
- `apps/server/src/services.ts` creates the database, Better Auth, queue client, and users service once per process. Importing it does not start connections or workers.
- `packages/api/src/create-api.ts` exports `createApi(...)`, which accepts initialized dependencies. It mounts Better Auth at `/api/auth/*`, oRPC at `/rpc`, OpenAPI at `/api-reference`, and health at `/health`. Health and unmatched URLs do not resolve sessions.
- `packages/api/src/context.ts` resolves the incoming session and provides services to procedures. `protectedProcedure` requires authentication before calling business services.
- `packages/users` reads a user profile through an injected database. `packages/queue` owns job contracts, producer configuration, retention, retries, and job ownership checks. Worker factories live under `packages/users/src/workers` and reuse the same service factory as HTTP requests, with separate instances and connections per process.

The Todo API requires authentication and scopes every operation to the session user.
The users API is authenticated and
always derives the user ID from the session; it exposes no user-list or arbitrary-user lookup endpoint.

Authenticated clients can exercise the complete service/queue path using the existing typed oRPC client:

```ts
const profile = await client.users.me();
const job = await client.users.requestProfile();
const status = await client.users.profileJob({ id: job.id });
```

The background task reads the current profile and returns only `id`, `name`, and
`emailVerified` as a small example job. A caller can inspect only their own job;
missing and foreign jobs both return `NOT_FOUND`. Results expire after one hour
(or earlier when the completed-job count exceeds 1,000); failed jobs are retained
for up to one day, capped at 1,000. Cleanup happens when subsequent jobs finish.

`REDIS_URL` is declared in `apps/server/.env.schema` and defaults to
`redis://localhost:6379` for host development. Docker Compose overrides it with
`redis://redis:6379`, starts Redis with persistence and `noeviction`, and waits for
PostgreSQL and Redis health checks before starting the server. Keep any Redis
credentials in ignored local env overrides or your deployment secret provider.

Better Auth receives an explicit database and configuration object. Cookie
security follows Better Auth's URL/environment defaults so local HTTP development
works without forcing cross-site secure cookies. Production should use HTTPS.
The auth schema-generation entry point initializes only database/auth and never
starts the queue, worker, or HTTP server.

On `SIGINT` or `SIGTERM`, the API stops accepting requests and closes its queue
and PostgreSQL pool. The independent worker stops consuming, drains active jobs,
and then closes its own PostgreSQL pool. Workers use unlimited Redis request
retries; HTTP producers use bounded request retries. The optional
`msgpackr-extract` native build is disabled; its JavaScript fallback is used.

To add another module, expose a factory, instantiate it in `createServices`, add
its concrete service type to `Services`, and mount its oRPC router in
`packages/api/src/routers/index.ts`. For background work, add a typed job contract
and a worker factory in the owning business package, then register and close it
in the worker runtime.

## Independent worker

API requests enqueue jobs in Redis; `apps/worker` consumes them using the shared
queue name, task name and Zod payload schema. It calls the users service directly,
without HTTP or browser sessions. The worker package does not depend on API or
auth packages. Importing its runtime or the users worker factory does not start
connections or consumption.

For local development, set the worker's `DATABASE_URL` in an ignored
`apps/worker/.env` (or provide it through the process environment). Use the same
database and Redis as the API. The worker owns its `.env.schema` and does not
require Better Auth secrets. Then run:

```bash
pnpm infra:up
pnpm db:push
pnpm dev
```

`pnpm dev` starts web, server and worker through the pnpm workspace. To restart
or debug only the consumer, use `pnpm dev:worker`. Production runs the built
entry with `pnpm start:worker`; Docker Compose includes a separate `worker`
service with its own image and no published HTTP port.

The runtime checks PostgreSQL, creates the worker with `autorun: false`, waits
for Redis readiness, and then starts consumption. `WORKER_STARTUP_TIMEOUT_MS`
(default 10,000 ms) bounds each readiness phase. Failure before readiness closes
the unstarted worker and database, then exits unsuccessfully. Startup never
creates or resets any scheduler configuration.

`WORKER_CONCURRENCY` defaults to 5 and accepts integers from 1 to 100. Shutdown
is idempotent and waits for active jobs before closing the database.
`WORKER_SHUTDOWN_TIMEOUT_MS` defaults to 30,000 ms; exceeding the deadline exits
unsuccessfully, allowing BullMQ to recover stalled work. Compose gives the
container 40 seconds to stop; increase both values for longer jobs. Business
handlers must tolerate repeated execution because retries and process failures
can cause a job to run again. The example task only reads data.

This implements the process and lifecycle part of the referenced scheduling
proposal. Schedule configuration, persistence, pause/resume and scheduler
reconciliation are separate application features and are not implemented here.

The HTTP application uses Hono with oRPC's Fetch adapters. Better Auth is
mounted directly through its Fetch handler. `createApi()` returns an import-safe
Hono application; `apps/server` starts it through `@hono/node-server`.
Hono handles routing, CORS, request logs and HTTP errors, while oRPC owns business
procedures. CORS covers auth, RPC, docs and health, including preflight requests.
The runtime remains Node.js with pnpm; no Bun configuration or scripts are used.
