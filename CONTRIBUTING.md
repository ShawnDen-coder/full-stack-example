# Contributing

[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md) · [Project overview](README.md)

Start a development environment with the [quick start](README.md#quick-start). Read the [development guide](docs/development.md) for application wiring and the owning package guide before extending a shared package. Run all commands from the repository root.

## Before submitting

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check-types
pnpm build
pnpm check:boundaries
pnpm exec biome check .
```

`pnpm check` applies Biome fixes. Scope dependency changes to the owning package; keep `devEngines.runtime`, `engines`, `.node-version`, Node types, CI, and Docker runtimes aligned on Node 24. pnpm 12.15.0 manages the project runtime; verify it with `pnpm node --version`. To update Node within the supported major, run `pnpm runtime set node 24.x`, review the manifest and lockfile, and repeat the checks above. Commit the generated lockfile, including its pnpm boot document and runtime checksums. Dependency upgrades, especially Drizzle RC changes, need the full validation pipeline and should not be mixed with unrelated features.

Husky runs lint-staged on staged files and Cocogitto on commit messages; install the CLI below before committing. CI is authoritative; local hooks do not replace it.

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

## Validation

GitHub Actions verifies Node 24 with pnpm 12.15.0 and the committed lockfile.
Offline tests cover HTTP boundaries, readiness, sanitized logs and worker
lifecycle. Integration tests use real PostgreSQL/Redis, committed migrations,
Better Auth, job retries, connection termination and SIGTERM. Playwright covers
account switching (including delayed responses), failed writes and expired
sessions. The production smoke test exercises the built Nginx/API/worker stack,
secure cookies and a deep SPA route. Deployment guard tests ensure failed
migrations prevent subsequent application replacement.

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

Role tests configure the fixed app_server/app_worker roles and public-schema grants, so the PostgreSQL instance must also be dedicated.

## Static documentation

GitHub Pages uses Rspress, with content from the root README, this guide, `docs/*.md`, and the six package READMEs. Edit these source files; `docs/content` and `docs/doc_build` are generated and never committed.

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

Development and preview use the `/full-stack-example/` base path. Builds produce both languages, Mermaid diagrams, an OpenAPI specification from the current oRPC router, and TypeScript Reference without starting a database, Redis, or application service. Documentation links become site routes; source links point to GitHub.

Navigation and route mapping live in `docs/scripts/content.ts`; layout and theme live in `docs/rspress.config.ts` and `docs/styles/index.css`. When changing mappings, run `pnpm --filter @full-stack-example/docs test`; inspect `pnpm docs:build` output and verify navigation, search, language switching, and deep links on desktop and mobile.

`.github/workflows/docs.yml` builds PRs and deploys to GitHub Pages after merging into `master`; it also supports manual dispatch. The workflow uses Node.js 24, pnpm 12.15.0, and the lockfile.

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
