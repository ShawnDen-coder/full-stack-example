CREATE TABLE "workspace_tool" (
	"workspace_id" text,
	"tool_key" text,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "workspace_tool_pkey" PRIMARY KEY("workspace_id","tool_key")
);
--> statement-breakpoint
DROP INDEX "todo_user_id_id_idx";--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "workspace_id" text;
--> statement-breakpoint
-- All existing records belong to the original application workspace. Unknown owners stay inaccessible.
UPDATE "todo" SET "workspace_id" = 'application';
--> statement-breakpoint
ALTER TABLE "todo" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "member_workspace_user_uidx" ON "member" ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_role_workspace_role_uidx" ON "organization_role" ("organization_id","role");--> statement-breakpoint
CREATE INDEX "todo_workspace_user_id_idx" ON "todo" ("workspace_id","user_id","id");--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organization"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "workspace_tool" ADD CONSTRAINT "workspace_tool_workspace_id_organization_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organization"("id") ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO "workspace_tool" ("workspace_id", "tool_key", "enabled") VALUES ('application', 'todos', true);
