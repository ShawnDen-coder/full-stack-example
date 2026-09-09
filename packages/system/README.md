# System 包

`@full-stack-example/system` 提供健康检查响应合同、数据库探针和 `GET /health` 路由。

## 职责边界

负责系统可用性探针和安全的健康响应，不创建数据库客户端，也不暴露底层异常。

## 对外接口

- `healthResponseSchema` 和 `HealthResponse` 定义稳定的健康响应。
- `setupSystemApp(app, options)` 把健康路由挂载到现有 Hono 应用。
- 探针成功返回 `200/status=ok`，失败返回 `503/status=degraded`。

数据库探针和 logger 通过 options 注入，本包不自行创建基础设施客户端。

## 依赖关系

```text
API → System → Logging（Logger 类型与实例）
API → Database（创建探针）
```

System 不直接依赖 Database，因此测试可以传入确定性的探针。

## 用法

在组合根挂载健康路由，并注入已有数据库探针和子 logger：

```ts
import { checkDatabase } from "@full-stack-example/database";
import { getAppLogger } from "@full-stack-example/logging";
import { setupSystemApp } from "@full-stack-example/system";
import { Hono } from "hono";

const app = new Hono();
const withSystem = setupSystemApp(app, {
  checkDatabase: () => checkDatabase(database.db),
  logger: getAppLogger("system"),
});

const response = await withSystem.request("/health");
```

必须继续使用 `setupSystemApp` 的返回值组合后续模块，才能保留 Hono 精确路由类型。调用方可以使用 `healthResponseSchema` 校验两种响应。

## 错误与边界行为

- 数据库探针成功：`200`，`status: "ok"`。
- 数据库探针失败：`503`，`status: "degraded"`，并输出不含原始异常的结构化日志。
- 响应始终设置 `Cache-Control: no-store`。
- 未捕获异常由 API 组合根统一转换为安全的 `500`。

## 开发与验证

```bash
pnpm --filter @full-stack-example/system typecheck
pnpm --filter @full-stack-example/system build
```

## 扩展规则

保持健康响应适合公开诊断，绝不包含原始数据库错误或 secret。响应合同变化时同步更新路由元数据和行为测试。

参阅 [System 模块说明](/modules/system/)和 [HTTP API 参考](/reference/http-api/)。
