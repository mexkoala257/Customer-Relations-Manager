import { Router } from "express";
import { db, userReminderPrefsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

async function ensurePrefs(userId: string) {
  const rows = await db.select().from(userReminderPrefsTable).where(eq(userReminderPrefsTable.userId, userId)).limit(1);
  if (!rows.length) {
    await db.insert(userReminderPrefsTable).values({ userId }).onConflictDoNothing();
    const fresh = await db.select().from(userReminderPrefsTable).where(eq(userReminderPrefsTable.userId, userId)).limit(1);
    return fresh[0];
  }
  return rows[0];
}

router.get("/user/reminder-prefs", requireAuth, async (req, res): Promise<void> => {
  const prefs = await ensurePrefs(req.user!.userId);
  res.json(prefs);
});

router.put("/user/reminder-prefs", requireAuth, async (req, res): Promise<void> => {
  const { followUpReminderEnabled, followUpDaysBefore } = req.body;
  const userId = req.user!.userId;

  await ensurePrefs(userId);

  const updated = await db
    .update(userReminderPrefsTable)
    .set({
      ...(followUpReminderEnabled !== undefined && { followUpReminderEnabled }),
      ...(followUpDaysBefore !== undefined && { followUpDaysBefore }),
      updatedAt: new Date(),
    })
    .where(eq(userReminderPrefsTable.userId, userId))
    .returning();

  res.json(updated[0]);
});

export default router;
