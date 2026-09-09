import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";
import { organization } from "./auth.js";

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => organization.id),
});
