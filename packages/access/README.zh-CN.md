# @full-stack-example/access

[English](README.md) · [简体中文](README.zh-CN.md)

浏览器可用的页面与导航契约，以及 Better Auth 插件角色声明。
./auth 分别定义 Organization 页面权限与全站 Admin 角色。
不创建数据库资源，不实现自定义权限计算器。

## 扩展

在 pageKeys、pages 添加页面，使用 pageProcedure 保护相关接口，再通过原生动态角色
授予 read。没有动态授权则拒绝访问。`queues` 走 `/queues`，避免被当成 `/admin` 角色页。canVisit、landingPath 只消费服务端快照，
不能替代接口鉴权。保持设置、帮助可达，继续校验业务数据所有权。

参见[架构](../../docs/access-control.zh-CN.md)。运行本包测试和 pnpm check-types 验证。
