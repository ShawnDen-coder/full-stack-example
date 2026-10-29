# 角色与页面授权

[English](access-control.md) · [简体中文](access-control.zh-CN.md)

权限模型使用 Better Auth 官方 Organization 插件及 Dynamic Access Control。
应用只使用一个固定内部组织 `application`，不展示组织创建或切换入口。
成员身份存储在插件的 `member` 表，动态权限存储在 `organization_role`；
没有自建权限表或第二套权限计算引擎。

## 角色

| 角色 | 职责 |
| --- | --- |
| `owner` | 工作区超级管理员，可以任命或降级管理员 |
| `admin` | 编辑页面角色模板，为普通成员分配角色 |
| `member` | 普通用户身份，本身不授予页面访问权限 |
| 动态角色，初始为 `standard` | 一组页面 `read` 权限 |

用户可以拥有多个角色，权限按 Better Auth 原生规则合并。没有个人拒绝覆盖或独立授权范围。
要缩小权限，先移除较宽的角色，再分配较窄的角色。编辑模板会影响持有该角色的所有成员。
管理员和超级管理员可访问所有已登记页面，但仍遵守 Todo 数据所有权限制。

新注册用户自动加入 `member,standard`。迁移为 standard 开放原有五个页面，并为已有用户
和 session 补齐组织关系，保留升级前的访问能力。新增页面需在后台明确授权给动态角色。
`queues` 就是这样的后续页面：owner 和 admin 从静态角色定义获得它，`standard` 在管理员授予前不包含它。
standard 不能删除；动态角色的标识不能重命名。

Admin 插件独立负责全站账号管理：`user.role` 不等于工作区身份。初始化授予全站
superadmin 原生账号查询、封禁和会话查询、撤销能力。普通工作区管理员不拥有这些全站权限。
不再统一拦截 `/admin/*` 接口。

## 初始化

1. 使用部署凭证执行 `pnpm db:migrate`。
2. 正常注册首位超级管理员账号，获取用户 ID。
3. 使用部署 `DATABASE_URL` 执行 `pnpm admin:bootstrap <user-id>`。
4. 重新登录并访问 `/admin/users`。

初始化在同一事务中设置工作区 owner 和全站 superadmin，并撤销其旧 session。
已有全站超级管理员时拒绝重复初始化。HTTP 接口不允许修改 owner 身份，计划内的 owner
调整通过部署维护完成，避免并发删除最后一个 owner，也不自建角色写入事务引擎。

## 实现与扩展

- `packages/access`：页面目录、导航映射与插件原生角色声明。
- `packages/api/src/auth.ts`：配置插件和少量业务约束 hook。仅 owner 可管理管理员；
  动态模板只能包含页面读取权限；保护 owner、注册默认角色。验证与持久化由原生插件完成。
- `packages/api/src/access.ts`：调用原生 `getActiveMember`、`hasPermission`，转换为导航快照，
  不计算继承或覆盖规则。
- oRPC `access.me` 读取快照；管理操作调用 `/api/auth/organization/*` 原生接口。
  `pageProcedure(key)` 每次请求检查权限，Todo repository 继续校验数据所有权。
- 界面复用 Better Auth UI 的角色编辑器、成员角色对话框和数据 hooks，并适配现有 Radix
  组件。[来源与适配说明](../third-party/better-auth-ui.md)。
- Worker 不获得组织表权限，也不导入 API 模块。

新增页面时，在 packages/access 登记 key/path，使用 pageProcedure 保护相关接口，
再通过后台授予对应动态角色。菜单、搜索与路由使用同一个服务端权限快照。
设置、帮助始终可达。导航、窗口聚焦或 API 403 会刷新权限；变更后清理业务缓存。
闲置浏览器没有实时推送清屏。Dashboard/Apps/Tasks/Chats 仍是演示页面。

## 验证

执行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm check-types`、`pnpm build`、
`pnpm exec biome check .`，再使用独立 TEST_DATABASE_URL / TEST_REDIS_URL 执行集成与浏览器测试。
浏览器测试需要没有既存 superadmin 的一次性测试库。覆盖原生 API 提权拦截、注册字段注入、
权限撤销、真实界面角色分配和 Todo API 拒绝。


已登录用户无需页面授权即可访问 `/apps` 工具中心。原 `apps` 权限控制 `/apps/integrations-demo`，未知子路径默认拒绝。新增工具须同步 web 目录与路由、access 策略、API 页面授权及 domain owner 范围；新增 Worker 消费者须显式注册。
