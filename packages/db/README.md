# @full-stack-example/db

[English](README.md) · [简体中文](README.zh-CN.md) · [Project](../../README.md)

PostgreSQL infrastructure: an explicit database factory, Drizzle schema and
relations, one migration history, and deployment-only runtime role provisioning.

## Entry points

| File | Responsibility |
| --- | --- |
| [src/index.ts](src/index.ts) | `createDb`, pool limits/timeouts/metrics and idempotent `close()` |
| [src/schema/index.ts](src/schema/index.ts) | Schema exports used by Drizzle Kit |
| [src/schema/auth.ts](src/schema/auth.ts) | Better Auth generated tables and relation parts |
| [src/schema/todo.ts](src/schema/todo.ts) | Business table, foreign key and owner/pagination index |
| [src/relations.ts](src/relations.ts) | Relations v2 composition for relational queries |
| [src/migrations](src/migrations) | Reviewed SQL and snapshots |
| [src/provision.ts](src/provision.ts) | Explicit server/worker role grants during deployment |
| [drizzle.config.ts](drizzle.config.ts) | Schema and migration locations |

## Extend

1. Group new tables by business feature under `src/schema`. Define indexes,
   foreign keys, nullability and unique constraints alongside the table. Export
   tables through `src/schema/index.ts`; add a public subpath only when needed.
2. Import peer schema files directly to avoid barrel cycles. Define/combine v2
   relation parts in `src/relations.ts` when relational queries need them. ORM
   relations do not replace SQL foreign keys.
3. Keep Better Auth's generated file together. For auth changes, use
   [auth schema generation](../../docs/development.md#better-auth-schema-generation)
   before generating the database migration.
4. From the workspace root, run `pnpm db:generate`, review SQL and snapshots,
   commit them, then run `pnpm db:migrate`. Use dedicated test data to verify both
   an empty database and upgrades from the previous schema. Do not rewrite applied
   migrations or use `db:push` as the release path.
5. Review `src/provision.ts` for every new table or capability. Grant only the
   operations each runtime needs; adding a schema does not automatically grant
   access. Migration credentials stay in deployment tasks.
6. Put feature queries in [domain](../domain/README.md), not in this package.
   Applications create/close their own database instances; repositories can use
   an injected database or transaction without owning its connection pool.

## Example: add an optional Todo due date

This schema extension is not present today. In
[src/schema/todo.ts](src/schema/todo.ts), add `timestamp` to the existing
`drizzle-orm/pg-core` import, then add a nullable column to the existing table's
column object:

```ts
dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
```

Keep the existing owner/ID index. If the new query actually filters or orders by
owner and due date, append this index to the table's existing index array:

```ts
index("todo_user_due_idx").on(table.userId, table.dueAt),
```

Existing rows get `NULL`; there is no guessed backfill or new NOT NULL constraint.
The table is already exported, so no new `schema/index.ts` export or package
subpath is needed. Add `dueAt` to the repository's explicit projection only when
the API should return it, then update service/API types, date validation and web
rendering together. A new table, unlike this new column, also needs explicit
schema exports and reviewed runtime grants in `src/provision.ts`.

From the root, with local configuration initialized:

```bash
pnpm db:generate
# Review the new SQL and snapshot under packages/db/src/migrations, then commit them.
pnpm db:migrate
pnpm --filter @full-stack-example/db check-types
```

Test an empty database and an upgrade containing existing Todos: old rows remain
readable with `dueAt: null`, dates round-trip correctly, and foreign-user rows
remain inaccessible. Use a dedicated test database for these checks. The new
index should match the actual query plan; do not add one solely for this example.

## Verify

Run from the workspace root:

```bash
pnpm --filter @full-stack-example/db check-types
pnpm test:integration
```

The integration command requires dedicated `TEST_DATABASE_URL` and
`TEST_REDIS_URL`. Role tests modify the fixed app_server/app_worker roles and
public-schema grants. Preserve the existing inaccessible ownerless Todo policy;
data backfills or ownership changes need a separate explicit migration plan.

## Roles and page access

[Implementation and extension rules](../../docs/access-control.md).
