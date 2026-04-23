import { Router } from "express";
import { db, watchersTable, usersTable, leadsTable, customersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── Get all entities the current user is watching ─────────────────────────────

router.get("/watchers/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const rows = await db
    .select({
      id: watchersTable.id,
      entityType: watchersTable.entityType,
      entityId: watchersTable.entityId,
      createdAt: watchersTable.createdAt,
      leadStatus: leadsTable.status,
      leadCustomerId: leadsTable.customerId,
      companyName: customersTable.companyName,
      contactName: customersTable.contactName,
    })
    .from(watchersTable)
    .leftJoin(leadsTable, and(
      eq(watchersTable.entityType, "lead"),
      eq(watchersTable.entityId, leadsTable.id)
    ))
    .leftJoin(customersTable, and(
      eq(watchersTable.entityType, "customer"),
      eq(watchersTable.entityId, customersTable.id)
    ))
    .where(eq(watchersTable.userId, userId));

  // For leads, we also need the customer name — do a secondary lookup
  const leadRows = rows.filter((r) => r.entityType === "lead" && r.leadCustomerId && !r.companyName);
  let extraCustomers: Record<string, string> = {};
  if (leadRows.length > 0) {
    const ids = [...new Set(leadRows.map((r) => r.leadCustomerId!))];
    const custRows = await db.select({ id: customersTable.id, companyName: customersTable.companyName }).from(customersTable);
    extraCustomers = Object.fromEntries(custRows.map((c) => [c.id, c.companyName]));
  }

  const result = rows.map((r) => ({
    id: r.id,
    entityType: r.entityType,
    entityId: r.entityId,
    createdAt: r.createdAt,
    companyName: r.companyName ?? (r.leadCustomerId ? extraCustomers[r.leadCustomerId] : null) ?? "Unknown",
    contactName: r.contactName ?? null,
    leadStatus: r.leadStatus ?? null,
  }));

  res.json(result);
});

// ── Get watchers for an entity ────────────────────────────────────────────────

router.get("/watchers/:entityType/:entityId", requireAuth, async (req, res): Promise<void> => {
  const { entityType, entityId } = req.params;
  if (entityType !== "lead" && entityType !== "customer") {
    res.status(400).json({ error: "Invalid entity type" }); return;
  }

  const rows = await db
    .select({
      id: watchersTable.id,
      userId: watchersTable.userId,
      email: usersTable.email,
      createdAt: watchersTable.createdAt,
    })
    .from(watchersTable)
    .leftJoin(usersTable, eq(watchersTable.userId, usersTable.id))
    .where(
      and(
        eq(watchersTable.entityType, entityType as "lead" | "customer"),
        eq(watchersTable.entityId, entityId)
      )
    );

  res.json(rows);
});

// ── Toggle watch (follow/unfollow) ────────────────────────────────────────────

router.post("/watchers/:entityType/:entityId/toggle", requireAuth, async (req, res): Promise<void> => {
  const { entityType, entityId } = req.params;
  if (entityType !== "lead" && entityType !== "customer") {
    res.status(400).json({ error: "Invalid entity type" }); return;
  }

  const userId = req.user!.userId;

  const [existing] = await db
    .select()
    .from(watchersTable)
    .where(
      and(
        eq(watchersTable.userId, userId),
        eq(watchersTable.entityType, entityType as "lead" | "customer"),
        eq(watchersTable.entityId, entityId)
      )
    );

  if (existing) {
    await db.delete(watchersTable).where(eq(watchersTable.id, existing.id));
    res.json({ watching: false });
  } else {
    await db.insert(watchersTable).values({
      userId,
      entityType: entityType as "lead" | "customer",
      entityId,
    });
    res.json({ watching: true });
  }
});

export default router;
