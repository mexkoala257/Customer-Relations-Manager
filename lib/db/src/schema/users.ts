import { pgTable, text, uuid, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  staffId: integer("staff_id").notNull(),
  role: text("role", { enum: ["superadmin", "admin", "sales", "data-entry"] }).notNull().default("sales"),
  fullName: text("full_name"),
  phone: text("phone"),
  weeklyLeadGoal: integer("weekly_lead_goal"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
