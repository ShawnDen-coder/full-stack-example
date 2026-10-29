import { boolean, index, pgTable, serial, text } from "drizzle-orm/pg-core";

import { organization, user } from "./auth";

export const todo = pgTable(
	"todo",
	{
		id: serial("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => organization.id, { onDelete: "restrict" }),
		// Legacy todos have no known owner and remain inaccessible through the API.
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		text: text("text").notNull(),
		completed: boolean("completed").default(false).notNull(),
	},
	(table) => [
		index("todo_workspace_user_id_idx").on(
			table.workspaceId,
			table.userId,
			table.id,
		),
	],
);
