# @my-better-t-app/ui

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

Shared React primitives, styles and utilities. Feature pages, routing, sessions
and API queries belong to the web application.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/components/button.tsx](src/components/button.tsx) | Reference primitive and variants |
| [src/styles/globals.css](src/styles/globals.css) | Shared tokens, theme and global styles |
| [src/lib/utils.ts](src/lib/utils.ts) | Shared class utility |
| [components.json](components.json) | shadcn aliases, style and registry settings |
| [package.json](package.json) | Wildcard component/utility/hook exports and global CSS export |

## Extend

1. Put reusable primitives under `src/components`; keep feature composition under
   [web](../../apps/web/src). Follow the existing Base UI/shadcn conventions,
   prop typing, variants and `cn` utility rather than adding a parallel UI system.
2. Reuse semantic CSS tokens from `src/styles/globals.css`. Make theme changes
   there rather than scattering fixed colors across consumers.
3. Use filenames matching the export patterns. A new `.tsx` primitive is imported
   as `@my-better-t-app/ui/components/name`; normally no root barrel is needed.
4. Keep labels, keyboard/focus behavior, disabled and error states accessible.
   Loading, empty and mutation-error states for a feature stay in its web screen.
5. If using shadcn generation, follow
   [UI customization](../../docs/development.md#ui-customization) and review
   generated dependency/config changes. Keep UI libraries in this package;
   application-only libraries stay with web.

Existing usage:

```tsx
import { Button } from "@my-better-t-app/ui/components/button";

export function SaveButton() {
  return <Button type="submit">Save</Button>;
}
```

## Verify

Run from the workspace root:

```bash
pnpm --filter @my-better-t-app/ui check-types
pnpm --filter web check-types
pnpm --filter web build
```

Inspect the consuming screen in light/dark themes and with keyboard navigation.
For authentication or interaction changes, run `pnpm test:e2e` against dedicated
test services. Shared primitives must not import business, database or server code.
