CREATE TABLE "tenant_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN CREATE ROLE app_runtime NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_migrator') THEN CREATE ROLE app_migrator NOLOGIN; END IF;
END $$;
ALTER TABLE "tenant_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_notes_isolation ON "tenant_notes"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
REVOKE ALL ON "tenant_notes" FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_notes" TO app_runtime;
--> statement-breakpoint
ALTER TABLE "tenant_notes" ADD CONSTRAINT "tenant_notes_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
