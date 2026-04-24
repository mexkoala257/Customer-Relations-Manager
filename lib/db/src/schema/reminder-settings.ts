import { pgTable, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export type ReportSectionId =
  | "pipeline_summary"
  | "recent_activity"
  | "upcoming_followups"
  | "overdue_leads"
  | "won_leads"
  | "top_performers";

export type ReportSection = {
  id: ReportSectionId;
  enabled: boolean;
  daysBack?: number;
  daysAhead?: number;
};

export const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  { id: "pipeline_summary", enabled: true },
  { id: "recent_activity", enabled: true, daysBack: 7 },
  { id: "upcoming_followups", enabled: true, daysAhead: 7 },
  { id: "overdue_leads", enabled: true },
  { id: "won_leads", enabled: false },
  { id: "top_performers", enabled: false },
];

export const reminderSettingsTable = pgTable("reminder_settings", {
  id: integer("id").primaryKey().default(1),
  followUpReminderEnabled: boolean("follow_up_reminder_enabled").notNull().default(true),
  followUpDaysBefore: jsonb("follow_up_days_before").$type<number[]>().notNull().default([1, 3]),
  summaryEnabled: boolean("summary_enabled").notNull().default(true),
  pastDueReminderEnabled: boolean("past_due_reminder_enabled").notNull().default(false),
  reportSections: jsonb("report_sections").$type<ReportSection[]>().default(DEFAULT_REPORT_SECTIONS),
  lastFollowUpRun: timestamp("last_follow_up_run", { withTimezone: true }),
  lastSummaryRun: timestamp("last_summary_run", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReminderSettings = typeof reminderSettingsTable.$inferSelect;
