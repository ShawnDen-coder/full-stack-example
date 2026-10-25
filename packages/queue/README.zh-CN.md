# @full-stack-example/queue

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

提供通用 BullMQ 基础设施：Queue／Worker 导出、Redis 连接选项和原生 telemetry 适配器。具体业务任务放在所属业务模块。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/index.ts](src/index.ts) | `createQueueConnection`、`createQueueTelemetry` 和 Queue／Worker 导出 |
| [tests/connection.test.mjs](tests/connection.test.mjs) | 不依赖 Redis 的初始化／关闭竞态回归测试 |
| [依赖补丁说明](../../patches/README.md) | 固定版本的 BullMQ 生命周期修复和移除条件 |

## 扩展步骤

1. 只有跨业务通用的连接、重试或 telemetry 行为放在本包；队列名、payload、保留策略和 processor 放在 [business 任务模块](../business/README.zh-CN.md)。
2. 生产者使用 `createQueueConnection(url)`，限制重试并关闭离线命令缓冲。消费者使用 `createQueueConnection(url, "worker")`，允许阻塞读取和持续重连，不能套用生产者命令超时。修改 URL 解析时保留 TLS、凭据和数据库选择支持。
3. 生产者和消费者都传入 `createQueueTelemetry()`，复用原生上下文传播，不在业务 payload 中手工保存 trace context。
4. 创建资源的进程负责错误监听和关闭；关闭队列前先停止指标观察器，导入模块时不创建客户端。
5. 升级 BullMQ 时同时检查 `bullmq-otel` 兼容性和[版本化补丁](../../patches/README.md)，验证初始化失败和提前关闭，而不只测试成功连接。

新增任务应修改业务模块，在 [server services](../../apps/server/src/services.ts) 接入生产者，并在 [Worker runtime](../../apps/worker/src/runtime.ts) 显式组装消费者。本包没有业务任务注册表，增加契约不会自动启动消费者。

## 示例：允许配置 Redis 连接超时

假设多个 producer／consumer 都需要调整 Redis 建连超时，可以扩展 [src/index.ts](src/index.ts) 中已有的 `createQueueConnection`，增加可选的第三个参数（当前尚无此选项）：

```ts
options: { connectTimeoutMs?: number } = {},
```

在构造返回的连接配置前校验它：

```ts
const connectTimeout = options.connectTimeoutMs ?? 5000;
if (!Number.isInteger(connectTimeout) || connectTimeout <= 0) {
  throw new Error("Redis connection timeout must be a positive integer");
}
```

返回对象中仅将 `connectTimeout: 5000` 替换为 `connectTimeout`，保留 URL／TLS／凭据解析、producer 命令超时，以及 Worker 的 `maxRetriesPerRequest: null`。已有两个参数的调用保持有效，业务任务工厂中的新调用可以写成：

```ts
createQueueConnection(redisUrl, "worker", { connectTimeoutMs: 8000 });
```

如果不同部署需要不同值，由应用配置和工厂参数逐层传入，本包不读取应用 env 文件。参照 [connection tests](tests/connection.test.mjs) 增加默认值、覆盖值、非法值、TLS 和两种角色的测试，保留已有初始化／关闭竞态回归用例。增加具体业务任务则走[后台任务案例](../../docs/extension-examples.zh-CN.md#案例二新增后台任务)，不往 queue 放任务契约或注册表。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @full-stack-example/queue test
pnpm --filter @full-stack-example/queue check-types
```

连接、重试和上下文传播变更还需用专用服务执行 `pnpm test:integration`。依赖调整后验证构建和隔离的 server／worker 生产部署包，确认运行时携带已修补且兼容的依赖，而不是只在工作区解析成功。
