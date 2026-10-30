# full-stack-example

[English](README.md) · [简体中文](README.zh-CN.md)

一个 TypeScript 全栈示例，提供需要登录的个人待办、用户资料，以及由独立 worker 进程执行的后台任务。

使用 React / TanStack Router、Hono / oRPC、Better Auth、Drizzle / PostgreSQL 和 BullMQ / Redis；共享 UI 使用 shadcn/ui 和 Tailwind CSS。

## 快速开始

按[容器指南](container/README.zh-CN.md#本地开发)配置 Podman 和 Compose provider，并确认 `podman info`、`podman compose version` 正常。Windows/macOS 执行基础设施命令前，先启动 Podman machine。

准备 pnpm 12.15.0 和 Podman Compose。pnpm 通过 `package.json` 的 `devEngines.runtime` 自动下载并管理项目使用的 Node.js 24，具体版本和校验信息提交在 `pnpm-lock.yaml` 中。在仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm node --version
pnpm env:init
pnpm infra:up
pnpm db:migrate
pnpm dev
```

已有 Node.js/npm 时，可运行 `npm install -g pnpm@12.15.0` 安装 pnpm。直接执行 Node 命令用 `pnpm node`，项目工具用 `pnpm run` / `pnpm exec`。系统的 `node --version` 仍可能显示其他版本；如需让裸 `node` 命令也跟随项目，执行一次 `pnpm shim add node`，并确保 `pnpm bin -g` 对应目录在 `PATH` 中优先于其他 Node 安装目录（若未配置全局目录，先运行 `pnpm setup` 并重新打开终端）。无需另外安装 Node 版本管理器。`.node-version` 保留为其他工具的 Node 24 提示；pnpm 以 manifest 和锁文件为准。

`env:init` 会创建不纳入 Git 的本地配置，生成随机认证密钥，并保留已有文件。上述流程面向新数据库；如果已有通过 `db:push` 创建的数据库，请先阅读[迁移说明](docs/operations.zh-CN.md#数据库迁移)。

新数据库首次使用时，保持 `pnpm dev` 运行并完成以下设置：

1. 打开 [localhost:3001](http://localhost:3001)，在界面注册。用同一浏览器访问 [localhost:3000/api/auth/get-session](http://localhost:3000/api/auth/get-session)，复制 `user.id`。
2. 在另一个终端运行 `pnpm admin:bootstrap <user-id>`。CLI 会撤销会话，请重新登录。
3. 打开 `/workspaces`，填写 Name、Slug 和本人注册邮箱作为 Owner email，启用 Todos 并创建空间。选择空间后进入 Todos，即可创建、编辑、完成和删除任务。

bootstrap 只能执行一次；已有管理员的环境请由管理员分配空间成员。

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
[API](packages/api/README.zh-CN.md) · [领域](packages/domain/README.zh-CN.md) · [数据库](packages/db/README.zh-CN.md) · [队列](packages/queue/README.zh-CN.md) · [可观测性](packages/observability/README.zh-CN.md) · [UI](packages/ui/README.zh-CN.md)。

命令定义见 [package.json](package.json)；共享 TypeScript 配置位于 [tsconfig.base.json](tsconfig.base.json)。

容器配置统一位于 [container](container/README.zh-CN.md)：Compose、各应用的 Dockerfile、Nginx 和 Collector 配置。镜像构建上下文仍为仓库根目录，使用根目录的 `.dockerignore`；部署环境配置留在 `deploy/`。

[角色与页面授权](docs/access-control.zh-CN.md) · [共享权限契约](packages/access/README.zh-CN.md)
