# Frontend

[简体中文](frontend.zh-CN.md)

The frontend adopts the page and component baseline from
[Shadcn Admin](https://github.com/satnaing/shadcn-admin), pinned to
`e16c87f213a5ba5e45964e9b67c792105ec74d26`. The upstream project is a UI
collection, not a production backend. Its MIT notice is retained in
`third-party/shadcn-admin.LICENSE`.

## Routes and data

| URL | Behavior |
| --- | --- |
| `/` | Redirect to `/tasks`; protected destinations require a session |
| `/dashboard` | Original overview and analytics with sample statistics |
| `/tasks` | Original task table, filters, sorting, selection, dialogs and pagination; sample data |
| `/apps` | Original integrations grid, filtering and sorting; sample connections |
| `/users` | Original user table, roles, statuses, add/invite/delete dialogs; sample users |
| `/chats` | Original conversation UI and sample conversations; no messages sent |
| `/settings` | Live Better Auth profile update; email remains read-only |
| `/settings/appearance` | Live device-local light/dark/system preference |
| `/settings/account`, `/settings/notifications`, `/settings/display` | Original demo forms; changes are not saved |
| `/help-center` | Original upstream Coming Soon page |
| `/errors/$error` | Error gallery inside the authenticated shell |
| `/401`, `/403`, `/404`, `/500`, `/503` | Standalone upstream error pages |
| `/sign-in`, `/sign-up`, `/sign-in-2` | Better Auth forms and validated return paths; alternate sign-in uses upstream two-column layout |
| `/forgot-password`, `/otp` | Upstream UI previews; no email delivery, verification or session creation |
| `/todos` | Existing live user-owned Todo CRUD, editing, recovery and cursor pagination |
| Other URLs | Root not-found boundary |

Legacy `/login`, `/register` and `/settings/profile` redirect to canonical routes.
Navigation retains upstream General / Pages / Other groups and collapsible
submenus, plus a Personal group for the existing live Todos. Collapsed submenus
open as dropdowns. The original logo is used in the shell, auth screens and favicon.

## Integration boundary

This is an application migration, not an unmodified replacement of the monorepo.
Upstream feature modules live in `apps/web/src/features`; Radix primitives live in
`packages/ui`. Existing Hono, Better Auth, oRPC, worker and database packages remain.
The upstream Clerk showcase, mock login token store, Axios client and bootstrap
are not activated. Better Auth continues to enforce protected routes and oRPC
retains session-generation checks, owner-scoped caches and server pagination.
The canonical auth forms and live profile/appearance screens are local adapters;
the upstream equivalents remain available as source references.

The Tasks and Users fixtures are static snapshots of the upstream seeded data,
so Faker is not shipped to browsers. Demo actions explicitly describe previews
rather than claiming persistence, sent invitations or completed exports.
Before wiring these pages to production data, implement and authorize their
backend contracts; in particular, a logged-in user must not automatically gain
user-management privileges. Table filtering currently operates on the complete
sample array, not a page of real server data.

The URL is the source of truth for Apps and table filters, including browser
back/forward navigation. Original layouts, dialogs and component composition are
preserved; local adaptations repair accessibility and avoid duplicate page shells.
Theme controls share the existing next-themes provider. Layout and direction use
upstream non-sensitive preference cookies. Global search navigates pages.

## Maintenance

Compare updates against the pinned upstream revision and merge customizations
explicitly. Do not overwrite auth/session adapters, shared dialog accessibility,
scroll locking or live features with upstream demonstrations. Keep the MIT notice.
Run frozen installation, unit/type/build/lint checks, integration tests and browser
tests against dedicated Podman services. Review desktop screenshots, filters and
history, dialogs, collapsed navigation, theme persistence and cross-account cache
isolation. Earlier Figma exploration is historical; the upstream baseline defines
the current frontend.
