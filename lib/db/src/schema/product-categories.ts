import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const productCategoriesTable = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductCategory = typeof productCategoriesTable.$inferSelect;
export type InsertProductCategory = typeof productCategoriesTable.$inferInsert;
