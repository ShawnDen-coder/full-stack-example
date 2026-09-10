# Web 应用

`@full-stack-example/web` 是 React/Vite 单页应用，负责浏览器路由、页面组件、TanStack Query 数据获取和浏览器 API client 边界。

## 职责边界

- 使用 TanStack Router 文件路由渲染首页、登录、注册、工作区选择和 Todo 页面。
- 使用 TanStack Query 管理服务端状态，通过 API Client 发起类型安全请求。
- 开发环境解析 API origin，生产环境保持同源请求。

Web 不重复定义 API schema，不导入 Auth server，也不直接访问 PostgreSQL。

## 对外接口

Web 没有供服务端调用的运行时 API；它消费 `@full-stack-example/api-client` 和 `@full-stack-example/auth/client`，构建结果由 API 宿主提供。

`src/routes/` 是路由入口：`__root.tsx` 提供根布局与 404，`_authenticated.tsx` 在 `beforeLoad` 校验 Session，`_authenticated/todos.tsx` 继续校验活动工作区。`src/routeTree.gen.ts` 由 TanStack Router 插件生成，不手工编辑；新增或移动路由后可运行 `just routes-generate`。

## 依赖与页面流程

```text
页面 → TanStack Query hook → API Client → Hono API
登录/组织切换 → Auth Client → Better Auth endpoint
```

## 使用流程

从仓库根目录同时启动 API 和 Web：

```bash
just init
Copy-Item .env.example .env
just launch
```

打开 [http://localhost:5173/](http://localhost:5173/)。Todo 页面通过类型客户端访问 [http://localhost:3000/](http://localhost:3000/)。API 已启动时可单独运行 Vite：

```bash
pnpm --filter @full-stack-example/web dev
```

用户可通过邮箱密码注册；注册后创建或选择工作区。登录后先通过 Auth Client 获取 Session 和组织列表，再设置活动组织，最后加载租户业务数据。页面请求收到 `401` 时进入登录流程，收到 `400` 时提示选择组织，收到 `403` 时显示权限不足，不能把这些状态统一当作普通网络错误。

## 错误与边界行为

- 所有 API 请求使用 `credentials: "include"`，不在 localStorage 保存 Session token。
- `ApiError.requestId` 应展示或上报，方便与服务端日志关联。
- mutation 成功后按资源 query key 失效缓存；失败时保留现有页面数据。
- 生产使用同源 API，避免额外的 Cookie 与 CORS 配置成本。

## 开发与验证

```bash
pnpm --filter @full-stack-example/web dev
pnpm --filter @full-stack-example/web typecheck
pnpm --filter @full-stack-example/web build
```

Vite 默认运行在 `http://localhost:5173`；`just launch` 会同时启动 API。

## 扩展规则

路由组件负责页面组合、导航和 query 状态；可复用交互放入 `components/`，Auth/Todo 请求行为放入 `features/`，基础客户端放入 `lib/`。mutation 改变数据后必须同步更新 query invalidation。生产请求保持同源，使单一 Node 容器可以同时提供 API 与 Web。

参阅 [Web 模块说明](/modules/web/)和 [API Client 模块说明](/modules/api-client/)。
