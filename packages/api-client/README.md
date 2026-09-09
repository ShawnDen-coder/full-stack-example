# API Client 包

`@full-stack-example/api-client` 把 API 的 Hono `AppType` 转换成浏览器可用的、带类型提示的客户端。它只负责请求类型和错误解析，不创建服务器，也不在导入时发起网络请求。

## Responsibilities

集中管理 API 路径、参数、JSON 响应类型和安全错误，避免 Web 手写重复接口定义。

## Public API

- `createApiClient(baseUrl)` 创建带凭据的客户端。
- `ApiClient` 暴露推导出的客户端类型。
- `parseResponse(response)` 解析成功响应，失败时抛出 `ApiError`。
- `ApiError` 包含 HTTP 状态、安全消息和可选请求 ID。

The package imports the API contract only for types; it does not start a server or make network requests during import.

## 用法

在浏览器边界创建一次客户端，直接使用 Hono 推导的路由树：

```ts
import { createApiClient, parseResponse } from "@full-stack-example/api-client";

const api = createApiClient("http://localhost:3000");
const response = await api.api.todos.$get();
const todos = await parseResponse(response);
```

写操作使用 API 路由声明的参数和 JSON body：

```ts
const response = await api.api.todos.$post({ json: { title: "Write docs" } });
const todo = await parseResponse(response);
```

## Development

```bash
pnpm --filter @full-stack-example/api-client typecheck
pnpm --filter @full-stack-example/api-client build
```

客户端自动跟随 API 合同变化获得类型错误；认证 Cookie 由浏览器管理，不能把 Session token 写进业务代码。

## Extension rules

始终从 `@full-stack-example/api/contract` 获取 `AppType`，不要再写第二份接口合同或生成另一套客户端；解析错误时保留请求 ID 以便关联 API 日志。

See the [TypeScript API Reference](/reference/) and [HTTP API Reference](/reference/http-api/).
