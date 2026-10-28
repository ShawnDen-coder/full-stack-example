# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

A TypeScript full-stack example with authenticated personal todos, user profiles, and background jobs running in a separate worker process.

Built with React / TanStack Router, Hono / oRPC, Better Auth, Drizzle / PostgreSQL, and BullMQ / Redis. Shared UI uses shadcn/ui and Tailwind CSS.

## Quick start

Set up Podman and its Compose provider using the [container guide](container/README.md#local-development), then verify `podman info` and `podman compose version`. On Windows/macOS, start your Podman machine before running infrastructure commands.

Install pnpm 12.15.0 and Podman Compose. pnpm downloads and manages Node.js 24 for this project via `devEngines.runtime` in `package.json`; the exact version and checksums are committed in `pnpm-lock.yaml`. Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm node --version
pnpm env:init
pnpm infra:up
pnpm db:migrate
pnpm dev
```

If you already have Node.js/npm, install pnpm with `npm install -g pnpm@12.15.0`. Use `pnpm node` for direct Node commands and `pnpm run` / `pnpm exec` for project tools. Your system `node --version` may still show another version. To make bare `node` follow the project too, run `pnpm shim add node` once and ensure `pnpm bin -g` precedes other Node installations on `PATH` (run `pnpm setup` and reopen the terminal if the global bin directory is not configured). No separate Node version manager is required. `.node-version` remains a Node 24 hint for other tools; pnpm uses the manifest and lockfile.

`env:init` creates ignored local configuration with a random auth secret and preserves existing files. This setup targets a new database; for an existing database created with `db:push`, review the [migration guidance](docs/operations.md#database-migrations) first.

Open [localhost:3001](http://localhost:3001), register or sign in, and visit `/todos` to create, complete, and delete tasks. Each account has its own list.

The API runs at [localhost:3000](http://localhost:3000), with an [API reference](http://localhost:3000/api-reference). The [development guide](docs/development.md#application-composition) shows typed profile and background-job calls.

## Documentation

[Read online](https://shawnden-coder.github.io/full-stack-example/en/)

| I want to… | Read |
| --- | --- |
| Understand architecture and application wiring | [Development guide](docs/development.md) |
| Extend a Todo or background job | [Extension examples](docs/extension-examples.md) |
| Deploy, migrate, back up, or recover | [Operations guide](docs/operations.md) |
| Check, contribute, or release | [Contributing](CONTRIBUTING.md) |

For package-specific entry points and extension steps:
[API](packages/api/README.md) · [Domain](packages/domain/README.md) · [Database](packages/db/README.md) · [Queue](packages/queue/README.md) · [Observability](packages/observability/README.md) · [UI](packages/ui/README.md).

Commands are defined in [package.json](package.json); shared TypeScript settings live in [tsconfig.base.json](tsconfig.base.json).

Container configuration lives in [container](container/README.md): Compose files, application Dockerfiles, Nginx, and Collector configuration. Images still build from the repository root using its `.dockerignore`; deployment environment configuration stays in `deploy/`.

[Roles and page access](docs/access-control.md) · [Shared access contracts](packages/access/README.md)
