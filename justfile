set dotenv-load := true
set shell := ["bash", "-euc"]
set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]
compose-project := "full-stack-example"

default:
    @just --list

init:
    pnpm install

launch:
    just dev

launch-clean:
    pnpm exec tsx scripts/launch.ts --stop-infra-on-exit

launch-doctor:
    pnpm exec tsx scripts/launch.ts --doctor

dev:
    pnpm exec tsx scripts/launch.ts

dev-only:
    pnpm exec tsx scripts/dev-processes.ts

dev-web:
    node scripts/run-dev-component.mjs web

routes-generate:
    pnpm --filter @full-stack-example/web routes:generate

dev-api:
    node scripts/run-dev-component.mjs api

dev-worker:
    node scripts/run-dev-component.mjs worker

docs-generate:
    pnpm docs:generate

docs-dev:
    pnpm docs:dev

docs-build:
    pnpm docs:build

docs-preview:
    pnpm docs:preview

build:
    pnpm -r run build

typecheck:
    pnpm -r run typecheck
    pnpm exec tsc -p tsconfig.scripts.json --noEmit

test:
    pnpm exec tsx scripts/run-tests.ts

test-watch:
    pnpm exec vitest --config vitest.config.ts

lint:
    node node_modules/@biomejs/biome/bin/biome check --config-path biome.json --write .

lint-check:
    node node_modules/@biomejs/biome/bin/biome check --config-path biome.json .

format:
    node node_modules/@biomejs/biome/bin/biome format --config-path biome.json --write .

format-check:
    node node_modules/@biomejs/biome/bin/biome format --config-path biome.json .

check:
    just lint-check
    just typecheck
    just test

verify:
    just check
    just build
    pnpm docs:build

container-build:
    podman build --file container/Dockerfile --tag full-stack-example:local .

stack-up:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml --profile application up -d --build --wait

stack-down:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml --profile application down

stack-logs:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml --profile application logs -f app jobs-worker postgres otel-collector

stack-status:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml --profile application ps

db-generate:
    pnpm --filter @full-stack-example/database db:generate

db-migrate:
    pnpm --filter @full-stack-example/database db:migrate

jobs-migrate:
    pnpm --filter @full-stack-example/jobs db:migrate

admin-provision:
    pnpm --filter @full-stack-example/api admin:provision:dev

provision:
    just db-migrate
    just jobs-migrate
    just admin-provision

jobs-worker:
    pnpm --filter @full-stack-example/api jobs:worker

jobs-test-integration:
    pnpm exec tsx scripts/run-tests.ts --postgres jobs

db-test-integration:
    pnpm exec tsx scripts/run-tests.ts --postgres database

auth-test-integration:
    pnpm exec tsx scripts/run-tests.ts --postgres auth

db-studio:
    pnpm --filter @full-stack-example/database db:studio

infra-up:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml up -d --build --wait --wait-timeout 60 postgres otel-collector-health
    just provision

infra-down:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml down

infra-reset:
    @echo "WARNING: deleting the full-stack-example PostgreSQL data volume. This cannot be undone."
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml down
    podman volume rm {{compose-project}}_postgres-data

infra-logs service="postgres":
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml logs -f {{service}}

otel-logs:
    podman compose --project-name {{compose-project}} --env-file .env -f container/compose.yaml logs -f otel-collector
