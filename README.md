# full-stack-example

A TypeScript full-stack example with authenticated personal todos, user profiles, and background jobs running in a separate worker process.

Built with [Better T Stack](https://github.com/AmanVarshney01/create-better-t-stack): React and TanStack Router on the frontend, Hono and oRPC on Node.js, Better Auth, Drizzle/PostgreSQL, and BullMQ/Redis. Shared UI components use shadcn/ui and Tailwind CSS.

## Try it locally

After setup, open [localhost:3001](http://localhost:3001), create an account or sign in, then visit `/todos` to create, complete, and delete your own tasks. Each account has its own list.

Authenticated code can also use the typed oRPC client to read a profile and submit a background job:

```ts
const profile = await client.users.me();
const job = await client.users.requestProfile();
const status = await client.users.profileJob({ id: job.id });
```

The worker reads the profile and returns `id`, `name`, and `emailVerified`. Only the submitting user can inspect the job. Poll `profileJob` until it completes; results are retained for a limited time.

## Setup

Use Node.js (the project uses Node 24 in Docker), pnpm 11.0.9, and Docker Compose. Run commands from the repository root.

```bash
pnpm install
```

Create these ignored local files before starting the applications:

| File | Values for local development |
| --- | --- |
| `apps/server/.env` | `DATABASE_URL=postgresql://postgres:password@localhost:5432/my-better-t-app`, `BETTER_AUTH_URL=http://localhost:3000`, `CORS_ORIGIN=http://localhost:3001`, and `BETTER_AUTH_SECRET` (at least 32 characters) |
| `apps/worker/.env` | The same `DATABASE_URL` as the server |
| `apps/web/.env` | `VITE_SERVER_URL=http://localhost:3000` |

Generate a secret with `openssl rand -hex 32`. Redis defaults to `redis://localhost:6379` in both server and worker; set `REDIS_URL` in both files if yours differs. The database CLI imports its connection settings from the server schema. Never commit `.env` files.

```bash
pnpm infra:up
pnpm db:push
pnpm dev
```

This starts PostgreSQL and Redis, applies the database schema, and runs web, API, and worker. The API listens at [localhost:3000](http://localhost:3000); its reference is at [/api-reference](http://localhost:3000/api-reference) and health check at [/health](http://localhost:3000/health).

### Existing databases

Apply `pnpm db:push` before running the updated Todo API. The new nullable `todo.user_id` foreign key preserves existing rows without guessing their owners. Rows with no owner are inaccessible through the API. Backfill only when ownership can be verified, or archive them separately. New todos always receive the authenticated user's ID; deleting a user also deletes their owned todos.

## Common commands

| Command | Purpose |
| --- | --- |
| `pnpm dev:web`, `pnpm dev:server`, `pnpm dev:worker` | Start one application |
| `pnpm test` | Run offline API/module and worker tests |
| `pnpm check-types` | Check workspace types (also builds the web app) |
| `pnpm build` | Build applications |
| `pnpm exec biome check .` | Check lint and formatting without changing files |
| `pnpm check` | Apply Biome fixes |
| `pnpm db:studio` | Inspect the database |
| `pnpm db:generate`, `pnpm db:migrate` | Generate and apply SQL migrations |
| `pnpm env:generate` | Regenerate environment types after schema changes |
| `pnpm infra:down` | Stop local PostgreSQL and Redis |

## Docker deployment

Create the environment files above, configure production URLs and secrets, then use:

```bash
pnpm docker:build
pnpm docker:up
pnpm docker:logs
# Stop the stack:
pnpm docker:down
```

Compose runs web, server, worker, PostgreSQL, and Redis. It overrides database and Redis addresses for container networking. Public frontend configuration is baked into the web build. Apply database schema changes separately before starting the updated applications; container startup does not run migrations. Use HTTPS and deployment-managed secrets in production.

## Development

| Location | Responsibility |
| --- | --- |
| `apps/web` | React frontend and file-based routes |
| `apps/server` | Hono API process; produces jobs |
| `apps/worker` | Independent BullMQ consumer and lifecycle |
| `packages/api`, `packages/auth` | oRPC procedures and Better Auth factory |
| `packages/users`, `packages/queue` | Profile service, worker factory, typed jobs and queue client |
| `packages/db` | PostgreSQL schema and Drizzle configuration |
| `packages/ui`, `packages/config` | Shared components, styles, and TypeScript configuration |

See the [development guide](docs/development.md) for UI customization, environment generation, auth schema generation, dependency injection, worker lifecycle, and adding modules. Generator choices are recorded in [bts.jsonc](bts.jsonc); all commands are defined in [package.json](package.json).

Before contributing, run `pnpm install`, `pnpm test`, `pnpm check-types`, `pnpm build`, and `pnpm exec biome check .`. Keep dependency changes scoped to the owning package and use concise conventional commit subjects.
