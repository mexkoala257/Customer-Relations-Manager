import { pgTable, serial, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const emailStatusEnum = pgEnum("email_status", ["sent", "failed", "skipped"]);

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: emailStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});
