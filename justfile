set dotenv-load := true
set shell := ["bash", "-euc"]
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default:
    @just --list

init:
    pnpm install

launch:
    pnpm exec tsx scripts/launch.ts

launch-clean:
    pnpm exec tsx scripts/launch.ts --stop-infra-on-exit

launch-doctor:
    pnpm exec tsx scripts/launch.ts --doctor

dev:
    pnpm exec concurrently --kill-others-on-fail --names api,web "pnpm --filter @full-stack-example/api dev" "pnpm --filter @full-stack-example/web dev"

dev-web:
    pnpm --filter @full-stack-example/web dev

dev-api:
    pnpm --filter @full-stack-example/api dev

build:
    pnpm -r run build

typecheck:
    pnpm -r run typecheck

test:
    pnpm -r --if-present run test

lint:
    pnpm exec biome lint .

lint-fix:
    pnpm exec biome lint --write .

format:
    pnpm exec biome format --write .

format-check:
    pnpm exec biome format .

check:
    just lint
    just format-check
    just typecheck
    just test
    just build

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

infra-logs service="postgres":
    podman compose -f container/compose.yaml logs -f {{service}}

otel-logs:
    podman compose -f container/compose.yaml logs -f otel-collector
