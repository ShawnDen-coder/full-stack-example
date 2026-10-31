# Workspace 权限

[English](access-control.md)

复用 Better Auth Organization。全站 `user.role=superadmin` 管理平台；本地
owner/admin/member 只作用于所属 workspace。owner 不再映射为平台 superadmin，
平台管理员也必须有成员身份和相应授权才能读取空间业务数据。

## 页面与请求

侧栏切换器只列本人加入的空间。`/apps?workspace=<id>` 是工具首页，链接保留
URL 中的空间；每次 Todo RPC 在 input 中固定 `workspaceId`。不使用共享 session
的 activeOrganizationId 决定业务目标，因此不同标签页可以操作不同空间。
切换时清理查询状态、拒收迟到的 oRPC 响应；Todo 缓存键和编辑器生命周期包含空间。

沿用现有 Sidebar、Card 和主题。首页宽屏三列、中屏两列、手机一列；简单 Hammer
作为默认 logo，无页脚按钮。桌面双击、键盘操作、触屏单击进入完整工具页。
首页只展示真实可用工具；模板示例单独分组，Tasks demo 不冒充任务中心。

## 管理边界

- `/workspaces`：平台管理员分页查看空间元数据、新建空间并指定已有账号 owner、启停工具。
  组织、owner、standard 角色和工具配置在一个事务内创建，创建者不会自动成为成员。
- `/admin/users?workspace=<id>`：owner/admin 用精确邮箱添加已有账号，管理本空间角色。
  重复添加不产生重复成员；只有 owner 能管理 admin。
- `/queues`：独立的平台运维入口，不接受 workspace 的页面授权。
- Todo：成员身份 ∩ 工具启用 ∩ 原生角色授权；SQL 再同时约束 workspace 和登录用户。
- 工具配置缺失时拒绝，owner/admin 也不例外。停用保留数据与角色，重新启用后按当前权限访问。
- 新账号不再自动加入 application；保留等待加入状态和账户设置。

原生 Organization 写接口采用允许列表，未实现的新建、更新组织、邀请、移除等接口
拒绝请求。改成员/角色必须显式指定组织并核对目标归属；动态角色不能授予平台或成员
管理能力。standard 角色不可删除；仍拥有空间的 owner 账号不可通过 Admin 接口封禁或删除。

## 部署

1. 使用部署凭据应用新增迁移。旧 Todo 归入 application，未知 owner 的记录仍不可访问。
2. 重新运行 runtime role provisioning，授予 app_server 新表 workspace_tool 的权限。
3. 新环境注册账号后执行 `pnpm admin:bootstrap <user-id>`，重新登录。
4. 在 `/workspaces` 创建空间并填写负责人邮箱。

成员与角色的复合唯一约束遇到历史重复数据会明确失败；部署前先处理重复记录，不自动丢弃
授权。后续 Todo 写入没有默认 workspace。Worker 权限和注册方式保持现有约定。

新增工具需同时补 key、目录元数据、启用配置、角色授权、显式 RPC 空间与不可变 domain 范围。
完整验证包括 install、unit tests、types、build、Biome，以及专用 PostgreSQL/Redis 的集成和
浏览器测试。邮件邀请、负责人转移、空间删除、任务公平调度和 outbox 不在本轮实现范围。

Bootstrap 默认只授予平台身份。如需同时明确授予已有空间的 owner，使用
`pnpm admin:bootstrap <user-id> --workspace-owner <workspace-id>`。

空间创建与账号封禁共享行锁协议：[`workspaces.ts`](../packages/identity/src/workspaces.ts) 和 [`auth.ts`](../packages/identity/src/auth.ts) 锁定同一目标用户行，在事务内重新检查并写入，保证 owner 不可被封禁、被封禁用户不可成为 owner。新增路径须遵循同一协议，不能用事务外检查替代；锁也不能替代授权。参见[并发集成测试](../apps/server/tests/integration/workspaces.test.ts)。
