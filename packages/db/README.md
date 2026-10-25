# @my-better-t-app/db

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
6. Put feature queries in [business](../business/README.md), not in this package.
   Applications create/close their own database instances; repositories can use
   an injected database or transaction without owning its connection pool.

## Verify

Run from the workspace root:

```bash
pnpm --filter @my-better-t-app/db check-types
pnpm test:integration
```

The integration command requires dedicated `TEST_DATABASE_URL` and
`TEST_REDIS_URL`. Role tests modify the fixed app_server/app_worker roles and
public-schema grants. Preserve the existing inaccessible ownerless Todo policy;
data backfills or ownership changes need a separate explicit migration plan.
