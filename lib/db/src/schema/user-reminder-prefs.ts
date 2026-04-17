import { pgTable, uuid, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userReminderPrefsTable = pgTable("user_reminder_prefs", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  followUpReminderEnabled: boolean("follow_up_reminder_enabled").notNull().default(true),
  followUpDaysBefore: jsonb("follow_up_days_before").$type<number[]>().notNull().default([1, 3]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserReminderPrefs = typeof userReminderPrefsTable.$inferSelect;
