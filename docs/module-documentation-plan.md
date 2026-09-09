# 模块文档整理计划

## 目标

让新成员只阅读各模块 README，就能理解模块边界、依赖方向、初始化顺序、正常调用、错误处理和扩展约束，并确保示例与当前源码一致。

## 统一结构

每个 App 和 Package README 使用以下信息结构：

1. 模块定位。
2. 职责边界。
3. 对外接口。
4. 依赖关系。
5. 使用流程。
6. 错误与边界行为。
7. 开发与验证。
8. 扩展规则。

字段语义、数据库关系或 HTTP 行为只放在真正拥有该知识的模块中，其他模块通过链接引用，避免复制后漂移。

## 实施批次

- 第一批：修正 API Client、Auth、Database 和 Todos 的错误示例与跨包流程。
- 第二批：补齐 Logging、System、API 和 Web 的初始化、关闭与错误行为。
- 第三批：生成文档站内容，执行 TypeScript、测试和文档构建。
- 后续约束：Public API、配置或行为变化时，同一提交必须更新对应 README 和测试。

## 验收标准

- README 中不存在无法编译、必然抛错或缺少关键依赖的示例。
- 浏览器代码不导入服务端 Auth、Database 或 Drizzle。
- 每个业务模块都说明 Auth、Service、Repository 和 RLS 的职责分界。
- 所有 README 均能被 `docs/scripts/sync-readmes.ts` 同步。
- `pnpm --filter @full-stack-example/docs build`、workspace typecheck 和测试通过。

## 文档整理后识别的代码跟进项

这些问题不在本次纯文档整理中修改，应单独提交并配套测试：

- 让生产 `createApp` 强制接收 Auth，移除无 Auth 时放行 Todo 的兼容路径。
- 删除 Todo 路由外层重复的 `requireTenant`，每个操作只使用完整的 `tenantPermission`。
- 从 Todos 根入口移除 `createTenantTodoRepository`，避免调用方绕过 Service。
- 将 `auth.require.requireXxx` 收敛为 `auth.require.xxx`，降低调用和记忆成本。
- 为 Todo 和平台管理 OpenAPI 补充 `401/400/403` 响应合同。
- 评估把 API 的类型合同提取为轻量包，避免 API Client 的安装依赖指向整个服务端应用包。
