import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth.js";

export const tenantNotes = pgTable("tenant_notes", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id")
    .notNull()
    .references(() => organization.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
