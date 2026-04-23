import { Router } from "express";
import { db, watchersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

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
