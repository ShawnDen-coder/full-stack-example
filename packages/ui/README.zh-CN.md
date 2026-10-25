# @my-better-t-app/ui

[English](README.md) · [简体中文](README.zh-CN.md) · [项目说明](../../README.zh-CN.md)

提供共享 React 基础组件、样式和工具函数。业务页面、路由、session 和 API 查询由 web 应用负责。

## 代码入口

| 文件 | 职责 |
| --- | --- |
| [src/components/button.tsx](src/components/button.tsx) | 基础组件和 variants 的参考 |
| [src/styles/globals.css](src/styles/globals.css) | 共享 token、主题和全局样式 |
| [src/lib/utils.ts](src/lib/utils.ts) | 共享样式类工具 |
| [components.json](components.json) | shadcn 别名、样式和 registry 配置 |
| [package.json](package.json) | 组件／工具／hook 通配子路径及全局 CSS 导出 |

## 扩展步骤

1. 可复用基础组件放入 `src/components`，业务组合留在 [web](../../apps/web/src)。沿用现有 Base UI／shadcn 约定、props 类型、variants 和 `cn`，不再并行引入一套 UI 体系。
2. 复用 `src/styles/globals.css` 中的语义 token。主题调整在这里集中完成，避免在调用方分散硬编码颜色。
3. 文件名与导出模式保持一致。新增 `.tsx` 组件可通过 `@my-better-t-app/ui/components/name` 引入，通常不需要新增根 barrel。
4. 保证标签、键盘／焦点行为、禁用和错误状态可访问。某个业务的加载、空状态和写入失败提示由 web 页面负责。
5. 使用 shadcn 生成时遵循 [UI 定制说明](../../docs/development.zh-CN.md#ui-定制)，审查生成的依赖和配置变更。UI 库依赖放在本包，应用专用库留在 web。

现有使用方式：

```tsx
import { Button } from "@my-better-t-app/ui/components/button";

export function SaveButton() {
  return <Button type="submit">Save</Button>;
}
```

## 验证

从工作区根目录执行：

```bash
pnpm --filter @my-better-t-app/ui check-types
pnpm --filter web check-types
pnpm --filter web build
```

在实际使用页面检查浅色／深色主题和键盘导航。认证或交互变更还需使用专用测试服务运行 `pnpm test:e2e`。共享基础组件不导入 business、数据库或服务端代码。
