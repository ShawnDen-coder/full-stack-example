# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

A TypeScript full-stack example with authenticated personal todos, user profiles, and background jobs running in a separate worker process.

Built with React / TanStack Router, Hono / oRPC, Better Auth, Drizzle / PostgreSQL, and BullMQ / Redis. Shared UI uses shadcn/ui and Tailwind CSS.

## Quick start

Use Node.js 24, pnpm 11.0.9, and Docker Compose. Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm env:init
pnpm infra:up
pnpm db:migrate
pnpm dev
```

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
[API](packages/api/README.md) · [Business](packages/business/README.md) · [Database](packages/db/README.md) · [Queue](packages/queue/README.md) · [Observability](packages/observability/README.md) · [UI](packages/ui/README.md).

Commands are defined in [package.json](package.json); shared TypeScript settings live in [tsconfig.base.json](tsconfig.base.json).
