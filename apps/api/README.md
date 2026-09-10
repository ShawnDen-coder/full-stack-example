# API 应用

`@full-stack-example/api` 是 Hono 宿主，也是唯一组合根；中间件、功能路由、OpenAPI 和生产 Web 静态资源都在 `src/app.ts` 组装。

## 职责边界

- 安装 request ID、CORS、安全响应头、body limit、timeout、日志和 OpenTelemetry middleware。
- 注册 Auth、System、Todos 和仅开发期使用的日志流。
- 在启用文档时提供 `GET /docs` Swagger UI 及 `GET /openapi.json`；生产环境默认关闭，可用 `API_DOCS_ENABLED=true` 显式开启。
- 统一处理 404 和未捕获异常。
- 在生产容器中提供构建后的 Web 应用。

API 不持有数据库 schema 或 Todo 业务规则，这些能力通过包接口注入。

## 对外接口

- `createApp(options)` 创建完整 Hono 应用。
- `AppType` 是 `@full-stack-example/api-client` 使用的 RPC 类型合同。
- `src/bootstrap.ts` 创建运行时依赖，`src/server.ts` 启动 Node 进程。

## 依赖与启动流程

```text
读取配置 → 配置日志/遥测 → migrator 执行迁移 → 创建 runtime Database
→ 创建 Auth 和 Todo Service → createApp 组合路由 → 开始监听
```

## 使用流程

从仓库根目录启动完整本地环境：

```bash
just init
Copy-Item .env.example .env
just launch
```

测试组合应用时应注入 Auth 和确定性的依赖，不需要监听端口：

```ts
const app = createApp({
  logger,
  http: { webOrigin: "http://localhost:5173" },
  documentation: { enabled: true },
  modules: {
    system: { checkDatabase: async () => {} },
    todos: { service: todoService },
    auth,
  },
  web: {},
});

const response = await app.request("/health");
```

## 错误与边界行为

- 未知 API 路径返回统一 JSON `404`。
- 未捕获异常返回不泄露内部信息的 JSON `500`。
- Todo 请求依次可能返回 `401`、`400`、`403`、`404`，具体语义由 Auth 和 Todos README 定义。
- 生产 `bootstrap` 必须提供 Auth；无 Auth 的组合方式只适用于隔离的测试场景，不应作为运行配置。

## 开发与验证

```bash
pnpm --filter @full-stack-example/api dev
pnpm --filter @full-stack-example/api typecheck
pnpm --filter @full-stack-example/api build
```

常规本地流程使用 `just launch`，它会启动基础设施以及 API/Web watch 进程。API 监听 `http://localhost:3000`。

## 扩展规则

新功能通过 `setupXxxApp(app, options)` 接入，并继续使用返回的 Hono app。保持 `apps/api/src/app.ts` 为显式组合根，保留推导的 `AppType`，不要引入通用模块注册器。

参阅 [HTTP API 参考](/reference/http-api/)和 [API 模块说明](/modules/api/)。
