import { pgTable, serial, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const bugReportsTable = pgTable("bug_reports", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  pageUrl: text("page_url"),
  status: text("status", { enum: ["open", "in_progress", "resolved"] }).notNull().default("open"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
