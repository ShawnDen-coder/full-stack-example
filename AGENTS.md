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
just lint
just format
```

Use `just check` for the full quality gate. The API uses LogTape, OpenTelemetry and an opt-in development-only SSE log stream; do not add Pino, package-level Biome config, log persistence backends, or caches without an explicit design change.

## Coding Style & Naming Conventions

Use TypeScript ES modules, strict compiler settings, two-space indentation, and double quotes in source files governed by Biome. Keep imports organized and avoid unused locals or parameters. Use `camelCase` for variables/functions, `PascalCase` for types/classes, and lowercase kebab-case for new package directories.

## Testing Guidelines

Tests use Vitest and live under an app or package's `tests/` directory. Name files `*.test.ts` and describe behavior from the caller's perspective. Add or update tests with every behavioral change. Keep tests deterministic and do not depend on network services.

## Commit & Pull Request Guidelines

Existing commits use concise conventional prefixes such as `docs:` and `chore:` (for example, `docs: update docs`). Follow that style: use an imperative subject, keep it short, and include `[skip ci]` only when appropriate. Pull requests should explain the change, identify affected packages, include validation commands and results, and link the related issue or plan when one exists. Include screenshots only for documentation or UI changes.

## Security & Configuration Tips

Do not commit secrets or local environment files. Review generated files and workspace lockfile changes before committing, and keep dependency additions scoped to the package that needs them.
