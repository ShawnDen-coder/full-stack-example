# API 应用

`@full-stack-example/api` 是服务端 HTTP 宿主和四类同镜像进程的 workspace：API server、Jobs Worker、migration、admin provisioning。它是唯一 Hono 组合根，但不是领域逻辑的归属点。

```text
src/
  app/          根应用与 /api 子应用组合、全局 HTTP policy、OpenAPI、Web assets
  features/     API 自有 HTTP 功能（Jobs Admin、Bull Board、Diagnostics）
  config/       按进程定义 Zod environment schema 和解析函数
  runtime/      API 资源生命周期、环境加载、listen、telemetry
  entrypoints/  加载环境并启动各进程的薄入口
  index.ts      workspace 公共 API
  contract.ts   仅供类型消费的 AppType 入口
```

## 职责边界

- 安装 request ID、CORS、安全响应头、body limit、timeout、日志和 OpenTelemetry middleware。
- 必须注入 Auth，并注册 System、Todos、可选的 Jobs 管理 API、独立的 Bull Board 和可选管理员日志流。日志流默认关闭；设置 `LOG_STREAM_ENABLED=true` 后仍要求平台管理员的新鲜 Session。
- 在启用文档时提供 `GET /docs` Swagger UI 及 `GET /openapi.json`；生产环境默认关闭，可用 `API_DOCS_ENABLED=true` 显式开启。文档包含邮箱认证、工作区切换及 Todo 的 Cookie 鉴权说明；在 Swagger 登录后，后续请求会复用同源 Session Cookie。
- 统一处理 404 和未捕获异常。
- 在生产容器中提供构建后的 Web 应用。

API 只接收 `DATABASE_RUNTIME_URL`，不持有 migrator 凭据或管理员初始密码。数据库 migration 和平台管理员初始化由短生命周期的 `migrate`、`admin-provision` 进程完成；本地通过 `just provision` 一次执行。邮件依赖的 Auth 能力暂不启用。

API 不持有数据库 schema 或 Todo 业务规则，这些能力通过包接口注入。

## 对外接口

- `createApp(options)` 创建完整 Hono 应用。
- `CreateAppOptions.services` 注入 Auth、System 探针和 Todo service；`features` 只描述可选 HTTP 表面及宿主级文档/Web 设置。
- `AppType` 是完整 API 的 RPC 类型合同；Web 按需使用 System/Todos 子路由类型，避免在消费端实例化整棵路由类型。
- `src/app/create-app.ts` 创建组合后的 Hono 应用，`src/runtime/api-server.ts` 创建运行依赖，`src/entrypoints/api.ts` 启动 Node 进程。

## 依赖关系

```text
entrypoints/api → runtime/api-server → app/create-app → Auth/Database/Jobs/Logging/业务模块
API → Todos、System、可选 Jobs 管理路由
```

## 生命周期

启动时先配置日志和遥测，创建 runtime Database 并验证 Drizzle migration journal，再创建 Auth、Jobs producer 和业务 service，最后组合 Hono app 并等待 HTTP server 的 `listening` 事件。关闭时按 HTTP、Jobs、Database、遥测、日志的顺序释放资源；端口冲突会使启动失败并清理已创建资源。迁移和管理员 provisioning 在独立的一次性命令中完成。

## 配置与运行资源

API 要求 `DATABASE_RUNTIME_URL`、`BETTER_AUTH_SECRET` 和 Web/API origin 配置。生产 API 不接收 `DATABASE_MIGRATOR_URL` 或 `PLATFORM_ADMIN_PASSWORD`。可选资源包括 Jobs producer、Bull Board、日志 SSE、OpenAPI 和生产 Web 静态目录；具体开关见[配置指南](/guide/configuration/)。

每个进程入口先加载仓库根目录 `.env`，API/Worker 随后清除 migrator、maintenance 和管理员 provisioning 凭据，再调用自己的 `parseXxxEnvironment()`。Zod schema 的 `z.output` 类型直接传入 runtime；配置错误按变量名报告，不泄露连接串或密钥。新增配置时只在所属进程 schema 中声明并消费，布尔值必须写为 `true` 或 `false`。

## 使用流程

从仓库根目录启动完整本地环境：

```bash
just init
Copy-Item .env.example .env
just dev
```

测试组合应用时应注入 Auth 和确定性的依赖，不需要监听端口：

```ts
const app = createApp({
  logger,
  http: { webOrigin: "http://localhost:5173" },
  services: {
    auth,
    system: { checkDatabase: async () => {} },
    todos: todoService,
  },
  features: {
    documentation: { enabled: true },
    web: {},
  },
});

const response = await app.request("/health");
```

## 错误与边界行为

- 未知 API 路径返回统一 JSON `404`。
- 未捕获异常返回不泄露内部信息的 JSON `500`。
- Todo 请求依次可能返回 `401`、`400`、`403`、`404`，具体语义由 Auth 和 Todos README 定义。
- `createApp()` 类型要求提供 Auth；Todo 和 Jobs 管理路由不能在无认证的情况下挂载。
- 示例 enqueue endpoint 属于 API 组合层；Jobs 包只提供 Producer、Worker、BullMQ adapter、migration 和 Bull Board 能力。

## 开发与验证

```bash
pnpm --filter @full-stack-example/api dev
pnpm --filter @full-stack-example/api typecheck
pnpm --filter @full-stack-example/api build
```

常规本地流程使用 `just dev`，它先完成基础设施、migration 和管理员 provisioning，再以 watch 模式启动 API、Worker 和 Web。API 只有在 HTTP 端口实际监听后才记录启动成功，监听失败时会关闭已创建资源。API 监听 `http://localhost:3000`。

## 扩展规则

新领域能力优先放在对应 workspace package；只有 API 自己拥有的 HTTP 流程才放进 `features/`。所有功能通过 `setupXxxApp(app, options)` 接入既有 Hono app，并返回链式 app。API 宿主集中创建策略、组合 setup 返回值，并将 Auth、Todos、Jobs Admin、Diagnostics 子应用统一挂载到 `/api`；System、Bull Board、OpenAPI 和 Web fallback 属于根应用。保持 `apps/api/src/app/create-app.ts` 为显式组合根，保留推导的 `AppType`，不要引入通用模块注册器。

复杂模块使用相对路径子应用和 `createFactory().createHandlers()`：

```text
route.desc.ts     → describeRoute 的纯配置
route.handler.ts  → 校验、鉴权和 HTTP handler
route.ts          → 一行一端点的子应用组装，再由宿主 app.route() 挂载
```

`service.ts` 保持纯业务逻辑，`types.ts` 保存模块配置和 Context Variables。System 只有一个健康端点，因此保持紧凑。路由模块不创建第二个服务器，也不通过自动扫描或通用 registry 注册。

参阅 [HTTP API 参考](/reference/http-api/)和 [API 模块说明](/modules/api/)。
