import { pgTable, serial, uuid, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { partsTable } from "./parts";
import { usersTable } from "./users";

export const accountCustomPricesTable = pgTable("account_custom_prices", {
  id: serial("id").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  partId: integer("part_id").notNull().references(() => partsTable.id, { onDelete: "cascade" }),
  customPrice: numeric("custom_price", { precision: 10, scale: 2 }).notNull(),
  setByUserId: uuid("set_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountCustomPrice = typeof accountCustomPricesTable.$inferSelect;
export type InsertAccountCustomPrice = typeof accountCustomPricesTable.$inferInsert;
