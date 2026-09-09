ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "organization"("id");
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "todos" WHERE "tenant_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enable tenant isolation: todos contains rows without tenant_id. Backfill each row explicitly before rerunning migration.';
  END IF;
END $$;
ALTER TABLE "todos" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todos" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "todos_tenant_isolation" ON "todos";
CREATE POLICY "todos_tenant_isolation" ON "todos"
  USING ("tenant_id" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

REVOKE ALL ON TABLE "todos" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "todos" TO app_runtime;
GRANT USAGE, SELECT ON SEQUENCE "todos_id_seq" TO app_runtime;
