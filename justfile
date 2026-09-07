set dotenv-load := true
set shell := ["bash", "-euc"]
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default:
    @just --list

init:
    pnpm install

launch:
    pnpm launch

launch-clean:
    pnpm launch:clean

launch-doctor:
    pnpm launch:doctor

dev:
    pnpm dev

dev-web:
    pnpm dev:web

dev-api:
    pnpm dev:api

build:
    pnpm build

typecheck:
    pnpm typecheck

test:
    pnpm test

lint:
    pnpm lint

lint-fix:
    pnpm lint:fix

format:
    pnpm format

format-check:
    pnpm format:check

check:
    pnpm check

db-generate:
    pnpm --filter @full-stack-example/database db:generate

db-migrate:
    pnpm --filter @full-stack-example/database db:migrate

db-studio:
    pnpm --filter @full-stack-example/database db:studio

infra-up:
    podman compose -f container/compose.yaml up -d

infra-down:
    podman compose -f container/compose.yaml down

infra-logs:
    podman compose -f container/compose.yaml logs -f postgres
