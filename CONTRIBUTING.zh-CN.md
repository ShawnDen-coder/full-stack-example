# 贡献指南

[English](CONTRIBUTING.md) · [简体中文](CONTRIBUTING.zh-CN.md) · [项目说明](README.zh-CN.md)

先按[快速开始](README.zh-CN.md#快速开始)启动开发环境。修改应用接线时读[开发指南](docs/development.zh-CN.md)，修改共享包时先读所属包的扩展指引。所有命令均在仓库根目录执行。

## 提交前检查

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check-types
pnpm build
pnpm check:boundaries
pnpm exec biome check .
```

`pnpm check` 会应用 Biome 自动修复。依赖变更限定在实际使用它的包中；保持 `.node-version`、Node 类型和 Docker 运行时版本一致。依赖升级，尤其是 Drizzle RC 变更，需要通过完整验证流程，避免与无关功能混在一起。

Husky 对暂存文件运行 lint-staged，对提交消息运行 Cocogitto；提交前先完成下方 CLI 安装。CI 是最终依据，本地钩子不能替代 CI。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev:web`, `pnpm dev:server`, `pnpm dev:worker` | 单独启动某个应用 |
| `pnpm test` | 运行离线 API、worker 和发布保护测试 |
| `pnpm test:integration` | 使用真实 PostgreSQL/Redis 验证认证、迁移和进程行为 |
| `pnpm test:e2e` | 通过 Playwright 验证账号隔离和增删改查场景 |
| `pnpm check-types` | 生成路由类型并检查工作区类型 |
| `pnpm build` | 构建应用 |
| `pnpm check:boundaries` | 检查包依赖和公共导出边界 |
| `pnpm exec biome check .` | 只读检查代码规范和格式 |
| `pnpm check` | 应用 Biome 自动修复 |
| `pnpm db:studio` | 查看数据库 |
| `pnpm db:generate`, `pnpm db:migrate` | 生成和执行 SQL 迁移 |
| `pnpm env:generate` | 修改环境配置定义后重新生成类型 |
| `pnpm infra:down` | 停止本地 PostgreSQL 和 Redis |

## 验证

GitHub Actions 使用 Node 24、pnpm 11.0.9 和已提交的锁文件进行验证。离线测试覆盖 HTTP 边界、就绪检查、日志脱敏和 worker 生命周期。集成测试使用真实 PostgreSQL/Redis、已提交的迁移和 Better Auth，并验证任务重试、连接中断和 SIGTERM 退出。Playwright 覆盖账号切换（包括延迟响应）、写入失败和会话过期。生产冒烟测试验证构建后的 Nginx/API/worker 整体链路、Secure Cookie 和 SPA 深层路由。发布保护测试确保迁移失败后不会继续替换应用容器。

运行集成测试或浏览器测试前，将 `TEST_DATABASE_URL` 和 `TEST_REDIS_URL` 指向**专用、可随时丢弃的测试服务**，然后执行：

```bash
pnpm test:integration
pnpm --filter web exec playwright install chromium
pnpm test:e2e
```

集成测试会执行仓库中的迁移、创建临时账号，并验证数据库故障、worker 重试和进程退出。浏览器测试使用 43100/43101 端口，会在测试数据库中留下测试账号。不要将这些命令指向需要保留数据的开发数据库或生产服务。

权限测试会配置固定的 app_server/app_worker 角色和 public schema 授权，因此 PostgreSQL 实例也必须专用。

## 静态文档站

GitHub Pages 使用 Rspress，正文来自根 README、本指南、`docs/*.md` 和六个包的 README。只维护这些源文件；`docs/content` 与 `docs/doc_build` 是生成产物，不提交。

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

开发和预览均使用 `/full-stack-example/` 子路径。构建生成中英文正文、Mermaid 图、当前 oRPC router 的 OpenAPI 规范和 TypeScript Reference，不启动数据库、Redis 或应用服务。正文中的文档链接会转换为站内路由，源码链接指向 GitHub。

导航与路由映射位于 `docs/scripts/content.ts`，布局与主题位于 `docs/rspress.config.ts`、`docs/styles/index.css`。修改映射时运行 `pnpm --filter @full-stack-example/docs test`；检查 `pnpm docs:build` 的产物，并在桌面与手机上验证导航、搜索、语言切换和深层链接。

`.github/workflows/docs.yml` 在 PR 中构建，合入 `master` 后部署到 GitHub Pages；手动发布可运行该 workflow。工作流使用 Node.js 24、pnpm 11.0.9 和锁文件。

## 版本管理

使用 [Cocogitto](https://docs.cocogitto.io/) 6.4.0 为整个 workspace 管理统一的应用版本，以 `X.Y.Z` Git tag 和根目录 `CHANGELOG.md` 为准。各包 manifest 中的版本不代表应用发布版本，内部包不单独发布。

首次提交前安装 CLI（需要 [Rust/Cargo](https://rustup.rs/)），再安装 workspace 依赖以启用 Husky：

```bash
cargo install cocogitto --version 6.4.0 --locked
pnpm install --frozen-lockfile
```

Husky 通过 `cog verify` 检查每条提交消息；CI 检查全部提交历史，忽略 merge commits。使用 Conventional Commits，例如 `fix(api): handle missing sessions`、`feat(todos): add filtering` 和 `feat(api)!: change the response contract`。`fix` 升 PATCH，`feat` 升 MINOR；1.0.0 之后的破坏性变更升 MAJOR。0.x 开发阶段的自动升版保持在 1.0.0 以下，确认 API 稳定时显式执行 `cog bump --version 1.0.0`。

CI 通过后，在干净且与远端同步的 `master` 分支执行：

```bash
pnpm release:preview
pnpm release
```

预览只输出下一版本，不修改文件或运行发布 hooks。正式升版会依次检查提交格式、lint、包边界、测试、类型和构建，生成／更新 `CHANGELOG.md`，并创建本地版本 commit 和 tag。首次自动发布会分析已有历史。这两个命令都不推送、不发布 npm 包，也不部署应用。审查结果后再一起推送 `master` 和新 tag，例如 `git push --atomic origin master 0.1.0`（将 tag 替换为实际生成的版本）。
