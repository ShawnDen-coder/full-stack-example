# Frontend

[简体中文](frontend.zh-CN.md)

The desktop frontend adopts [Shadcn Admin](https://github.com/satnaing/shadcn-admin),
pinned to `e16c87f213a5ba5e45964e9b67c792105ec74d26`. Its README describes a UI
collection rather than a turnkey authenticated application. Keep its MIT notice
in `third-party/shadcn-admin.LICENSE`.

## Routes

| URL | Behavior |
| --- | --- |
| `/` | Redirect to Todos; auth guard sends anonymous visitors to login |
| `/sign-in`, `/sign-up` | Public auth shell; validated return URL; signed-in users redirect |
| `/tasks` | Authenticated, real oRPC CRUD and cursor pagination |
| `/settings` | Profile entry; authenticated Better Auth name update |
| `/settings/appearance` | Authenticated device-local light/dark/system preference |
| `/dashboard` | Legacy redirect to Todos |
| Other URLs | Root not-found boundary |

Root owns theme, toast, session boundary and development-only tools. `_auth` owns
route authentication and the sidebar shell. Settings owns its nested navigation.
Global search navigates these real pages; it does not search all Todo data.

## Integration boundary

Upstream Radix primitives, theme, sidebar, header/main and settings/auth layout
patterns are used across web. Shared code lives in packages/ui; app composition
lives in apps/web. Retain Better Auth, TanStack Form, oRPC, session generation
checks, owner-scoped queries and server pagination. No Clerk, Axios, mock data,
fake dashboard, social login, password-reset or email-change UI is exposed.
Profile saves persist the name; email is read-only. Theme changes apply immediately.

The upstream CSS override disabling Radix body scroll locking is omitted. Command
dialog title and description are inside the portal. Original Figma experiments
are historical; this integrated upstream baseline now defines the UI.

To upgrade, compare upstream against the pinned revision, manually merge customized
primitives, run unit/type/build/browser checks, and review desktop light/dark
screens, keyboard navigation, collapse persistence and account cache isolation.

Legacy `/login`, `/register`, `/todos`, `/settings/profile` redirect to the canonical upstream routes, preserving validated auth return URLs.
