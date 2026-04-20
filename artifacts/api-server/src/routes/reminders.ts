import { Router } from "express";
import { db, reminderSettingsTable, leadsTable, usersTable, customersTable } from "@workspace/db";
import { eq, and, gte, lte, lt } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { runFollowUpReminders, runSummaryEmails, runPastDueReminders } from "../lib/scheduler";
import { sendFollowUpReminderEmail, sendPastDueReminderEmail, sendSummaryEmail } from "../lib/mailer";

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

router.post("/admin/reminders/send-followup-user/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length) return res.status(404).json({ error: "User not found" });
  const user = users[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 30);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const leads = await db
    .select({
      followUpDate: leadsTable.followUpDate,
      status: leadsTable.status,
      notes: leadsTable.notes,
      companyName: customersTable.companyName,
      contactName: customersTable.contactName,
    })
    .from(leadsTable)
    .innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .where(and(eq(leadsTable.userId, userId), eq(leadsTable.isActive, true), gte(leadsTable.followUpDate, todayStr), lte(leadsTable.followUpDate, cutoffStr)));

  if (!leads.length) {
    return res.json({ sent: false, message: "No upcoming follow-ups for this user in the next 30 days" });
  }

  const repName = user.email.split("@")[0];
  const result = await sendFollowUpReminderEmail({
    toEmail: user.email,
    repName,
    leads: leads.map((l) => ({
      companyName: l.companyName,
      contactName: l.contactName,
      followUpDate: l.followUpDate!,
      status: l.status,
      notes: l.notes,
    })),
  });
  return res.json(result);
});

router.post("/admin/reminders/send-pastdue-user/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length) return res.status(404).json({ error: "User not found" });
  const user = users[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const leads = await db
    .select({
      followUpDate: leadsTable.followUpDate,
      status: leadsTable.status,
      notes: leadsTable.notes,
      companyName: customersTable.companyName,
      contactName: customersTable.contactName,
    })
    .from(leadsTable)
    .innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .where(and(eq(leadsTable.userId, userId), eq(leadsTable.isActive, true), lt(leadsTable.followUpDate, todayStr)));

  if (!leads.length) {
    return res.json({ sent: false, message: "No overdue leads for this user" });
  }

  const repName = user.email.split("@")[0];
  const result = await sendPastDueReminderEmail({
    toEmail: user.email,
    repName,
    leads: leads.map((l) => ({
      companyName: l.companyName,
      contactName: l.contactName,
      followUpDate: l.followUpDate!,
      status: l.status,
      notes: l.notes,
    })),
  });
  return res.json(result);
});

router.post("/admin/reminders/send-summary-user/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!users.length) return res.status(404).json({ error: "User not found" });
  const user = users[0];

  const today = new Date();
  const since = new Date(today);
  since.setDate(since.getDate() - 7);
  const upcoming = new Date(today);
  upcoming.setDate(upcoming.getDate() + 7);

  const todayStr = today.toISOString().slice(0, 10);
  const sinceStr = since.toISOString().slice(0, 10);
  const upcomingStr = upcoming.toISOString().slice(0, 10);

  const [recentLeads, upcomingLeads] = await Promise.all([
    db
      .select({
        companyName: customersTable.companyName,
        contactName: customersTable.contactName,
        status: leadsTable.status,
        repEmail: usersTable.email,
        updatedAt: leadsTable.createdAt,
      })
      .from(leadsTable)
      .innerJoin(usersTable, eq(leadsTable.userId, usersTable.id))
      .innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(gte(leadsTable.createdAt, since)),
    db
      .select({
        companyName: customersTable.companyName,
        contactName: customersTable.contactName,
        followUpDate: leadsTable.followUpDate,
        status: leadsTable.status,
        repEmail: usersTable.email,
      })
      .from(leadsTable)
      .innerJoin(usersTable, eq(leadsTable.userId, usersTable.id))
      .innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
      .where(and(gte(leadsTable.followUpDate, todayStr), lte(leadsTable.followUpDate, upcomingStr))),
  ]);

  const recipientName = user.email.split("@")[0];
  const result = await sendSummaryEmail({
    toEmail: user.email,
    recipientName,
    periodLabel: "Activity",
    recentLeads: recentLeads.map((l) => ({ ...l, updatedAt: l.updatedAt.toISOString().slice(0, 10) })),
    upcomingLeads: upcomingLeads.filter((l): l is typeof l & { followUpDate: string } => l.followUpDate !== null),
  });
  return res.json(result);
});

export default router;
