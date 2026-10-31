# 依赖层级

[English](dependency-layers.md) · [简体中文](dependency-layers.zh-CN.md)

内部只依赖相邻下层；同层项目引用必须显式声明，完整依赖图不得成环。
L0 表示第三方库与平台依赖，各内部层均可直接引用；内部模块不得归入 L0。
组合根、类型引用、重导出均不享有跳层豁免。

## 通用 Lx 规则

```text
Lx -> L(x-1)       允许：相邻内部下层
Lx/A -> Lx/B       仅在显式授权且无环时允许
Lx -> L0          允许：第三方／平台依赖
Lx -> L(x-2...)   禁止：跳过内部层级
Lx -> 更高层       禁止：反向引用
```

## 项目映射

| 层级 | 模块 | 职责 |
| --- | --- | --- |
| L3 | apps/web、apps/server、apps/worker、packages/api | 用户／协议入口与进程策略 |
| L2 | domain、identity、runtime、access、ui | 业务、身份、资源组装、权限契约与共享 UI |
| L1 | db、queue、observability | 数据库、队列和观测基础能力 |
| L0 | 第三方库与 Node 内置模块 | 外部依赖 |

层级描述依赖边界，不要求每一层都拥有下一层依赖。ui 与 access 是 L2 的共享应用能力，
可以直接使用 L0。API 与应用入口同为 L3：server 可以使用 API；web 只能类型导入
API 路由客户端契约；worker 不得导入 API。L2 runtime 组装 domain 和 identity，
identity 使用 access，L1 db 使用 observability。这些都是具体授权的同层边，不是任意同层互引。

L3 禁止直接导入 db、queue、observability，包括类型和私有路径。server 通过
`runtime/server` 获取服务及清理能力；worker 通过 `runtime/worker` 获取资源，
消费者仍在 `apps/worker/src/runtime.ts` 显式注册。HTTP 接入调用 identity，不能写 SQL。
资源工厂返回服务、就绪检查和关闭能力，不向入口暴露原始数据库。
迁移、角色配置和认证 Schema 生成使用独立的 `runtime/deployment` 入口。

`runtime/process` 负责进程日志／遥测配置及生命周期 deadline；`runtime/http`
负责请求观测。它们不是任意转发 L1 导出的 barrel；禁止为了绕过分层增加空转发入口。
导入模块时不得启动 SDK、连接池或消费者。

## 自动检查

[scripts/architecture-policy.mjs](../scripts/architecture-policy.mjs) 是层级和允许边的唯一事实来源。
`pnpm check:boundaries` 检查生产 src（包括 CSS）、包根 JS/TS 配置、package.json 的
依赖字段（包括 dev/peer/optional）、TypeScript 项目引用、公共 exports 和循环。
类型导入、重导出、字面量动态 import 与 require 使用相同规则；加入白名单不能放行跳层。

测试、fixture 和根开发工具属于独立测试设施，不是发布的应用模块。跨层集成测试依赖统一
声明在根 devDependencies，不放在应用包依赖中。即使 Node 可以解析根测试依赖，生产代码
引用它们仍会被拒绝。检查器是静态工具：不支持计算得到的模块名或任意运行时加载，
内部模块不得使用这些方式加载；检查通过不等于业务语义完全解耦。

新增模块时指定正整数层级、声明必要的公开依赖、同步项目引用并增加边界回归测试。
禁止通过改成 L0、随意压平层级或增加组合根豁免来通过检查。
