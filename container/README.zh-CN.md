# 容器配置

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../README.zh-CN.md)

本目录集中管理 Compose 栈、应用镜像、Web 反向代理和可选的遥测 Collector。以下命令均从仓库根目录执行，需要 pnpm 12.15.0 和 Podman Compose。宿主机命令使用的 Node.js 24 由 pnpm 根据根 manifest 和锁文件管理。镜像构建阶段安装 pnpm 12.15.0 并使用同一份冻结锁文件；server 和 worker 生产镜像直接使用 `node:24-slim`，无需 pnpm。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| [compose.yml](compose.yml) | 本地 PostgreSQL／Redis，以及可选的容器化 web／server／worker |
| [compose.production.yml](compose.production.yml) | 生产栈、数据库迁移任务和运行角色授权 |
| [compose.observability.yml](compose.observability.yml) | 可叠加到本地或生产栈的 Collector 配置 |
| [server/Dockerfile](server/Dockerfile) | Server 镜像，包含迁移和角色授权入口 |
| [worker/Dockerfile](worker/Dockerfile) | 独立队列消费者镜像 |
| [web/Dockerfile](web/Dockerfile) | 前端构建与 Nginx 运行镜像 |
| [web/nginx.conf](web/nginx.conf) | 静态资源、SPA 回退，以及认证／RPC／接口文档代理 |
| [observability/collector.yml](observability/collector.yml) | OTLP 接收、调试 trace 导出和 Prometheus 指标端点 |

## 本地开发

安装 Podman 和兼容 Compose v2.24+ 的 provider（`docker-compose`，包括更新的主版本）。`podman compose` 调用该 provider，容器引擎使用 Podman，无需 Docker Engine/Desktop。参考 [Podman Desktop Compose 配置](https://podman-desktop.io/docs/compose/setting-up-compose)。安装多个 provider 时，通过 `PODMAN_COMPOSE_PROVIDER` 指定可执行文件路径。本项目依赖 `up --wait`、可选 `env_file` 和 `service_completed_successfully` 条件。

Windows/macOS 首次使用时按需执行 `podman machine init`，再执行 `podman machine start`。Linux 无根模式通过 `systemctl --user enable --now podman.socket` 启用 API socket。继续之前确认 `podman info` 和 `podman compose version` 正常。

Docker 与 Podman 的数据卷独立存储。切换已有环境前，先备份并恢复 PostgreSQL／Redis 数据；启动 Podman 会创建新栈，不会自动迁移原有数据。

常规开发使用容器运行 PostgreSQL 和 Redis，在宿主机运行应用：

```bash
pnpm install --frozen-lockfile
pnpm env:init
pnpm infra:up
pnpm db:migrate
pnpm dev
```

`pnpm infra:down` 停止 PostgreSQL 和 Redis，保留数据卷。初始化配置并完成迁移后，也可以将应用一起放入容器：

```bash
podman compose -f container/compose.yml up -d --build
podman compose -f container/compose.yml logs -f
```

切换前停止宿主机上的应用进程，释放 3000 和 3001 端口。本地栈的 web 使用 3001，server 使用 3000；PostgreSQL／Redis 绑定宿主机回环地址的 5432／6379 端口。本地应用容器不会自动执行数据库迁移。

## 生产部署

按照 [deploy/.env.schema](../deploy/.env.schema) 准备生产配置，通过进程环境变量或不纳入 Git 的 `deploy/.env` 提供。根目录脚本通过 Varlock 加载这些配置：

```bash
pnpm podman:build
pnpm podman:up
pnpm podman:logs
pnpm podman:down
```

`podman:up` 调用 [scripts/deploy.mjs](../scripts/deploy.mjs)，依次构建镜像、等待 PostgreSQL／Redis 就绪、执行迁移、授予运行角色权限，再更新应用。`podman:down` 保留数据卷。生产环境需要外部 HTTPS 反向代理，默认转发到 `127.0.0.1:8080`。凭证、数据库角色、迁移失败处理、备份和恢复见[运维指南](../docs/operations.zh-CN.md)。

## 可选遥测

```bash
pnpm telemetry:up
pnpm telemetry:down
```

这些脚本组合本地 Compose 文件和 Collector 配置。应用通过 `OTEL_ENABLED=true` 开启遥测；宿主机应用使用 `http://localhost:4318`，容器使用 `http://otel-collector:4318`。Collector 的指标端点为 `http://127.0.0.1:8889/metrics`。

生产环境使用 Collector 时，组合 `container/compose.production.yml` 与 `container/compose.observability.yml`，并通过 Varlock 加载部署配置。Collector 为可选组件，不得成为就绪检查的依赖。生产导出器和存储方案见[可观测性指南](../docs/observability.zh-CN.md)。

## 路径与扩展约定

- Compose 相对路径以第一个 Compose 文件为基准。保持 `context: ..`，让镜像以仓库根目录为构建上下文；`container/server/Dockerfile` 等 Dockerfile 路径及 `COPY` 源路径均相对于该上下文。
- 镜像构建排除规则使用根目录的 [.dockerignore](../.dockerignore)。本地环境配置值文件不得进入镜像层。应用环境 schema 留在各应用目录，生产环境配置留在 `deploy/`。
- Podman 支持现有 Dockerfile 格式和 `.dockerignore`。外部镜像使用完整仓库地址，生产应用镜像使用 `localhost/` 前缀，Collector 绑定挂载使用 `:Z` 以兼容 SELinux 主机。
- 保持 `name: full-stack-example` 稳定。需要隔离部署栈时显式使用 `COMPOSE_PROJECT_NAME`；项目名会影响默认容器、网络和数据卷的命名空间。移动配置时保持数据卷键名不变。
- 增加应用镜像时，在本目录新增对应子目录，将服务接入所需的 Compose 栈，按需更新根目录脚本和 [CI](../.github/workflows/ci.yml)。应用继续负责自身的启动和关闭。

不启动容器即可检查配置：

```bash
podman compose -f container/compose.yml config --quiet
podman compose -f container/compose.yml -f container/compose.observability.yml config --quiet
pnpm exec varlock run --path ./deploy/ -- podman compose -f container/compose.production.yml config --quiet
```

生产配置检查需要提供必填部署值。配置检查通过后，仍需构建镜像，并按 [CI](../.github/workflows/ci.yml) 的流程执行生产冒烟检查。
