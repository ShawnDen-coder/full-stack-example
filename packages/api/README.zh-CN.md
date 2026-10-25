# @my-better-t-app/api

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

负责服务端的 HTTP 和认证边界：Hono 组装、Better Auth、oRPC 输入校验、session 解析和传输层错误映射。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/create-api.ts](src/create-api.ts) | 根据注入的依赖构建 Hono 应用，管理 HTTP 中间件和健康路由 |
| [src/context.ts](src/context.ts) | 定义 `Services`、session、request ID 和请求 logger |
| [src/procedures.ts](src/procedures.ts) | 公开及需要登录的 procedure 构造器 |
| [src/routers/todo.ts](src/routers/todo.ts) | 输入校验和用户范围 CRUD 的参考实现 |
| [src/routers/index.ts](src/routers/index.ts) | 注册路由并推导客户端类型 |
| [src/auth.ts](src/auth.ts) | Better Auth 工厂 |

## 扩展步骤

1. 先在 [business](../business/README.zh-CN.md) 实现操作。将具体服务类型加入 `Services`，在 [server services](../../apps/server/src/services.ts) 中实例化，再注入 `createApi`。
2. 在 `src/routers` 下增加路由，用 Zod 校验输入，再调用 `context.services`。私有数据使用 `protectedProcedure`，归属用户从 `context.session.user.id` 获取。
3. 资源不存在和属于其他用户时统一返回 `NOT_FOUND`。将已知业务失败转换为稳定的 RPC 错误，不返回数据库驱动的内部错误信息。
4. 在 `src/routers/index.ts` 注册路由。操作名表达具体含义，例如 `setCompleted`；已有客户端需要时保留兼容别名。
5. 依赖创建、端口监听和退出仍由应用负责。只有其他包需要新入口时才增加 [package export](package.json)。

认证插件或表结构选项从 `src/auth.ts` 修改，先按[认证表结构生成流程](../../docs/development.zh-CN.md#生成-better-auth-表结构)生成，再走[数据库迁移流程](../db/README.zh-CN.md)。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @my-better-t-app/api check-types
pnpm --filter server test
```

认证、数据库或队列行为变更还要使用专用测试服务运行 `pnpm test:integration`。API 契约变化时同步 web 调用方并运行 `pnpm check-types`。本包不启动 Worker 消费者，也不通过 RPC context 暴露原始数据库。
