import { Router } from "express";
import { db, productCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/categories", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(productCategoriesTable)
    .orderBy(productCategoriesTable.name);
  res.json(rows);
});

router.post("/categories", requireAdmin, async (req, res) => {
  const { name, description } = req.body as { name: string; description?: string };
  if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
  const existing = await db
    .select()
    .from(productCategoriesTable)
    .where(eq(productCategoriesTable.name, name.trim()))
    .limit(1);
  if (existing.length) return res.status(409).json({ error: "Category already exists" });
  const [row] = await db
    .insert(productCategoriesTable)
    .values({ name: name.trim(), description: description?.trim() || null })
    .returning();
  return res.json(row);
});

router.patch("/categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body as { name?: string; description?: string };
  const updates: Partial<{ name: string; description: string | null }> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  const [row] = await db
    .update(productCategoriesTable)
    .set(updates)
    .where(eq(productCategoriesTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.delete("/categories/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(productCategoriesTable).where(eq(productCategoriesTable.id, id));
  res.json({ ok: true });
});

export default router;
