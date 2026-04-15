import cron from "node-cron";
import { db, reminderSettingsTable, leadsTable, usersTable, customersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { sendFollowUpReminderEmail, sendSummaryEmail } from "./mailer";
import { logger } from "./logger";

async function getSettings() {
  const rows = await db.select().from(reminderSettingsTable).where(eq(reminderSettingsTable.id, 1)).limit(1);
  return rows[0] ?? null;
}

async function markFollowUpRun() {
  await db.update(reminderSettingsTable).set({ lastFollowUpRun: new Date() }).where(eq(reminderSettingsTable.id, 1));
}

async function markSummaryRun() {
  await db.update(reminderSettingsTable).set({ lastSummaryRun: new Date() }).where(eq(reminderSettingsTable.id, 1));
}

export async function runFollowUpReminders(): Promise<{ emailsSent: number; logs: string[] }> {
  const logs: string[] = [];
  const settings = await getSettings();

  if (!settings) {
    logs.push("No reminder settings found — skipping");
    return { emailsSent: 0, logs };
  }
  if (!settings.followUpReminderEnabled) {
    logs.push("Follow-up reminders are disabled — skipping");
    return { emailsSent: 0, logs };
  }

  const daysBefore = (settings.followUpDaysBefore as number[]) ?? [1, 3];
  const maxDays = Math.max(...daysBefore);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + maxDays);

  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  logs.push(`Checking leads with follow-up between ${todayStr} and ${cutoffStr}`);

  const leads = await db
    .select({
      leadId: leadsTable.id,
      followUpDate: leadsTable.followUpDate,
      status: leadsTable.status,
      notes: leadsTable.notes,
      userId: leadsTable.userId,
      repEmail: usersTable.email,
      companyName: customersTable.companyName,
      contactName: customersTable.contactName,
    })
    .from(leadsTable)
    .innerJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .where(
      and(
        gte(leadsTable.followUpDate, todayStr),
        lte(leadsTable.followUpDate, cutoffStr)
      )
    );

  if (!leads.length) {
    logs.push("No leads with upcoming follow-ups found");
    await markFollowUpRun();
    return { emailsSent: 0, logs };
  }

  const byRep = new Map<string, { email: string; leads: typeof leads }>();
  for (const lead of leads) {
    const key = lead.userId;
    if (!byRep.has(key)) byRep.set(key, { email: lead.repEmail, leads: [] });
    const days = Math.round((new Date(lead.followUpDate!).getTime() - today.getTime()) / 86400000);
    if (daysBefore.some((d) => d === days)) {
      byRep.get(key)!.leads.push(lead);
    }
  }

  let emailsSent = 0;
  for (const [, { email, leads: repLeads }] of byRep) {
    if (!repLeads.length) continue;
    const repName = email.split("@")[0];
    const result = await sendFollowUpReminderEmail({
      toEmail: email,
      repName,
      leads: repLeads.map((l) => ({
        companyName: l.companyName,
        contactName: l.contactName,
        followUpDate: l.followUpDate!,
        status: l.status,
        notes: l.notes,
      })),
    });
    logs.push(`${result.sent ? "✓ Sent" : "○ Logged"} follow-up reminder to ${email} (${repLeads.length} lead${repLeads.length !== 1 ? "s" : ""})`);
    if (result.sent) emailsSent++;
  }

  await markFollowUpRun();
  return { emailsSent, logs };
}

export async function runSummaryEmails(): Promise<{ emailsSent: number; logs: string[] }> {
  const logs: string[] = [];
  const settings = await getSettings();

  if (!settings) {
    logs.push("No reminder settings found — skipping");
    return { emailsSent: 0, logs };
  }
  if (!settings.summaryEnabled) {
    logs.push("Summary emails are disabled — skipping");
    return { emailsSent: 0, logs };
  }

  const today = new Date();
  const dayOfWeek = today.getDay();
  const periodLabel = dayOfWeek === 1 ? "Monday" : "Friday";

  const since = new Date(today);
  since.setDate(since.getDate() - 7);

  const upcoming = new Date(today);
  upcoming.setDate(upcoming.getDate() + 7);

  const todayStr = today.toISOString().slice(0, 10);
  const sinceStr = since.toISOString().slice(0, 10);
  const upcomingStr = upcoming.toISOString().slice(0, 10);

  const [recentLeads, upcomingLeads, allUsers] = await Promise.all([
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
      .where(
        and(
          gte(leadsTable.followUpDate, todayStr),
          lte(leadsTable.followUpDate, upcomingStr)
        )
      ),
    db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable),
  ]);

  logs.push(`Sending ${periodLabel} summary to ${allUsers.length} user(s) — ${recentLeads.length} recent, ${upcomingLeads.length} upcoming`);

  let emailsSent = 0;
  for (const user of allUsers) {
    const recipientName = user.email.split("@")[0];
    const result = await sendSummaryEmail({
      toEmail: user.email,
      recipientName,
      periodLabel: `${periodLabel} Morning`,
      recentLeads: recentLeads.map((l) => ({ ...l, updatedAt: l.updatedAt.toISOString().slice(0, 10) })),
      upcomingLeads: upcomingLeads
        .filter((l): l is typeof l & { followUpDate: string } => l.followUpDate !== null),
    });
    logs.push(`${result.sent ? "✓ Sent" : "○ Logged"} ${periodLabel} summary to ${user.email}`);
    if (result.sent) emailsSent++;
  }

  await markSummaryRun();
  return { emailsSent, logs };
}

export function startScheduler() {
  logger.info("Starting reminder scheduler");

  cron.schedule("0 8 * * *", async () => {
    logger.info("Running daily follow-up reminder check");
    try {
      const result = await runFollowUpReminders();
      logger.info(result, "Follow-up reminder run complete");
    } catch (err) {
      logger.error({ err }, "Follow-up reminder run failed");
    }
  });

  cron.schedule("0 8 * * 1,5", async () => {
    logger.info("Running Mon/Fri summary email");
    try {
      const result = await runSummaryEmails();
      logger.info(result, "Summary email run complete");
    } catch (err) {
      logger.error({ err }, "Summary email run failed");
    }
  });
}
