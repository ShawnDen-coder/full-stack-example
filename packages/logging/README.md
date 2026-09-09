# Logging 包

`@full-stack-example/logging` 统一 LogTape 配置、结构化子 logger、敏感字段脱敏和开发期内存日志流。

## 职责边界

负责日志输出策略和安全脱敏，不负责业务审计存储；日志流是进程内诊断能力，重启后不会保留。

## 对外接口

- `configureLogging(options)` 配置级别、格式、环境和可选文件输出。
- `getAppLogger(category)` 创建结构化子 logger。
- `createLogStream(options)` 创建有界、进程内的开发日志流。
- `shutdownLogging()` 在退出前刷新并关闭 sink。

## 依赖关系

Logging 不依赖业务包。API 在启动阶段配置它，System 等模块只接收注入的 `Logger`，不会自行修改全局日志配置。

本包不把日志持久化到数据库、不添加缓存，也不提供审计存储。

## 用法

在启动阶段配置一次日志，再由各模块创建子 logger：

```ts
import {
  configureLogging,
  createLogStream,
  getAppLogger,
  shutdownLogging,
} from "@full-stack-example/logging";

const stream = createLogStream({ capacity: 500 });
await configureLogging({
  service: "example-api",
  environment: "development",
  level: "info",
  pretty: true,
  stream,
});

const logger = getAppLogger("todos");
logger.info("Todo service ready", { event: "todos.ready" });

export const stopLogging = () => shutdownLogging();
```

配置必须在创建业务 logger 之前完成，并且整个进程只配置一次。进程关闭路径调用 `await shutdownLogging()`；API 是否暴露 SSE 路由由组合根决定，本包只提供内存流。

## 错误与边界行为

- `level: "silent"` 禁用应用日志输出，适合测试。
- 脱敏字段包括授权头、Cookie、token、API key 和数据库连接串。
- 内存流达到容量后只保留有限历史，进程重启后丢失。
- 文件目录由配置过程创建，但文件写入失败仍应阻止应用静默启动。

## 开发与验证

```bash
pnpm --filter @full-stack-example/logging typecheck
pnpm --filter @full-stack-example/logging build
```

仅在本地诊断时设置 `LOG_STREAM_ENABLED=true`；生产暴露日志流前必须经过管理员鉴权。

## 扩展规则

使用稳定的结构化事件名和子 logger；写入 JSON Lines 或发送遥测前必须经过既有脱敏策略。不得自行引入第二套日志后端。

参阅 [Logging 模块说明](/modules/logging/)和[可观测性说明](/architecture/observability/)。
