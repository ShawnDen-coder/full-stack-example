# Web 应用

`@full-stack-example/web` 是 React/Vite 单页应用，负责浏览器路由、页面组件、TanStack Query 数据获取和浏览器 API client 边界。

## 职责边界

- 使用 TanStack Router 文件路由渲染首页、登录、注册、工作区选择和 Todo 页面。
- 使用 TanStack Query 管理服务端状态，通过按功能拆分的 Hono RPC 客户端发起类型安全请求。
- 开发环境解析 API origin，生产环境保持同源请求。

Web 不重复定义 API schema，不导入 Auth server，也不直接访问 PostgreSQL。RPC 客户端和安全错误处理由 Web 本地持有，只导入当前功能对应的路由类型。

## 对外接口

Web 没有供服务端调用的运行时 API；它消费 System/Todos 的 Hono 子路由类型和 `@full-stack-example/auth/client`，构建结果由 API 宿主提供。

`src/routes/` 是路由入口：`__root.tsx` 提供根布局与 404，`_authenticated.tsx` 在 `beforeLoad` 校验 Session，`_authenticated/todos.tsx` 继续校验活动工作区。`src/routeTree.gen.ts` 由 TanStack Router 插件生成，不手工编辑；新增或移动路由后可运行 `just routes-generate`。

## 依赖关系

```text
页面 → TanStack Query hook → System/Todos RPC client → Hono API
登录/组织切换 → Auth Client → Better Auth endpoint
```

## 生命周期

TanStack Router 在导航时运行 session/tenant guard 与 loader；页面通过 feature hooks 读取同一 QueryClient 缓存。登录、退出或切换组织时清理或失效租户相关缓存，避免跨组织展示旧数据。

## 配置与运行资源

开发环境通过 `VITE_API_BASE_URL` 定位 API；生产环境使用 same-origin。所有 RPC 请求携带 Cookie credentials。Router、QueryClient 和 Auth client 在应用入口创建并复用；route tree 由 TanStack Router 插件生成，不手动改写。

## 使用流程

从仓库根目录同时启动 API 和 Web：

```bash
just init
Copy-Item .env.example .env
just dev
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
pnpm --filter @full-stack-example/web storybook
pnpm --filter @full-stack-example/web storybook:build
```

Vite 默认运行在 `http://localhost:5173`；`just dev` 会一并启动基础设施、API、Jobs Worker 和 Web。

Storybook 使用 `apps/web/.storybook/` 配置，只展示不依赖服务端的 UI。共享基础样式和组件源码位于 `src/styles/` 与 `src/components/ui/`；认证表单将界面与 Better Auth 导航行为分开，因此可以在 Storybook 中单独检查校验、提交中和服务端错误状态。Web 样式以 Tailwind CSS 4 utilities、语义 CSS variables 和本地 shadcn 风格组件为基础，Base UI 提供菜单等无样式交互原语。颜色主题支持系统、浅色和深色，默认跟随系统。

## 扩展规则

路由组件负责页面组合、导航和 query 状态；可复用交互放入 `components/`，Auth/Todo 请求行为放入 `features/`，基础客户端放入 `lib/`。mutation 改变数据后必须同步更新 query invalidation。生产请求保持同源，使单一 Node 容器可以同时提供 API 与 Web。

新增可被 Web 调用的业务路由时，由所属模块导出自己的 Hono 子路由类型，Web 在对应功能客户端中单独创建 `hc` client；不要从 Web 导入 API 的完整 `AppType`。

参阅 [Web 模块说明](/modules/web/)和 [HTTP API 参考](/reference/http-api/)。
