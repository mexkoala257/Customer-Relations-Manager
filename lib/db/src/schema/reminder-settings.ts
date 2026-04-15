import { pgTable, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const reminderSettingsTable = pgTable("reminder_settings", {
  id: integer("id").primaryKey().default(1),
  followUpReminderEnabled: boolean("follow_up_reminder_enabled").notNull().default(true),
  followUpDaysBefore: jsonb("follow_up_days_before").$type<number[]>().notNull().default([1, 3]),
  summaryEnabled: boolean("summary_enabled").notNull().default(true),
  lastFollowUpRun: timestamp("last_follow_up_run", { withTimezone: true }),
  lastSummaryRun: timestamp("last_summary_run", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReminderSettings = typeof reminderSettingsTable.$inferSelect;
