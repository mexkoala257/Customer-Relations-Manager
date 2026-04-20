import { Router } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/products", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(productsTable)
    .orderBy(productsTable.category, productsTable.name);
  res.json(rows);
});

router.post("/products", requireAdmin, async (req, res) => {
  const { name, description, sku, category, unitPrice, isActive } = req.body;
  if (!name || unitPrice === undefined) {
    return res.status(400).json({ error: "name and unitPrice are required" });
  }
  const [row] = await db
    .insert(productsTable)
    .values({
      name,
      description: description ?? null,
      sku: sku ?? null,
      category: category ?? null,
      unitPrice: String(unitPrice),
      isActive: isActive !== false,
    })
    .returning();
  return res.status(201).json(row);
});

router.put("/products/:id", requireAdmin, async (req, res) => {
  const { name, description, sku, category, unitPrice, isActive } = req.body;
  const [row] = await db
    .update(productsTable)
    .set({
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(sku !== undefined && { sku }),
      ...(category !== undefined && { category }),
      ...(unitPrice !== undefined && { unitPrice: String(unitPrice) }),
      ...(isActive !== undefined && { isActive }),
      updatedAt: new Date(),
    })
    .where(eq(productsTable.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Product not found" });
  return res.json(row);
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  await db
    .update(productsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(productsTable.id, req.params.id));
  return res.json({ message: "Product deactivated" });
});

export default router;
