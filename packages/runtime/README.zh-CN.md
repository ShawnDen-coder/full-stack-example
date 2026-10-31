# @full-stack-example/runtime

[English](README.md) · [简体中文](README.zh-CN.md) · [项目](../../README.zh-CN.md)

L2 资源组装与运行支撑能力，依赖 L1 基础包及明确授权的 L2 identity/domain；不得导入 API 或应用。

## 公共能力

`./server` 创建服务与有界启动清理；`./worker` 创建独立 Worker 数据库和服务；`./process` 配置日志、遥测与 deadline；`./http` 记录请求；`./queue-monitor` 提供只读队列投影；`./queue-summaries` 投影安全字段；`./deployment` 负责迁移、运行角色配置与认证 Schema 生成。

## 扩展

遵守[分层规则](../../docs/dependency-layers.zh-CN.md)，只新增明确能力入口，不建立转发基础设施的 barrel。
工厂接收明确配置与注入依赖，导入不创建资源；保留事务和锁边界，返回服务能力而不是原始基础设施句柄。
应用负责调用、信号和关闭；消费者继续在 `apps/worker/src/runtime.ts` 显式注册，新增工厂不自动注册消费者。

同步双语指南，运行 `pnpm check:boundaries`、`pnpm test`、`pnpm check-types` 和 `pnpm build`。
认证、SQL、队列与资源变动还需使用专用服务运行 `pnpm test:integration` 和 `pnpm test:e2e`。
现有 server/worker 测试通过应用集成入口覆盖这些能力。
