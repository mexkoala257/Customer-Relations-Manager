import { pgTable, serial, text, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { productCategoriesTable } from "./product-categories";

export const partsTable = pgTable("parts", {
  id: serial("id").primaryKey(),
  partNumber: text("part_number").notNull().unique(),
  description: text("description"),
  categoryId: integer("category_id").references(() => productCategoriesTable.id, { onDelete: "set null" }),
  retailPrice: numeric("retail_price", { precision: 10, scale: 2 }),
  xstorePrice: numeric("xstore_price", { precision: 10, scale: 2 }),
  tier1Price: numeric("tier1_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Part = typeof partsTable.$inferSelect;
export type InsertPart = typeof partsTable.$inferInsert;
