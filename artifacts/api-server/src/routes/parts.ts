import { Router } from "express";
import { db, partsTable, productCategoriesTable } from "@workspace/db";
import { eq, ilike, or, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/parts", requireAuth, async (req, res) => {
  const { q, categoryId, includeInactive, limit: limitParam, offset: offsetParam } = req.query as Record<string, string>;
  const limit = Math.min(Math.max(Number(limitParam) || 100, 1), 500);
  const offset = Math.max(Number(offsetParam) || 0, 0);

  const conditions = [];
  if (!includeInactive || includeInactive !== "true") {
    conditions.push(eq(partsTable.isActive, true));
  }
  if (categoryId) {
    conditions.push(eq(partsTable.categoryId, Number(categoryId)));
  }
  if (q?.trim()) {
    conditions.push(
      or(
        ilike(partsTable.partNumber, `%${q.trim()}%`),
        ilike(partsTable.description, `%${q.trim()}%`)
      )!
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(partsTable)
    .where(where);

  const rows = await db
    .select({
      id: partsTable.id,
      partNumber: partsTable.partNumber,
      description: partsTable.description,
      categoryId: partsTable.categoryId,
      categoryName: productCategoriesTable.name,
      retailPrice: partsTable.retailPrice,
      xstorePrice: partsTable.xstorePrice,
      tier1Price: partsTable.tier1Price,
      isActive: partsTable.isActive,
      createdAt: partsTable.createdAt,
      updatedAt: partsTable.updatedAt,
    })
    .from(partsTable)
    .leftJoin(productCategoriesTable, eq(partsTable.categoryId, productCategoriesTable.id))
    .where(where)
    .orderBy(partsTable.partNumber)
    .limit(limit)
    .offset(offset);

  res.json({ rows, total, limit, offset });
});

router.get("/parts/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({
      id: partsTable.id,
      partNumber: partsTable.partNumber,
      description: partsTable.description,
      categoryId: partsTable.categoryId,
      categoryName: productCategoriesTable.name,
      retailPrice: partsTable.retailPrice,
      xstorePrice: partsTable.xstorePrice,
      tier1Price: partsTable.tier1Price,
      isActive: partsTable.isActive,
    })
    .from(partsTable)
    .leftJoin(productCategoriesTable, eq(partsTable.categoryId, productCategoriesTable.id))
    .where(eq(partsTable.id, id))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.post("/parts", requireAdmin, async (req, res) => {
  const { partNumber, description, categoryId, retailPrice, xstorePrice, tier1Price } = req.body as {
    partNumber: string;
    description?: string;
    categoryId?: number;
    retailPrice?: string;
    xstorePrice?: string;
    tier1Price?: string;
  };
  if (!partNumber?.trim()) return res.status(400).json({ error: "Part number is required" });
  const [row] = await db
    .insert(partsTable)
    .values({
      partNumber: partNumber.trim().toUpperCase(),
      description: description?.trim() || null,
      categoryId: categoryId || null,
      retailPrice: retailPrice || null,
      xstorePrice: xstorePrice || null,
      tier1Price: tier1Price || null,
    })
    .returning();
  return res.json(row);
});

router.patch("/parts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const updates = req.body as Partial<{
    partNumber: string;
    description: string;
    categoryId: number | null;
    retailPrice: string;
    xstorePrice: string;
    tier1Price: string;
    isActive: boolean;
  }>;
  const [row] = await db
    .update(partsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(partsTable.id, id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
});

router.post("/parts/:id/toggle-active", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [current] = await db.select({ isActive: partsTable.isActive }).from(partsTable).where(eq(partsTable.id, id)).limit(1);
  if (!current) return res.status(404).json({ error: "Not found" });
  const [row] = await db
    .update(partsTable)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(eq(partsTable.id, id))
    .returning();
  return res.json(row);
});

router.delete("/parts/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(partsTable).where(eq(partsTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

router.post("/parts/bulk", requireAdmin, async (req, res) => {
  const { parts } = req.body as {
    parts: {
      partNumber: string;
      description?: string;
      categoryId?: number | null;
      retailPrice?: string | null;
      xstorePrice?: string | null;
      tier1Price?: string | null;
    }[];
  };
  if (!Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "No parts provided" });
  }
  const inserted: number[] = [];
  const skipped: string[] = [];
  for (const p of parts) {
    if (!p.partNumber?.trim()) continue;
    try {
      await db
        .insert(partsTable)
        .values({
          partNumber: p.partNumber.trim().toUpperCase(),
          description: p.description?.trim() || null,
          categoryId: p.categoryId || null,
          retailPrice: p.retailPrice || null,
          xstorePrice: p.xstorePrice || null,
          tier1Price: p.tier1Price || null,
        })
        .onConflictDoNothing();
      inserted.push(1);
    } catch {
      skipped.push(p.partNumber);
    }
  }
  return res.json({ inserted: inserted.length, skipped });
});

router.post("/parts/bulk-update-prices", requireAdmin, async (req, res) => {
  const { updates } = req.body as {
    updates: {
      id: number;
      retailPrice?: string | null;
      xstorePrice?: string | null;
      tier1Price?: string | null;
    }[];
  };
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: "No updates provided" });
  }
  let count = 0;
  for (const u of updates) {
    if (!u.id) continue;
    await db
      .update(partsTable)
      .set({
        retailPrice: u.retailPrice ?? undefined,
        xstorePrice: u.xstorePrice ?? undefined,
        tier1Price: u.tier1Price ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(partsTable.id, u.id));
    count++;
  }
  return res.json({ updated: count });
});

export default router;
