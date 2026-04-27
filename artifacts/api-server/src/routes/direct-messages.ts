import { Router } from "express";
import { db, directMessagesTable, usersTable } from "@workspace/db";
import { eq, and, isNull, or, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function notExpired() {
  return or(
    isNull(directMessagesTable.firstViewedAt),
    sql`${directMessagesTable.firstViewedAt} + INTERVAL '5 days' > NOW()`
  );
}

router.get("/dm/unread-count", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(directMessagesTable)
    .where(and(eq(directMessagesTable.toUserId, userId), isNull(directMessagesTable.firstViewedAt)));
  res.json({ count: rows[0]?.count ?? 0 });
});

router.get("/dm/inbox", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db
    .select({
      id: directMessagesTable.id,
      body: directMessagesTable.body,
      createdAt: directMessagesTable.createdAt,
      firstViewedAt: directMessagesTable.firstViewedAt,
      fromUserId: directMessagesTable.fromUserId,
      fromName: usersTable.fullName,
      fromEmail: usersTable.email,
    })
    .from(directMessagesTable)
    .innerJoin(usersTable, eq(directMessagesTable.fromUserId, usersTable.id))
    .where(and(eq(directMessagesTable.toUserId, userId), notExpired()!))
    .orderBy(desc(directMessagesTable.createdAt));
  res.json(rows);
});

router.get("/dm/sent", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db
    .select({
      id: directMessagesTable.id,
      body: directMessagesTable.body,
      createdAt: directMessagesTable.createdAt,
      firstViewedAt: directMessagesTable.firstViewedAt,
      toUserId: directMessagesTable.toUserId,
      toName: usersTable.fullName,
      toEmail: usersTable.email,
    })
    .from(directMessagesTable)
    .innerJoin(usersTable, eq(directMessagesTable.toUserId, usersTable.id))
    .where(eq(directMessagesTable.fromUserId, userId))
    .orderBy(desc(directMessagesTable.createdAt));
  res.json(rows);
});

router.post("/dm/mark-viewed", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  await db
    .update(directMessagesTable)
    .set({ firstViewedAt: new Date() })
    .where(and(eq(directMessagesTable.toUserId, userId), isNull(directMessagesTable.firstViewedAt)));
  res.json({ ok: true });
});

router.get("/dm/recipients", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const users = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email, role: usersTable.role })
    .from(usersTable)
    .where(
      and(
        sql`${usersTable.id} != ${userId}::uuid`,
        sql`${usersTable.role} != 'superadmin'`,
        eq(usersTable.isLocked, false)
      )
    );
  res.json(users);
});

router.post("/dm", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { toUserId, body } = req.body as { toUserId: string; body: string };

  if (!toUserId || !body?.trim()) {
    return res.status(400).json({ error: "toUserId and body are required" });
  }
  if (body.trim().length > 500) {
    return res.status(400).json({ error: "Message too long (max 500 characters)" });
  }

  const recipient = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, toUserId))
    .limit(1);

  if (!recipient.length || recipient[0].role === "superadmin") {
    return res.status(403).json({ error: "Cannot send message to this user" });
  }

  const [msg] = await db
    .insert(directMessagesTable)
    .values({ fromUserId: userId, toUserId, body: body.trim() })
    .returning();

  return res.json(msg);
});

export default router;
