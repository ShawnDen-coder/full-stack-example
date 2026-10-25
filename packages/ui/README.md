# @full-stack-example/ui

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
   as `@full-stack-example/ui/components/name`; normally no root barrel is needed.
4. Keep labels, keyboard/focus behavior, disabled and error states accessible.
   Loading, empty and mutation-error states for a feature stay in its web screen.
5. If using shadcn generation, follow
   [UI customization](../../docs/development.md#ui-customization) and review
   generated dependency/config changes. Keep UI libraries in this package;
   application-only libraries stay with web.

Existing usage:

```tsx
import { Button } from "@full-stack-example/ui/components/button";

export function SaveButton() {
  return <Button type="submit">Save</Button>;
}
```

## Example: add a shared PendingButton

This proposed component prevents repeat submission and reuses the existing
Button's variants, focus behavior and tokens. Create
`src/components/pending-button.tsx`:

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

The existing `./components/*` export already exposes
`@full-stack-example/ui/components/pending-button`; no barrel or manifest change
is required. After implementing the [Todo rename walkthrough](../../docs/extension-examples.md#case-1-rename-a-todo),
the web form can import it and use:

```tsx
<PendingButton type="submit" pending={renameMutation.isPending}>
  Save
</PendingButton>
```

Keep the mutation, session, input validation and errors in web. Include pending
state in the form's submit guard too; disabling one button is not a request lock.
Check keyboard activation, existing `disabled` behavior, busy label and
light/dark appearance. Add a browser test proving repeated submissions while
pending do not start another mutation and failure re-enables editing.

## Verify

Run from the workspace root:

```bash
pnpm --filter @full-stack-example/ui check-types
pnpm --filter web check-types
pnpm --filter web build
```

Inspect the consuming screen in light/dark themes and with keyboard navigation.
For authentication or interaction changes, run `pnpm test:e2e` against dedicated
test services. Shared primitives must not import business, database or server code.
