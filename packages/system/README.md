# System 包

`@full-stack-example/system` 提供健康检查响应合同、数据库探针和 `GET /health` 路由。

## Responsibilities

负责系统可用性探针和安全的健康响应，不创建数据库客户端，也不暴露底层异常。

## Public API

- `healthResponseSchema` 和 `HealthResponse` 定义稳定的健康响应。
- `setupSystemApp(app, options)` 把健康路由挂载到现有 Hono 应用。
- 探针成功返回 `200/status=ok`，失败返回 `503/status=degraded`。

数据库探针和 logger 通过 options 注入，本包不自行创建基础设施客户端。

## 用法

在组合根挂载健康路由，并注入已有数据库探针和子 logger：

```ts
import { getAppLogger } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { Hono } from "hono";

const app = new Hono();
setupSystemApp(app, {
  checkDatabase: async () => {},
  logger: getAppLogger("system"),
});

const response = await app.request("/health");
```

调用方可以使用 `healthResponseSchema` 校验两种响应；底层异常不会直接返回。

## Development

```bash
pnpm --filter @full-stack-example/system typecheck
pnpm --filter @full-stack-example/system build
```

## Extension rules

保持健康响应适合公开诊断，绝不包含原始数据库错误或 secret。响应合同变化时同步更新路由元数据和行为测试。

See the [System module guide](/modules/system/) and [HTTP API Reference](/reference/http-api/).
