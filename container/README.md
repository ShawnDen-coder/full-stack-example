# Container configuration

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../README.md)

Compose stacks, application images, the web reverse proxy and the optional telemetry Collector live here. Run all commands below from the repository root with pnpm 12.15.0 and Docker Compose available. pnpm manages Node.js 24 for host commands via the root manifest and lockfile. Image builders install pnpm 12.15.0 and use the same frozen lockfile; server and worker production images run directly on `node:24-slim` without pnpm.

## Files

| File | Responsibility |
| --- | --- |
| [compose.yml](compose.yml) | Local PostgreSQL/Redis and optional containerized web/server/worker |
| [compose.production.yml](compose.production.yml) | Production stack, migration task and runtime-role provisioning |
| [compose.observability.yml](compose.observability.yml) | Optional Collector overlay for either stack |
| [server/Dockerfile](server/Dockerfile) | Server image, including migration and role-provisioning entry points |
| [worker/Dockerfile](worker/Dockerfile) | Independent queue consumer image |
| [web/Dockerfile](web/Dockerfile) | Frontend build and Nginx runtime image |
| [web/nginx.conf](web/nginx.conf) | Static assets, SPA fallback and auth/RPC/API-reference proxying |
| [observability/collector.yml](observability/collector.yml) | OTLP receiver, debug trace exporter and Prometheus metrics endpoint |

## Local development

The usual workflow runs PostgreSQL and Redis in containers and the applications on the host:

```bash
pnpm install --frozen-lockfile
pnpm env:init
pnpm infra:up
pnpm db:migrate
pnpm dev
```

`pnpm infra:down` stops PostgreSQL and Redis while keeping their data volumes. To run the applications in containers after initializing configuration and applying migrations:

```bash
docker compose -f container/compose.yml up -d --build
docker compose -f container/compose.yml logs -f
```

Stop host application processes before starting their container equivalents to free ports 3000 and 3001. The local stack exposes web at port 3001, server at port 3000, and PostgreSQL/Redis on loopback ports 5432/6379. Application containers do not automatically apply local migrations.

## Production deployment

Provide production configuration according to [deploy/.env.schema](../deploy/.env.schema), using process environment variables or the ignored `deploy/.env` file. The root scripts load this configuration through Varlock:

```bash
pnpm docker:build
pnpm docker:up
pnpm docker:logs
pnpm docker:down
```

`docker:up` uses [scripts/deploy.mjs](../scripts/deploy.mjs) to build images, wait for PostgreSQL/Redis, migrate, provision runtime roles, and then update applications. `docker:down` keeps data volumes. Production requires an external HTTPS reverse proxy forwarding to `127.0.0.1:8080` by default. Follow the [operations guide](../docs/operations.md) for credentials, database roles, migration failure handling, backups and recovery.

## Optional telemetry

```bash
pnpm telemetry:up
pnpm telemetry:down
```

These scripts combine the local Compose file with the Collector overlay. Enable application telemetry with `OTEL_ENABLED=true`; host applications use `http://localhost:4318`, while containers use `http://otel-collector:4318`. The Collector exposes metrics at `http://127.0.0.1:8889/metrics`.

For production, combine `container/compose.production.yml` with `container/compose.observability.yml` and load deployment configuration through Varlock. The Collector is optional and must not become a readiness dependency. See the [observability guide](../docs/observability.md) for production exporters and storage.

## Path and extension rules

- Compose paths are relative to the first Compose file. Keep `context: ..` so every image builds from the repository root; Dockerfile paths such as `container/server/Dockerfile` and `COPY` sources are relative to that context.
- The root [.dockerignore](../.dockerignore) controls build exclusions. Local environment value files must remain outside image layers. Application environment schemas stay with their applications; production environment configuration stays in `deploy/`.
- Keep `name: full-stack-example` stable. Use `COMPOSE_PROJECT_NAME` for intentional stack isolation; changing the project name changes the default container/network/volume namespace. Preserve volume keys when moving configuration.
- For a new application image, add a subdirectory here, wire its service into the relevant Compose stacks, and update root scripts and [CI](../.github/workflows/ci.yml) when needed. Keep application startup and shutdown ownership in the application.

Validate local configuration without starting containers:

```bash
docker compose -f container/compose.yml config --quiet
docker compose -f container/compose.yml -f container/compose.observability.yml config --quiet
pnpm exec varlock run --path ./deploy/ -- docker compose -f container/compose.production.yml config --quiet
```

The production check needs the required deployment values. Configuration validation does not replace building images and running the production smoke check described in [CI](../.github/workflows/ci.yml).
