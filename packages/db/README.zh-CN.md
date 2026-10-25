# @my-better-t-app/db

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

负责 PostgreSQL 基础设施：显式数据库工厂、Drizzle schema／relations、统一迁移历史，以及仅供部署阶段使用的运行角色配置。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/index.ts](src/index.ts) | `createDb`、连接池大小／超时／指标及幂等 `close()` |
| [src/schema/index.ts](src/schema/index.ts) | Drizzle Kit 读取的 schema 导出 |
| [src/schema/auth.ts](src/schema/auth.ts) | Better Auth 生成的表和 relation parts |
| [src/schema/todo.ts](src/schema/todo.ts) | 业务表、外键及用户／分页索引 |
| [src/relations.ts](src/relations.ts) | 关系查询使用的 Relations v2 组装 |
| [src/migrations](src/migrations) | 已审查的 SQL 和快照 |
| [src/provision.ts](src/provision.ts) | 部署时显式授予 server／worker 权限 |
| [drizzle.config.ts](drizzle.config.ts) | schema 和迁移目录配置 |

## 扩展步骤

1. 在 `src/schema` 按业务分组定义新表，索引、外键、空值及唯一约束与表放在一起。通过 `src/schema/index.ts` 导出，仅在调用方需要时增加公共子路径。
2. 表之间直接引用对方文件，避免经过总入口形成循环依赖。关系查询需要时，在 `src/relations.ts` 定义或汇总 v2 relation parts。ORM relations 不能代替数据库外键。
3. 保持 Better Auth 生成文件完整。认证相关变更先走[认证表结构生成流程](../../docs/development.zh-CN.md#生成-better-auth-表结构)，再生成数据库迁移。
4. 从根目录运行 `pnpm db:generate`，审查并提交 SQL 和快照，再执行 `pnpm db:migrate`。用专用测试数据验证空库初始化和旧结构升级；不重写已执行的迁移，也不以 `db:push` 发布。
5. 每次新增表或能力，都审查 `src/provision.ts`，只授予各进程实际需要的操作。新增 schema 不会自动获得运行角色权限，迁移凭据仅用于部署任务。
6. 业务查询留在 [business](../business/README.zh-CN.md)。各应用创建和关闭自己的数据库实例；Repository 使用注入的数据库或事务，不拥有连接池。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @my-better-t-app/db check-types
pnpm test:integration
```

集成测试要求专用的 `TEST_DATABASE_URL` 和 `TEST_REDIS_URL`。权限测试会修改固定 app_server／app_worker 角色及 public schema 授权。保留历史无归属 Todo 不可访问的策略；数据回填或归属变更需要单独明确的迁移方案。
