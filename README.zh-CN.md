# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

一个 TypeScript 全栈示例，提供需要登录的个人待办、用户资料，以及由独立 worker 进程执行的后台任务。

使用 React / TanStack Router、Hono / oRPC、Better Auth、Drizzle / PostgreSQL 和 BullMQ / Redis；共享 UI 使用 shadcn/ui 和 Tailwind CSS。

## 快速开始

准备 Node.js 24、pnpm 11.0.9 和 Docker Compose，在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm env:init
pnpm infra:up
pnpm db:migrate
pnpm dev
```

`env:init` 会创建不纳入 Git 的本地配置，生成随机认证密钥，并保留已有文件。上述流程面向新数据库；如果已有通过 `db:push` 创建的数据库，请先阅读[迁移说明](docs/operations.zh-CN.md#数据库迁移)。

打开 [localhost:3001](http://localhost:3001)，注册或登录，进入 `/todos` 创建、完成和删除任务。各账号的待办列表相互独立。

API 地址为 [localhost:3000](http://localhost:3000)，提供[接口文档](http://localhost:3000/api-reference)。类型安全的用户资料和后台任务调用方式见[开发指南](docs/development.zh-CN.md#应用组装)。

## 文档

[在线文档](https://shawnden-coder.github.io/full-stack-example/)

| 想做什么 | 阅读入口 |
| --- | --- |
| 理解架构与应用接线 | [开发指南](docs/development.zh-CN.md) |
| 扩展 Todo 或后台任务 | [扩展示例](docs/extension-examples.zh-CN.md) |
| 部署、迁移、备份与恢复 | [运维指南](docs/operations.zh-CN.md) |
| 检查、贡献与版本发布 | [贡献指南](CONTRIBUTING.zh-CN.md) |

各包的代码入口与扩展步骤：
[API](packages/api/README.zh-CN.md) · [业务](packages/business/README.zh-CN.md) · [数据库](packages/db/README.zh-CN.md) · [队列](packages/queue/README.zh-CN.md) · [可观测性](packages/observability/README.zh-CN.md) · [UI](packages/ui/README.zh-CN.md)。

命令定义见 [package.json](package.json)；共享 TypeScript 配置位于 [tsconfig.base.json](tsconfig.base.json)。
