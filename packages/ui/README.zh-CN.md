# @full-stack-example/ui

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
3. 文件名与导出模式保持一致。新增 `.tsx` 组件可通过 `@full-stack-example/ui/components/name` 引入，通常不需要新增根 barrel。
4. 保证标签、键盘／焦点行为、禁用和错误状态可访问。某个业务的加载、空状态和写入失败提示由 web 页面负责。
5. 使用 shadcn 生成时遵循 [UI 定制说明](../../docs/development.zh-CN.md#ui-定制)，审查生成的依赖和配置变更。UI 库依赖放在本包，应用专用库留在 web。

现有使用方式：

```tsx
import { Button } from "@full-stack-example/ui/components/button";

export function SaveButton() {
  return <Button type="submit">Save</Button>;
}
```

## 示例：增加共享 PendingButton

这个待实现的组件用于避免重复提交，复用已有 Button 的 variants、焦点行为和设计变量。新增 `src/components/pending-button.tsx`：

```tsx
import type { ComponentProps } from "react";
import { Button } from "./button";

type PendingButtonProps = ComponentProps<typeof Button> & {
  pending?: boolean;
  pendingLabel?: string;
};

export function PendingButton({
  pending = false,
  pendingLabel = "Saving...",
  children,
  disabled,
  ...props
}: PendingButtonProps) {
  return (
    <Button {...props} disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
```

已有 `./components/*` export 会直接开放 `@full-stack-example/ui/components/pending-button`，无需增加 barrel 或修改 manifest。完成 [Todo 重命名案例](../../docs/extension-examples.zh-CN.md#案例一重命名-todo)后，web 表单可导入并使用：

```tsx
<PendingButton type="submit" pending={renameMutation.isPending}>
  Save
</PendingButton>
```

Mutation、session、输入校验和错误处理留在 web。表单的 submit handler 也要检查 pending，禁用单个按钮不等于给请求加锁。检查键盘操作、原有 `disabled`、忙碌文案以及浅色／深色主题，并添加浏览器用例：请求未完成时重复提交不会触发新 mutation，失败后可以继续编辑。

## 验证

从工作区根目录执行：

```bash
pnpm --filter @full-stack-example/ui check-types
pnpm --filter web check-types
pnpm --filter web build
```

在实际使用页面检查浅色／深色主题和键盘导航。认证或交互变更还需使用专用测试服务运行 `pnpm test:e2e`。共享基础组件不导入 business、数据库或服务端代码。
