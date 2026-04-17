import { Router } from "express";
import { db, reminderSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { runFollowUpReminders, runSummaryEmails, runPastDueReminders } from "../lib/scheduler";

const router = Router();

async function ensureSettings() {
  const rows = await db.select().from(reminderSettingsTable).where(eq(reminderSettingsTable.id, 1)).limit(1);
  if (!rows.length) {
    await db.insert(reminderSettingsTable).values({ id: 1 }).onConflictDoNothing();
    const fresh = await db.select().from(reminderSettingsTable).where(eq(reminderSettingsTable.id, 1)).limit(1);
    return fresh[0];
  }
  return rows[0];
}

router.get("/admin/reminders", requireAdmin, async (_req, res) => {
  const settings = await ensureSettings();
  res.json(settings);
});

router.put("/admin/reminders", requireAdmin, async (req, res) => {
  const { followUpReminderEnabled, followUpDaysBefore, summaryEnabled, pastDueReminderEnabled } = req.body;

  await ensureSettings();

  const updated = await db
    .update(reminderSettingsTable)
    .set({
      ...(followUpReminderEnabled !== undefined && { followUpReminderEnabled }),
      ...(followUpDaysBefore !== undefined && { followUpDaysBefore }),
      ...(summaryEnabled !== undefined && { summaryEnabled }),
      ...(pastDueReminderEnabled !== undefined && { pastDueReminderEnabled }),
      updatedAt: new Date(),
    })
    .where(eq(reminderSettingsTable.id, 1))
    .returning();

  res.json(updated[0]);
});

router.post("/admin/reminders/send-followup", requireAdmin, async (_req, res) => {
  const result = await runFollowUpReminders();
  res.json(result);
});

router.post("/admin/reminders/send-summary", requireAdmin, async (_req, res) => {
  const result = await runSummaryEmails();
  res.json(result);
});

router.post("/admin/reminders/send-pastdue", requireAdmin, async (_req, res) => {
  const result = await runPastDueReminders();
  res.json(result);
});

export default router;
