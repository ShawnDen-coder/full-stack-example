# Logging 包

`@full-stack-example/logging` 统一 LogTape 配置、结构化子 logger、敏感字段脱敏和开发期内存日志流。

## Responsibilities

负责日志输出策略和安全脱敏，不负责业务审计存储；日志流是进程内诊断能力，重启后不会保留。

## Public API

- `configureLogging(options)` 配置级别、格式、环境和可选文件输出。
- `getAppLogger(category)` 创建结构化子 logger。
- Stream helpers 提供可选的开发 SSE 诊断流。

本包不把日志持久化到数据库、不添加缓存，也不提供审计存储。

## 用法

在启动阶段配置一次日志，再由各模块创建子 logger：

```ts
import { configureLogging, getAppLogger } from "@full-stack-example/logging";

await configureLogging({
  service: "example-api",
  environment: "development",
  level: "info",
  pretty: true,
});

const logger = getAppLogger("todos");
logger.info("Todo service ready", { event: "todos.ready" });
```

进程退出时调用 `shutdownLogging()`，确保文件 sink 和遥测被刷新。

## Development

```bash
pnpm --filter @full-stack-example/logging typecheck
pnpm --filter @full-stack-example/logging build
```

仅在本地诊断时设置 `LOG_STREAM_ENABLED=true`；生产暴露日志流前必须经过管理员鉴权。

## Extension rules

使用稳定的结构化事件名和子 logger；写入 JSON Lines 或发送遥测前必须经过既有脱敏策略。不得自行引入第二套日志后端。

See the [Logging module guide](/modules/logging/) and [observability guide](/architecture/observability/).
