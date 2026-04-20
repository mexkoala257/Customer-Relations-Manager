import { pgTable, text, uuid, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { usersTable } from "./users";
import { productsTable } from "./products";

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "declined"] as const;
export type QuoteStatus = typeof QUOTE_STATUSES[number];

export const quotesTable = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customersTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quoteItemsTable = pgTable("quote_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotesTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertQuoteSchema = createInsertSchema(quotesTable).omit({
  id: true,
  subtotal: true,
  taxAmount: true,
  total: true,
  sentAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotesTable.$inferSelect;
export type QuoteItem = typeof quoteItemsTable.$inferSelect;
