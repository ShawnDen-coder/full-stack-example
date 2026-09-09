ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "organization"("id");
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
