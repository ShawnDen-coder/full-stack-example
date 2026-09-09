# API Client 包

`@full-stack-example/api-client` 把 API 的 Hono `AppType` 转换成浏览器可用的、带类型提示的客户端。它只负责请求类型和错误解析，不创建服务器，也不在导入时发起网络请求。

## 职责边界

集中管理 API 路径、参数、JSON 响应类型和安全错误，避免 Web 手写重复接口定义。

## 对外接口

- `createApiClient(baseUrl)` 创建带凭据的客户端。
- `ApiClient` 暴露推导出的客户端类型。
- `parseResponse(response)` 只解析失败响应，并抛出 `ApiError`。
- `ApiError` 包含 HTTP 状态、安全消息和可选请求 ID。

本包只以类型方式导入 API 合同；导入本包不会启动服务器，也不会自动发起请求。

## 依赖关系

```text
Web → API Client → API contract（仅类型）
```

浏览器产物不会包含 API、Database 或 Auth server 的运行时代码。

## 用法

在浏览器边界创建一次客户端，直接使用 Hono 推导的路由树：

```ts
import { createApiClient, parseResponse } from "@full-stack-example/api-client";

const api = createApiClient("http://localhost:3000");
const response = await api.api.todos.$get();
if (!response.ok) return parseResponse(response);
const { todos } = await response.json();
```

写操作使用 API 路由声明的参数和 JSON body：

```ts
const response = await api.api.todos.$post({ json: { title: "编写文档" } });
if (response.status !== 201) return parseResponse(response);
const todo = await response.json();
```

删除接口成功返回 `204`，没有 JSON body：

```ts
const response = await api.api.todos[":id"].$delete({ param: { id: "1" } });
if (response.status !== 204) return parseResponse(response);
```

## 错误处理

`parseResponse` 会优先读取服务端的安全 `error` 字段，并保留 `X-Request-ID`。页面可以按 `ApiError.status` 区分 `401`（重新登录）、`400`（需要选择组织）、`403`（权限不足）和 `404`（资源不可见或不存在）。

## 开发与验证

```bash
pnpm --filter @full-stack-example/api-client typecheck
pnpm --filter @full-stack-example/api-client build
```

客户端自动跟随 API 合同变化获得类型错误；认证 Cookie 由浏览器管理，不能把 Session token 写进业务代码。

## 扩展规则

始终从 `@full-stack-example/api/contract` 获取 `AppType`，不要再写第二份接口合同或生成另一套客户端；解析错误时保留请求 ID 以便关联 API 日志。

参阅[类型接口参考](/reference/)和 [HTTP API 参考](/reference/http-api/)。
