# Better Auth UI

Source: https://better-auth-ui.com/r/organization.json (retrieved 2026-10-28).
MIT license: [license](better-auth-ui.LICENSE).
Runtime data layer: @better-auth-ui/core and @better-auth-ui/react 1.7.32.

Adapted `RoleDialog`, `RolePermissionCheckbox`, `EditMemberRolesDialog`, and
`auth-form` under apps/web/src/components/auth. Imports use existing Radix
primitives. Unused custom-field support and the incompatible upstream Table v9
list shell are omitted. Role keys are immutable; updates send permissions only.
The local list shell uses the upstream hooks; Better Auth owns all authorization
and mutations. `field` and `spinner` are shadcn new-york-v4 components (MIT).
