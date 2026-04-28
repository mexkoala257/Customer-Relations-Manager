import { Router } from "express";
import { db, accountCustomPricesTable, partsTable, customersTable, productCategoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/customers/:id/custom-prices", requireAuth, async (req, res) => {
  const accountId = req.params.id;
  const rows = await db
    .select({
      id: accountCustomPricesTable.id,
      accountId: accountCustomPricesTable.accountId,
      partId: accountCustomPricesTable.partId,
      customPrice: accountCustomPricesTable.customPrice,
      createdAt: accountCustomPricesTable.createdAt,
      updatedAt: accountCustomPricesTable.updatedAt,
      partNumber: partsTable.partNumber,
      description: partsTable.description,
      categoryName: productCategoriesTable.name,
      retailPrice: partsTable.retailPrice,
      xstorePrice: partsTable.xstorePrice,
      tier1Price: partsTable.tier1Price,
    })
    .from(accountCustomPricesTable)
    .innerJoin(partsTable, eq(accountCustomPricesTable.partId, partsTable.id))
    .leftJoin(productCategoriesTable, eq(partsTable.categoryId, productCategoriesTable.id))
    .where(eq(accountCustomPricesTable.accountId, accountId))
    .orderBy(partsTable.partNumber);
  res.json(rows);
});

router.post("/customers/:id/custom-prices", requireAuth, async (req, res) => {
  const accountId = req.params.id;
  const userId = req.user!.userId;
  const { partId, customPrice } = req.body as { partId: number; customPrice: string };
  if (!partId || !customPrice) return res.status(400).json({ error: "partId and customPrice required" });

  const existing = await db
    .select()
    .from(accountCustomPricesTable)
    .where(and(eq(accountCustomPricesTable.accountId, accountId), eq(accountCustomPricesTable.partId, partId)))
    .limit(1);

  if (existing.length) {
    const [row] = await db
      .update(accountCustomPricesTable)
      .set({ customPrice, setByUserId: userId, updatedAt: new Date() })
      .where(eq(accountCustomPricesTable.id, existing[0].id))
      .returning();
    return res.json(row);
  }

  const [row] = await db
    .insert(accountCustomPricesTable)
    .values({ accountId, partId, customPrice, setByUserId: userId })
    .returning();
  return res.json(row);
});

router.delete("/customers/:id/custom-prices/:priceId", requireAuth, async (req, res) => {
  const priceId = Number(req.params.priceId);
  await db.delete(accountCustomPricesTable).where(eq(accountCustomPricesTable.id, priceId));
  res.json({ ok: true });
});

router.patch("/customers/:id/price-tier", requireAuth, async (req, res) => {
  const accountId = req.params.id;
  const { priceTier } = req.body as { priceTier: "retail" | "xstore" | "tier1" };
  if (!["retail", "xstore", "tier1"].includes(priceTier)) {
    return res.status(400).json({ error: "Invalid price tier" });
  }
  const [row] = await db
    .update(customersTable)
    .set({ priceTier })
    .where(eq(customersTable.id, accountId))
    .returning();
  if (!row) return res.status(404).json({ error: "Account not found" });
  return res.json(row);
});

export default router;
