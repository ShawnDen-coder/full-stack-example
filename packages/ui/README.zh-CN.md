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

1. 可复用基础组件放入 `src/components`，业务组合留在 [web](../../apps/web/src)。沿用现有 Radix／shadcn 约定、props 类型、variants 和 `cn`，不再并行引入一套 UI 体系。
2. 复用 `src/styles/theme.css` 中的语义 token。主题调整在这里集中完成，避免在调用方分散硬编码颜色。
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

## 图标规范

统一通过 `@full-stack-example/ui/components/icon` 的 `Icon` 渲染，从
`lucide-react` 按名称导入具体图标。web 和 ui 使用 workspace catalog 中同一个
固定版本，不建立导入整个图标集合的 barrel。

```tsx
import { Icon } from "@full-stack-example/ui/components/icon";
import { Layers, Pencil } from "lucide-react";

<Icon icon={Pencil} />
<Icon icon={Layers} size="logo" />
```

尺寸分为 `indicator`（12px）、`default`（16px，导航及行操作）、`toolbar`（18px）、
`logo`（22px）和 `status`（24px，独立加载／状态图标）。统一采用 24 单位 SVG
viewBox、描边 2、圆润线头与转角；描边随图形缩放。保留 `currentColor`，
`className` 用于颜色、定位和动画，不覆盖尺寸及描边。按钮点击区域与图标尺寸分开。
默认图标仅作装饰；为外层按钮提供名称，独立图标则可传 `aria-label` 或
`aria-labelledby`。加载图标仍需配合可见或读屏状态文本。

以 Shadcn Admin 接入后的组件样式和 token 为当前规范，早期 Figma 稿保留作历史参考。

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

在实际使用页面检查浅色／深色主题和键盘导航。认证或交互变更还需使用专用测试服务运行 `pnpm test:e2e`。共享基础组件不导入 domain、数据库或服务端代码。

## Shadcn Admin 来源

共享基础组件与主题取自 satnaing/shadcn-admin 提交
`e16c87f213a5ba5e45964e9b67c792105ec74d26`。参见
[迁移说明](../../docs/frontend.zh-CN.md) 和
[MIT 声明](../../third-party/shadcn-admin.LICENSE)。
统一采用 Radix 的 `asChild`，不再使用 Base UI 的 `render` 组合方式。
移除了未被应用使用的 attachment、bubble、marker、message、
message-scroller、input-group、empty 生成组件。后续组件沿用 Radix 基线。
主题 token 位于 `src/styles/theme.css`，全局规则位于 `globals.css`。
sidebar、sheet、dialog、dropdown-menu、separator、sonner 等定制组件
更新时需人工审查差异，不能直接用 CLI 覆盖。

现已纳入上游完整基础组件，包括 table、tabs、select、badge、alert/alert-dialog、
popover、collapsible、scroll-area、calendar、switch 和 input-otp。
`form` 是上游 React Hook Form 适配层；既有 TanStack Form 页面继续使用 input/label
等基础组件。业务表格工具栏、列定义、URL 状态和业务弹窗仍放在 web，不进入 UI 包。

`CommandDialog` 支持 `onCloseAutoFocus`；触发按钮位于对话框外时，调用方可恢复键盘焦点。

`Field` 与现有认证表单共享。`Empty` 提供最小的中性空状态结构，业务文案和操作留在 web。`ToggleGroup` 封装 Radix 单选／多选控件并使用本地语义样式。

`CommandDialog` 支持通过 `commandLabel` 命名搜索输入框（默认值为 “Search commands”）。

## Lx

L2. [Dependency policy / 依赖规则](../../docs/dependency-layers.zh-CN.md).
