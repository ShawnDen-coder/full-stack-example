# @my-better-t-app/observability

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

为 server、Worker 和业务服务提供 Pino 结构化日志、显式 OpenTelemetry trace／指标，以及有上限的生命周期等待。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/index.ts](src/index.ts) | Logger 工厂、脱敏、安全错误文本和公共 helper |
| [src/tracing.ts](src/tracing.ts) | 请求上下文提取和命名操作 span |
| [src/metrics.ts](src/metrics.ts) | HTTP、业务操作、连接池、队列和进程指标 |
| [src/telemetry.ts](src/telemetry.ts) | 每个进程显式启动和关闭 SDK |
| [src/deadline.ts](src/deadline.ts) | Promise 超时 helper |
| [tests/telemetry.test.ts](tests/telemetry.test.ts) | 上下文隔离、敏感信息排除和导出失败测试 |

## 扩展步骤

1. 新增业务操作时，在服务里调用 `observeOperation("feature.operation", work)`。它已经记录 span、耗时和结果，不要仅为增加 telemetry 再包裹一次相同工作。
2. 新指标使用稳定名称、单位和有界标签，例如 operation、queue、outcome。request／user／job ID 放入适当日志，不作为指标标签；不导出 SQL 参数、请求体、凭据或任意错误文本。
3. 使用注入的 logger 和结构化事件。扩展脱敏／错误序列化时同步补充敏感信息测试。异常由负责的边界记录，避免多层重复记录并抛出。
4. Observable callback 要能承受依赖失败，注册观察器的 helper 应提供清理函数。先移除观察器、等待执行中的采集结束，再关闭客户端。
5. SDK 和 exporter 只由应用入口调用 `startTelemetry` 创建。导入 helper 时不启动运行资源，exporter 不成为就绪依赖；先 drain 和关闭资源，再关闭 SDK。
6. 公共 helper 通过 `src/index.ts` 导出，SDK 启动沿用 `./telemetry` 子路径。新增外部运行依赖时，同时审查应用依赖声明和隔离生产包。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @my-better-t-app/observability test
pnpm --filter @my-better-t-app/observability check-types
```

Collector 配置、字段和故障场景见[可观测性运维指南](../../docs/observability.zh-CN.md)。BullMQ 上下文传播用真实服务集成测试验证；确认关闭 telemetry 或 Collector 故障仍可执行业务。诊断 Collector 不提供持久化 trace／日志存储。
