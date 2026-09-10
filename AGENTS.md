<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Repository Guidelines

## Project Structure & Module Organization

This repository is a pnpm workspace. Apps live in `apps/`; reusable packages live in `packages/`. Root-level tooling lives in `package.json`, `pnpm-workspace.yaml`, `justfile`, `tsconfig.base.json`, `tsconfig.scripts.json`, and `biome.json`. `biome.json` is the only lint and format configuration. Project notes and design plans are in `docs/`.

## Build, Test, and Development Commands

Install dependencies before working:

```bash
pnpm install                 # or: just init
just build
just typecheck
just test
just test-watch
just lint
just format
just verify
just container-build
```

Use `just check` for the fast source quality gate and `just verify` when compiled artifacts must also be validated. `just test` runs the root Vitest configuration once; do not add package scripts that rediscover the same global suite. Tests consume TypeScript source and must not depend on a prior build. Container files belong under `container/`; its Dockerfile produces one Node image that serves both API and Web through Hono, while Compose's `application` profile runs the complete stack. The API uses LogTape, OpenTelemetry and an opt-in development-only SSE log stream; do not add Pino, package-level Biome config, log persistence backends, or caches without an explicit design change.

Run a single test file with `pnpm exec vitest run --config vitest.config.ts <path/to/file.test.ts>` (drop `run` for watch mode). Package-scoped commands use pnpm workspace filters, e.g. `pnpm --filter @full-stack-example/database typecheck`, `pnpm --filter @full-stack-example/database db:generate`, `pnpm --filter @full-stack-example/database db:migrate`. `just launch` starts PostgreSQL and the OpenTelemetry Collector, runs migrations, and starts the API (`tsx watch`, `:3000`) and Web (Vite, `:5173`) dev servers; `just dev` starts only the two dev servers against infrastructure that is already running. `just db-test-integration` runs the real-PostgreSQL suite in `packages/database/tests/postgres.integration.test.ts`; it and any test requiring `DATABASE_URL` are not part of `just test`.

## Coding Style & Naming Conventions

Use TypeScript ES modules, strict compiler settings, two-space indentation, and double quotes in source files governed by Biome. Keep imports organized and avoid unused locals or parameters. Use `camelCase` for variables/functions, `PascalCase` for types/classes, and lowercase kebab-case for new package directories.

## API Composition

Keep `apps/api/src/app.ts` as the explicit composition root. Cross-cutting HTTP policy belongs there; feature and infrastructure modules receive the host Hono app plus explicit dependencies through concrete `setupXxxApp(app, options)` functions and return the chained app. Do not let modules create a second host app unless they are intentionally mounted sub-applications. Avoid a generic module interface or registry: it erases Hono's precise route types and weakens the exported RPC `AppType` contract.

## Package Architecture & Tenancy

`packages/` holds reusable domain and infrastructure modules: `database` (Drizzle schema, migrations, connection pools, RLS), `auth` (Better Auth session/organization/platform-admin module), `logging` (LogTape config and redaction), `system` (health checks), `todos` (the reference business module), and `api-client` (browser RPC client typed from the API's exported Hono `AppType`). A feature package follows a fixed internal layering and dependency direction: `schemas.ts` (Zod) -> `service.ts` (domain use cases, depends on interfaces) -> `repository.ts` (Drizzle queries, optional) -> `routes.ts` (`setupXxxApp(app, options)`, optional) -> `index.ts` (public exports). Routes only do protocol adaptation; the Web app never accesses the database directly.

This is a multi-tenant app: users authenticate via Better Auth and select an active `organization` (tenant) in their session. Authorization is enforced twice — application middleware via `auth.require.requireTenantPermission({ resource, action })`, wired per-resource in `apps/api/src/app.ts`, and PostgreSQL row-level security as the final backstop. Business tables (e.g. `todos`) require a non-null `tenant_id` and must be queried inside `withTenantTransaction(db, tenantId, ...)`, which sets the Postgres session variable RLS policies key off of. Runtime queries use the `app_runtime` DB role (DML only, RLS-bound); migrations use the separate `app_migrator` role (DDL); see `DATABASE_RUNTIME_URL` / `DATABASE_MIGRATOR_URL` in `.env.example`. New business tables must follow the same `tenant_id` + RLS pattern; do not add DDL/superuser/BYPASSRLS access to the runtime role.

## Testing Guidelines

Tests use Vitest and live under an app or package's `tests/` directory. Name files `*.test.ts` and describe behavior from the caller's perspective. Add or update tests with every behavioral change. Keep tests deterministic and do not depend on network services.

## Commit & Pull Request Guidelines

Existing commits use concise conventional prefixes such as `docs:` and `chore:` (for example, `docs: update docs`). Follow that style: use an imperative subject, keep it short, and include `[skip ci]` only when appropriate. Pull requests should explain the change, identify affected packages, include validation commands and results, and link the related issue or plan when one exists. Include screenshots only for documentation or UI changes.

## Security & Configuration Tips

Do not commit secrets or local environment files. Review generated files and workspace lockfile changes before committing, and keep dependency additions scoped to the package that needs them.
