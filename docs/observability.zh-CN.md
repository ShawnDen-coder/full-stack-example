# 可观测性运维

[English](observability.md) · [简体中文](observability.zh-CN.md) · [运维指南](operations.zh-CN.md)

Server 和 Worker 使用 Pino 向 stdout 输出 JSON。平台已有的日志采集器负责收集；应用通过 OTLP/HTTP 导出 traces 和 metrics。Collector 与 exporter 均不参与业务 readiness。

## 启用

```bash
pnpm telemetry:up
OTEL_ENABLED=true pnpm dev
```

宿主开发默认向 `http://localhost:4318` 导出。容器使用 `http://otel-collector:4318`，也可以配置外部 `OTEL_EXPORTER_OTLP_ENDPOINT`。生产栈使用可选 Collector 时，将 `compose.observability.yml` 与 `compose.production.yml` 组合运行。

示例 Collector 在 `http://127.0.0.1:8889/metrics` 提供 Prometheus 指标，在自身日志输出 trace 摘要。它是诊断接收器，不是持久化存储。生产需要将 debug exporter 替换为目标 trace 后端的 OTLP exporter，配置有界发送队列和重试，并由宿主或 Kubernetes 日志代理采集 stdout。Collector 端口应保持内部可见。本仓库不部署日志存储、trace 存储或备份调度器。

每进程仅创建一个 SDK。`OTEL_SERVICE_VERSION` 使用部署的 commit/image 版本；`OTEL_TRACES_SAMPLER_ARG` 为根 trace 的采样比例，范围 0–1，默认 1，并尊重上游采样决定。Trace 采样不会抑制 error 日志。需要保留全部错误 trace 时，再单独规划 Collector 尾采样。保留时间应按排障需求和容量预算设置。

HTTP、业务查询和 BullMQ 使用显式边界埋点，生产 ESM 打包也适用。第三方观测依赖保持 external。出口采用 batch 和有限网络超时；退出顺序为停止接收/消费、等待任务、关闭业务资源、关闭 telemetry，整体受进程 deadline 限制。队列指标回调在关闭 Redis 前解除。

## 字段与级别

- 公共字段：`service`、`version`、`environment`、`event`、`trace_id`、`span_id`。
- 请求字段：`request_id`、规范化 `route`、`method`、`status`、`duration_ms`。
- 任务字段：`job_id`、`job_name`、来源 `request_id`、`attempt`、`duration_ms`。
- 预期认证/校验拒绝为 info，可重试的任务失败为 warn，意外异常和耗尽重试为 error。
- HTTP 完成摘要与一次异常栈互补，业务层避免逐层重复记录异常。

BullMQ 官方适配器在 Queue 与 Worker 间传播 trace context，任务 payload 只保留日志关联所需的来源 request ID，不传浏览器 session 或凭证。重试按尝试次数记录。SQL span 只记录稳定操作名，不导出 SQL 或绑定参数。

Metric label 仅使用路由模板、操作名、队列和结果等有限集合。用户/request/job ID、原始 URL、SQL、查询参数、Cookie、Authorization 和正文都不能成为 label；敏感内容也不能进入 span attributes。

## 指标与探针

| 指标 | 含义 |
| --- | --- |
| `http.server.requests` / `http.server.request.duration` | 请求量、状态和耗时 |
| `app.operation.duration` | 命名业务查询耗时及结果 |
| `db.pool.connections` / `db.pool.waiting` | 每进程连接池使用和排队 |
| `jobs.queue.depth` / `jobs.queue.oldest_age` | 各状态积压量、最老待处理任务年龄 |
| `process.memory.usage` / `nodejs.eventloop.delay.p99` | 进程内存与事件循环延迟 |
| `jobs.queue.delay` / `jobs.process.duration` / `jobs.attempts` | 每次尝试的等待、执行耗时和成功/重试/失败次数 |

Prometheus 会规范化指标名称并追加单位/类型后缀。队列等待耗时包含重试等待。

`/health` 检查存活，`/ready` 检查 PostgreSQL，`/ready/jobs` 单独检查队列。健康流量不产生例行请求日志和 trace。Worker 不暴露 HTTP 端口：消费循环、数据库和 Redis 探测通过后原子更新本地心跳，心跳缺失或过期使容器检查失败。

首批告警关注持续 5xx/延迟、连接池排队、最老任务年龄持续增长、最终失败以及 Worker 不健康。阈值应根据真实负载设置。

## 验收

1. 登录、创建 Todo、调用 `users.enqueueProfileRead()`，确认 HTTP → Queue → Worker → `users.getProfile` 链路与日志可关联。
2. 两账号并发请求，确认 context 不串线。
3. 制造一次重试，检查 attempt、warn/error 和指标。
4. 停止 Collector，确认业务继续；恢复后确认导出恢复。
5. 停止 Redis，确认 Todo 和 `/ready` 继续工作，`/ready/jobs` 返回 503，任务 RPC 返回 `SERVICE_UNAVAILABLE`；恢复 Redis 后检查队列恢复。
6. 停止 Worker，确认健康失败、积压年龄增长；恢复后检查消费。
7. 在工作中发送 SIGTERM，确认排空、关闭连接、flush 和有界退出。

离线测试覆盖 context 隔离、日志关联、敏感数据排除和低基数 label；真实队列、账号、数据库权限和进程生命周期由 integration 与生产 Compose smoke 验证。测试服务必须专用且可丢弃。
