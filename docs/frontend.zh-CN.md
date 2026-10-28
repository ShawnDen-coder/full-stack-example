# 前端

[English](frontend.md)

桌面端采用 [Shadcn Admin](https://github.com/satnaing/shadcn-admin)，来源固定为
`e16c87f213a5ba5e45964e9b67c792105ec74d26`。上游说明这是 UI 集合，并非直接提供
完整认证功能的应用。MIT 声明保留在 `third-party/shadcn-admin.LICENSE`。

## 路由

| URL | 行为 |
| --- | --- |
| `/` | 转到 Todos，未登录时由认证守卫转到登录页 |
| `/sign-in`、`/sign-up` | 独立认证布局，校验返回地址，已登录时跳转 |
| `/tasks` | 登录保护，真实 oRPC 增删改与游标分页 |
| `/settings` | 个人资料入口，通过 Better Auth 持久化姓名 |
| `/settings/appearance` | 登录保护，设备本地浅色／深色／系统偏好 |
| `/dashboard` | 旧入口重定向到 Todos |
| 其他 URL | 根路由 404 边界 |

根路由负责主题、toast、会话边界和仅开发环境显示的调试工具。`_auth` 负责
鉴权与侧栏布局；Settings 负责二级导航。全局搜索只搜索实际页面，不冒充全量 Todo 搜索。

## 集成边界

全站采用上游 Radix 基础组件、主题、Sidebar、Header/Main 及设置／认证布局。
共享组件放 packages/ui，业务组合放 apps/web。保留 Better Auth、TanStack Form、
oRPC、身份代际检查、用户作用域缓存和服务端分页。没有引入 Clerk、Axios、演示数据、
假仪表盘、社交登录、密码重置或邮箱修改入口。资料页保存姓名，邮箱只读；主题即时生效。

未采用上游禁用 Radix body scroll lock 的 CSS；命令弹窗标题与说明放在 portal 内。
此前 Figma 探索稿作为历史参考，以本次接入的上游基线作为当前实现规范。

升级时对照固定提交人工合并定制组件，运行单元、类型、构建、浏览器检查，并复核
桌面明暗主题、键盘导航、侧栏收起持久化与跨账号缓存隔离。

旧 `/login`、`/register`、`/todos`、`/settings/profile` 地址重定向到上游规范路由，认证跳转保留经过校验的返回地址。
