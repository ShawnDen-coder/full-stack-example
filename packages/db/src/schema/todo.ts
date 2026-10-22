import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const todo = pgTable("todo", {
	id: serial("id").primaryKey(),
	// Legacy todos have no known owner and remain inaccessible through the API.
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	text: text("text").notNull(),
	completed: boolean("completed").default(false).notNull(),
});
