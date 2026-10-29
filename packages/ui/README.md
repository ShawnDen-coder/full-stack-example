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
   [web](../../apps/web/src). Follow the existing Radix/shadcn conventions,
   prop typing, variants and `cn` utility rather than adding a parallel UI system.
2. Reuse semantic CSS tokens from `src/styles/theme.css`. Make theme changes
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

## Icon conventions

Use `Icon` from `@full-stack-example/ui/components/icon` with individual imports
from `lucide-react`. Both packages use the workspace catalog, pinned to the same
Lucide release. Do not create a barrel that imports the entire icon collection.

```tsx
import { Icon } from "@full-stack-example/ui/components/icon";
import { Layers, Pencil } from "lucide-react";

<Icon icon={Pencil} />
<Icon icon={Layers} size="logo" />
```

Sizes are `indicator` (12px), `default` (16px, navigation and row actions),
`toolbar` (18px), `logo` (22px), and `status` (24px, standalone loading/status).
Use a 24-unit SVG viewBox with stroke width 2, round caps and round joins; strokes
scale with the icon. Keep `currentColor`, and use `className` for color, positioning
and animation rather than overriding size or stroke geometry. Button hit areas
are independent of icon dimensions. Icons are decorative by default; label the
containing button or provide `aria-label` / `aria-labelledby` on a standalone icon.
This does not replace the visible or screen-reader status text for a loader.


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
test services. Shared primitives must not import domain, database or server code.

## Shadcn Admin source

The shared primitives and theme are adapted from satnaing/shadcn-admin at
`e16c87f213a5ba5e45964e9b67c792105ec74d26`. See
[the migration notes](../../docs/frontend.md) and
[MIT notice](../../third-party/shadcn-admin.LICENSE).
Use Radix `asChild` composition, not Base UI `render`. The former unused chat
primitives (attachment, bubble, marker, message, message-scroller, input-group,
empty) have been removed; add future components using the same Radix baseline.
Tokens live in `src/styles/theme.css`; global rules live in `globals.css`.
Do not blindly regenerate customized sidebar, sheet, dialog, dropdown-menu,
separator or sonner components: review upstream changes and local adaptations.

The complete upstream primitive set now includes table, tabs, select, badge,
alert/alert-dialog, popover, collapsible, scroll-area, calendar, switch and input-otp.
`form` is the upstream React Hook Form adapter; existing TanStack Form screens can
continue using the lower-level input/label primitives. App-specific table toolbars,
columns, URL state and business dialogs remain in web rather than this package.

`CommandDialog` accepts `onCloseAutoFocus` when its trigger lives outside the dialog, allowing callers to restore keyboard focus.

`Field` is shared with the existing authentication forms. `Empty` supplies a minimal neutral empty-state structure; feature copy and actions remain in web. `ToggleGroup` wraps the Radix single/multiple controls with local semantic styling.

`CommandDialog` accepts `commandLabel` to name its search input (default: “Search commands”).
