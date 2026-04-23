import { Router } from "express";
import { db, watchersTable, usersTable, leadsTable, customersTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── Get all entities the current user is watching ─────────────────────────────

router.get("/watchers/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  // Fetch all watcher rows for this user
  const watcherRows = await db
    .select()
    .from(watchersTable)
    .where(eq(watchersTable.userId, userId));

  if (watcherRows.length === 0) {
    res.json([]);
    return;
  }

  const leadWatchers = watcherRows.filter((w) => w.entityType === "lead");
  const customerWatchers = watcherRows.filter((w) => w.entityType === "customer");

  const result: Array<{
    id: number;
    entityType: "lead" | "customer";
    entityId: string;
    createdAt: string;
    companyName: string;
    contactName: string | null;
    leadStatus: string | null;
  }> = [];

  // Resolve lead watchers — join leads → customers
  // entityId is stored as text; leads.id is uuid — cast uuid to text for comparison
  if (leadWatchers.length > 0) {
    const leadIds = leadWatchers.map((w) => w.entityId);
    const leads = await db
      .select({
        id: leadsTable.id,
        status: leadsTable.status,
        customerId: leadsTable.customerId,
        companyName: customersTable.companyName,
        contactName: customersTable.contactName,
      })
      .from(leadsTable)
      .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(inArray(sql`${leadsTable.id}::text`, leadIds));

    const leadMap = new Map(leads.map((l) => [l.id, l]));

    for (const w of leadWatchers) {
      const lead = leadMap.get(w.entityId);
      result.push({
        id: w.id,
        entityType: "lead",
        entityId: w.entityId,
        createdAt: w.createdAt as unknown as string,
        companyName: lead?.companyName ?? "Unknown",
        contactName: lead?.contactName ?? null,
        leadStatus: lead?.status ?? null,
      });
    }
  }

  // Resolve customer watchers — same uuid→text cast
  if (customerWatchers.length > 0) {
    const customerIds = customerWatchers.map((w) => w.entityId);
    const customers = await db
      .select({ id: customersTable.id, companyName: customersTable.companyName, contactName: customersTable.contactName })
      .from(customersTable)
      .where(inArray(sql`${customersTable.id}::text`, customerIds));

    const customerMap = new Map(customers.map((c) => [c.id, c]));

    for (const w of customerWatchers) {
      const customer = customerMap.get(w.entityId);
      result.push({
        id: w.id,
        entityType: "customer",
        entityId: w.entityId,
        createdAt: w.createdAt as unknown as string,
        companyName: customer?.companyName ?? "Unknown",
        contactName: customer?.contactName ?? null,
        leadStatus: null,
      });
    }
  }

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
