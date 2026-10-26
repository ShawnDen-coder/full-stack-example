# Observability operations

[English](observability.md) · [简体中文](observability.zh-CN.md) · [Operations guide](operations.md)

The Server and Worker emit Pino JSON to stdout. Route names, operation names,
queue names and outcomes are bounded labels. Request/user/job IDs, raw URLs,
SQL text, query parameters, Cookie/Authorization headers and payload bodies must
never be metric labels. Raw statements, parameters and credentials are not span
attributes. Error logs sanitize driver messages; traces record failure status.

## Enable and inspect

```bash
pnpm telemetry:up
# Supply these environment overrides to Server and Worker:
OTEL_ENABLED=true pnpm dev
```

Host development exports to `http://localhost:4318`. Container deployments use
`http://otel-collector:4318`, or an explicitly configured external
`OTEL_EXPORTER_OTLP_ENDPOINT`. The optional Collector is defined in
`container/compose.observability.yml`; when using the production stack, combine that file
with `container/compose.production.yml` instead of the development Compose file.

The example Collector exports metrics at `http://127.0.0.1:8889/metrics` and trace
summaries to its logs. It is a diagnostic receiver, not durable trace storage.
For production, replace the debug exporter with an OTLP exporter to your chosen
trace backend, add bounded exporter queues/retries, and have the existing host
or Kubernetes log agent collect stdout. Keep Collector ports internal. This
repository does not provision a log store, trace store or backup scheduler.

Use one SDK per process. Set `OTEL_SERVICE_VERSION` to the deployed commit/image
version. `OTEL_TRACES_SAMPLER_ARG` controls root sampling (0–1, default 1);
upstream sampling decisions are respected. Trace sampling does not suppress
error logs. If retaining every failed trace is required, plan Collector tail
sampling separately. Choose retention from operational need and storage budget.

Instrumentation is explicit at HTTP, business query and BullMQ boundaries,
so it works in bundled ESM output. Instrumented third-party vendors stay
external in production bundles. Neither collectors nor exporters are readiness
dependencies. Exports use batch processing and finite network timeouts. During
shutdown applications drain work, close owned clients, then shut down telemetry
within the process deadline. Queue observers detach before Redis is closed.

## Logs and correlation

- Common fields: `service`, `version`, `environment`, `event`, `trace_id`, `span_id`.
- Requests: `request_id`, normalized `route`, `method`, `status`, `duration_ms`.
- Jobs: `job_id`, `job_name`, originating `request_id`, `attempt`, `duration_ms`.
- Authentication/validation rejections are info; retryable job failures are warn;
  unexpected application errors and exhausted job attempts are error.
- HTTP completion summaries and one exception log are complementary. Business
  code should not repeatedly log and rethrow the same exception.

The native BullMQ telemetry adapter propagates message creation context from
Queue to Worker. The task payload retains the originating request ID for log
search; it does not contain a browser session or credentials. Retries are distinct
attempts. SQL operation spans record stable names, never the query or bind values.

## Metrics and health

- `http.server.requests`, `http.server.request.duration`: HTTP volume, status and latency.
- `app.operation.duration`: named business query duration and outcome.
- `db.pool.connections`, `db.pool.waiting`: pool usage and saturation per process.
- `jobs.queue.depth`, `jobs.queue.oldest_age`: backlog by state and oldest waiting age.
- `process.memory.usage`, `nodejs.eventloop.delay.p99`: process memory and event-loop delay.
- `jobs.queue.delay`, `jobs.process.duration`, `jobs.attempts`: per-attempt delay,
  execution time and completed/retry/failed outcomes. Queue delay includes retry wait.

Prometheus normalizes dots to underscores and adds unit/type suffixes.
`/health` is liveness; `/ready` checks PostgreSQL; `/ready/jobs` checks Redis queue
availability. Health traffic is excluded from request traces and routine logs.
The Worker has no HTTP port. Its container probe reads an atomically written
heartbeat, refreshed after consumption-loop, PostgreSQL and Redis checks pass.
A stale or missing heartbeat fails the container check.

Start with alerts for sustained 5xx/latency, pool waits, growing oldest job age,
exhausted retries and unhealthy Worker. Set thresholds from observed workload;
queue connectivity alone does not establish successful consumption.

## Acceptance checks

1. Sign in, create a Todo and submit `users.enqueueProfileRead()`. Follow the same
   trace from HTTP to Queue/Worker and `users.getProfile`; join logs by trace ID.
2. Run two accounts concurrently and confirm their trace contexts remain distinct.
3. Induce a job retry and check attempt numbers, warn/error severity and metrics.
4. Stop the Collector: CRUD and jobs must continue. Restart it and verify export resumes.
5. Stop Redis: `/ready` and Todo still work, `/ready/jobs` returns 503 and job RPCs
   return `SERVICE_UNAVAILABLE`. Resume Redis and verify queue recovery.
6. Stop the Worker: its health probe fails and queue age rises. Restart and drain.
7. Send SIGTERM during work: drain, close clients, flush telemetry and exit within deadline.

Offline tests cover context isolation, log correlation, secret exclusion and metric
labels. Integration tests and production Compose smoke cover the real queue,
authentication, runtime roles and process lifecycle. Use dedicated disposable test
services; never run these scenarios against production data.
