# @full-stack-example/identity

[English](README.md) · [简体中文](README.zh-CN.md) · [项目](../../README.zh-CN.md)

L2 身份与工作区能力，负责 Better Auth 配置、原生权限检查、成员事务和 owner 行锁协议。

## 公共能力

`./auth` 使用注入数据库创建 Better Auth；`./access` 提供授权与工作区 facade。SQL 与事务逻辑从 API 迁入，不改变 HTTP 契约。

## 扩展

遵守[分层规则](../../docs/dependency-layers.zh-CN.md)，只新增明确能力入口，不建立转发基础设施的 barrel。
工厂接收明确配置与注入依赖，导入不创建资源；保留事务和锁边界，返回服务能力而不是原始基础设施句柄。
应用负责调用、信号和关闭；消费者继续在 `apps/worker/src/runtime.ts` 显式注册，新增工厂不自动注册消费者。

同步双语指南，运行 `pnpm check:boundaries`、`pnpm test`、`pnpm check-types` 和 `pnpm build`。
认证、SQL、队列与资源变动还需使用专用服务运行 `pnpm test:integration` 和 `pnpm test:e2e`。
现有 server/worker 测试通过应用集成入口覆盖这些能力。
