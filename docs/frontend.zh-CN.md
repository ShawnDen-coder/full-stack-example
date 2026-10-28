# 前端

[English](frontend.md)

前端以 [Shadcn Admin](https://github.com/satnaing/shadcn-admin) 的页面和组件作为基线，
固定上游提交为 `e16c87f213a5ba5e45964e9b67c792105ec74d26`。上游是 UI 集合，
并不提供生产后端。MIT 声明保留在 `third-party/shadcn-admin.LICENSE`。

## 路由与数据

| URL | 行为 |
| --- | --- |
| `/` | 转到 `/tasks`，受保护页面要求登录 |
| `/dashboard` | 原版概览与分析图表，示例统计数据 |
| `/tasks` | 原版任务表格、筛选、排序、选择、弹窗和分页，示例任务 |
| `/apps` | 原版应用集成卡片、筛选与排序，示例连接状态 |
| `/users` | 原版用户表格、角色、状态、新增／邀请／删除弹窗，示例用户 |
| `/chats` | 原版会话界面与示例消息，不发送消息 |
| `/settings` | Better Auth 真实个人资料更新，邮箱只读 |
| `/settings/appearance` | 设备本地浅色／深色／跟随系统偏好，即时生效 |
| `/settings/account`、`/settings/notifications`、`/settings/display` | 原版演示表单，不保存变更 |
| `/help-center` | 上游原有 Coming Soon 占位页 |
| `/errors/$error` | 带登录侧栏的错误页展示 |
| `/401`、`/403`、`/404`、`/500`、`/503` | 独立错误页 |
| `/sign-in`、`/sign-up`、`/sign-in-2` | Better Auth 真实表单与返回地址校验；第二种登录使用上游双栏布局 |
| `/forgot-password`、`/otp` | 上游 UI 预览，不发送邮件、不验证验证码、不创建会话 |
| `/todos` | 原有真实用户任务，保留增删改、错误恢复和游标分页 |
| `/queues` | 已登记 BullMQ 队列的只读概览 |
| `/queues/$queueKey/jobs` | 真实任务表、状态标签、精确任务 ID 和服务端分页 |
| `/queues/$queueKey/jobs/$jobId` | 真实失败详情和有界附加日志 |
| `/queues/$queueKey/schedulers` | 真实定时触发列表；没有注册项时为空 |
| 其他 URL | 根路由 404 边界 |

旧 `/login`、`/register` 和 `/settings/profile` 跳转到规范路由。
侧栏恢复上游 General / Pages / Other 分组和可展开子菜单，另加 Personal 分组
保留真实 Todos。侧栏收起后子菜单改用下拉菜单。应用、认证页和 favicon 使用原版 Logo。

## 集成边界

这是应用迁入，不是用上游仓库原样覆盖 monorepo。页面模块位于
`apps/web/src/features`，Radix 基础组件位于 `packages/ui`。保留现有 Hono、
Better Auth、oRPC、worker 和数据库。没有启用上游 Clerk 展示、假 token 登录存储、
Axios 客户端和启动入口。受保护路由继续校验真实会话，oRPC 继续执行身份代际检查、
用户隔离缓存和服务端分页。规范登录／注册、真实资料和外观页面使用本地适配实现；
对应上游模块保留作源码参考。

Tasks、Users 数据是上游固定种子生成结果的静态快照，不将 Faker 打包进浏览器。
演示操作明确说明只是预览，不宣称已经保存、发出邀请或导出文件。
后续接入生产数据前需要实现后端契约与权限校验，登录用户不能因此自动获得用户管理权限。
当前表格对完整示例数组筛选，不会对真实服务端的一页数据冒充全量搜索。

Apps 与表格筛选以 URL 为状态来源，浏览器前进／后退同步控件。保留原版布局、弹窗
和组件组合，适配无障碍及共用页面外壳，避免重复 Header/Main。
主题控件共用现有 next-themes；布局和方向采用上游非敏感偏好 cookie。全局搜索用于页面导航。

## 维护

升级时对照固定提交人工合并差异，不要把认证／会话适配、弹窗无障碍、滚动锁定和真实功能
覆盖成演示实现。保留 MIT 声明。运行冻结安装、单元／类型／构建／lint 检查，使用专用
Podman 服务进行集成和浏览器测试；复核桌面截图、筛选与历史、弹窗、收起导航、主题持久化
和跨账号缓存隔离。此前 Figma 探索稿作为历史参考，当前以前端上游基线为准。
