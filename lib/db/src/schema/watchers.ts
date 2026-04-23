import { pgTable, serial, uuid, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const watchersTable = pgTable("watchers", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type", { enum: ["lead", "customer"] }).notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
