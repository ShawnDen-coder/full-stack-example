import { boolean, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const workspaceTool = pgTable(
	"workspace_tool",
	{
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		toolKey: text("tool_key").notNull(),
		enabled: boolean("enabled").notNull().default(false),
	},
	(table) => [primaryKey({ columns: [table.workspaceId, table.toolKey] })],
);
