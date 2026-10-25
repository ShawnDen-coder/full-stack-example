# Repository Guidelines

## Skill Loading

Before editing files for a substantial task, run `pnpm dlx @tanstack/intent@latest list` from the workspace root. If a local skill matches, load it with `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow its guidance.

## Project

This pnpm workspace uses React/TanStack Router and Hono with oRPC Fetch adapters on Node.js. Package manifests, application configuration and committed migrations define the current stack; generator metadata is not required.

- `apps/web`: TanStack Router frontend.
- `apps/server`: Hono server on Node.js; produces jobs only.
- `apps/worker`: independent Node.js BullMQ consumer; owns worker resources and shutdown.
- `packages/api`: Hono/oRPC boundaries, procedures and Better Auth factory under `src/auth.ts`.
- `packages/business`: users and Todo services; user-owned task contracts, producer and Worker factory.
- `packages/observability`: Pino logs, explicit OpenTelemetry traces/metrics and shared deadline helper.
- `packages/queue`: generic BullMQ connection and telemetry factories; no business contracts.
- `packages/db`: PostgreSQL factory, schema, migrations and deployment-only runtime role provisioning.
- `packages/ui`: shared UI components.
- Root `tsconfig.base.json`: shared TypeScript configuration.

The server entry owns startup and shutdown. Create dependencies in `apps/server/src/services.ts` and inject them into `createApi`; reusable modules must not create singleton clients at import time. Business procedures use `context.services`, and workers reuse the same service factories with their own instances. Worker factories live in the owning business package (`packages/business/src/users/jobs`), and `apps/worker/src/runtime.ts` explicitly registers them. Worker must not import the API package. Keep the explicit consumer registration in `apps/worker/src/runtime.ts`. Use app_server/app_worker runtime roles in production; reserve the migration owner for deployment tasks. Telemetry must never become a readiness dependency. Keep users routes authenticated and derive user IDs from the session.

Use `README.md` and package scripts as the source of truth for commands. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm check-types`, and `pnpm build` to validate changes. For integration/browser changes, run `pnpm test:integration` and `pnpm test:e2e` against dedicated `TEST_DATABASE_URL`/`TEST_REDIS_URL` services. Use `pnpm exec biome check .` for a read-only lint and formatting check; `pnpm check` also applies fixes.

Todo SQL lives in `packages/business/src/todos/repository.ts`. Bind the authenticated owner with `forUser(userId)`; scoped methods return resolved data and enforce ownership on reads and writes. Never keep a mutable current user on a shared repository or accept ownership from request payloads. Keep pagination, business rules and operation telemetry in the service. Repositories accept an injected database or transaction and do not own connections; add them where scope rules repeat rather than requiring a generic base repository for every module.

Each shared package has bilingual `README.md` / `README.zh-CN.md` extension guides. Read the owning package's guide before adding an export, business operation, schema, job, instrument or component; update it when its extension contract changes. Root READMEs link to these guides, and `docs/development.md` / `docs/development.zh-CN.md` describe application wiring.

PostgreSQL and Redis run through Docker Compose (`pnpm infra:up`). Initialize local configuration with `pnpm env:init`. Apply committed migrations with `pnpm db:migrate` before starting the app with `pnpm dev`.

Keep secrets and local `.env` files out of Git. Follow the existing generated code conventions and keep dependency changes scoped to the package that needs them. Use concise conventional commit subjects.
