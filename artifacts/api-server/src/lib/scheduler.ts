import cron from "node-cron";
import { db, reminderSettingsTable, leadsTable, usersTable, customersTable, userReminderPrefsTable, DEFAULT_REPORT_SECTIONS } from "@workspace/db";
import type { ReportSection } from "@workspace/db";
import { eq, and, gte, lte, lt, sql } from "drizzle-orm";
import { sendFollowUpReminderEmail, sendSummaryEmail, sendPastDueReminderEmail } from "./mailer";
import { logger } from "./logger";

async function getSettings() {
  const rows = await db.select().from(reminderSettingsTable).where(eq(reminderSettingsTable.id, 1)).limit(1);
  return rows[0] ?? null;
}

async function getUserPrefs(userId: string) {
  const rows = await db.select().from(userReminderPrefsTable).where(eq(userReminderPrefsTable.userId, userId)).limit(1);
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

  const globalDaysBefore = (settings.followUpDaysBefore as number[]) ?? [1, 3];
  const maxDays = Math.max(...globalDaysBefore);

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
        eq(leadsTable.isActive, true),
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

    const userPrefs = await getUserPrefs(lead.userId);
    const daysBefore = userPrefs?.followUpDaysBefore ?? globalDaysBefore;
    const reminderEnabled = userPrefs?.followUpReminderEnabled ?? true;

    if (reminderEnabled && (daysBefore as number[]).some((d) => d === days)) {
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

export async function runPastDueReminders(): Promise<{ emailsSent: number; logs: string[] }> {
  const logs: string[] = [];
  const settings = await getSettings();

  if (!settings) {
    logs.push("No reminder settings found — skipping");
    return { emailsSent: 0, logs };
  }
  if (!settings.pastDueReminderEnabled) {
    logs.push("Past-due reminders are disabled — skipping");
    return { emailsSent: 0, logs };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  logs.push(`Checking for overdue leads (follow-up date before ${todayStr})`);

  const overdueLeads = await db
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
        eq(leadsTable.isActive, true),
        lt(leadsTable.followUpDate, todayStr)
      )
    );

  if (!overdueLeads.length) {
    logs.push("No overdue leads found — skipping");
    return { emailsSent: 0, logs };
  }

  const byRep = new Map<string, { email: string; leads: typeof overdueLeads }>();
  for (const lead of overdueLeads) {
    if (!byRep.has(lead.userId)) byRep.set(lead.userId, { email: lead.repEmail, leads: [] });
    byRep.get(lead.userId)!.leads.push(lead);
  }

  let emailsSent = 0;
  for (const [, { email, leads: repLeads }] of byRep) {
    const repName = email.split("@")[0];
    const result = await sendPastDueReminderEmail({
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
    logs.push(`${result.sent ? "✓ Sent" : "○ Logged"} past-due alert to ${email} (${repLeads.length} overdue lead${repLeads.length !== 1 ? "s" : ""})`);
    if (result.sent) emailsSent++;
  }

  return { emailsSent, logs };
}

export async function buildSummaryReportData(sections: ReportSection[]) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const isEnabled = (id: string) => sections.find((s) => s.id === id)?.enabled ?? false;
  const getSection = (id: string) => sections.find((s) => s.id === id);

  const daysBack = getSection("recent_activity")?.daysBack ?? 7;
  const daysAhead = getSection("upcoming_followups")?.daysAhead ?? 7;

  const since = new Date(today);
  since.setDate(since.getDate() - daysBack);
  const upcomingDate = new Date(today);
  upcomingDate.setDate(upcomingDate.getDate() + daysAhead);
  const sinceStr = since.toISOString().slice(0, 10);
  const upcomingStr = upcomingDate.toISOString().slice(0, 10);

  const queries: Promise<any>[] = [];
  const keys: string[] = [];

  queries.push(db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable));
  keys.push("allUsers");

  // Recent Activity
  queries.push(
    isEnabled("recent_activity")
      ? db.select({ companyName: customersTable.companyName, contactName: customersTable.contactName, status: leadsTable.status, repEmail: usersTable.email, repName: usersTable.fullName, updatedAt: leadsTable.createdAt, notes: leadsTable.notes })
          .from(leadsTable).innerJoin(usersTable, eq(leadsTable.userId, usersTable.id)).innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
          .where(gte(leadsTable.createdAt, since))
      : Promise.resolve([])
  );
  keys.push("recentLeads");

  // Upcoming Follow-ups
  queries.push(
    isEnabled("upcoming_followups")
      ? db.select({ companyName: customersTable.companyName, contactName: customersTable.contactName, followUpDate: leadsTable.followUpDate, status: leadsTable.status, repEmail: usersTable.email, repName: usersTable.fullName, notes: leadsTable.notes })
          .from(leadsTable).innerJoin(usersTable, eq(leadsTable.userId, usersTable.id)).innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
          .where(and(gte(leadsTable.followUpDate, todayStr), lte(leadsTable.followUpDate, upcomingStr)))
      : Promise.resolve([])
  );
  keys.push("upcomingLeads");

  // Overdue
  queries.push(
    isEnabled("overdue_leads")
      ? db.select({ companyName: customersTable.companyName, contactName: customersTable.contactName, followUpDate: leadsTable.followUpDate, status: leadsTable.status, repEmail: usersTable.email, repName: usersTable.fullName, notes: leadsTable.notes })
          .from(leadsTable).innerJoin(usersTable, eq(leadsTable.userId, usersTable.id)).innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
          .where(and(lt(leadsTable.followUpDate, todayStr), eq(leadsTable.isActive, true)))
      : Promise.resolve([])
  );
  keys.push("overdueLeads");

  // Won Leads
  queries.push(
    isEnabled("won_leads")
      ? db.select({ companyName: customersTable.companyName, contactName: customersTable.contactName, status: leadsTable.status, repEmail: usersTable.email, repName: usersTable.fullName, updatedAt: leadsTable.createdAt, notes: leadsTable.notes })
          .from(leadsTable).innerJoin(usersTable, eq(leadsTable.userId, usersTable.id)).innerJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
          .where(and(eq(leadsTable.status, "Close Win"), gte(leadsTable.createdAt, since)))
      : Promise.resolve([])
  );
  keys.push("wonLeads");

  // Pipeline counts
  queries.push(
    isEnabled("pipeline_summary")
      ? db.select({ status: leadsTable.status, count: sql<number>`count(*)::int` }).from(leadsTable).where(eq(leadsTable.isActive, true)).groupBy(leadsTable.status)
      : Promise.resolve([])
  );
  keys.push("pipelineCounts");

  const results = await Promise.all(queries);
  const data: Record<string, any[]> = {};
  keys.forEach((k, i) => { data[k] = results[i]; });

  // Top performers
  let topPerformers: { repEmail: string; repName: string; count: number }[] = [];
  if (isEnabled("top_performers") && data.allUsers.length) {
    const repCounts = await db.select({ userId: leadsTable.userId, count: sql<number>`count(*)::int` })
      .from(leadsTable).where(eq(leadsTable.isActive, true)).groupBy(leadsTable.userId);
    topPerformers = repCounts
      .filter((r) => r.userId)
      .map((r) => {
        const user = data.allUsers.find((u: any) => u.id === r.userId);
        return { repEmail: user?.email ?? "?", repName: user?.name || user?.email?.split("@")[0] || "?", count: r.count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  return {
    allUsers: data.allUsers as { id: string; email: string; name: string | null }[],
    recentLeads: (data.recentLeads as any[]).map((l) => ({ ...l, updatedAt: l.updatedAt instanceof Date ? l.updatedAt.toISOString().slice(0, 10) : String(l.updatedAt).slice(0, 10) })),
    upcomingLeads: (data.upcomingLeads as any[]).filter((l) => l.followUpDate !== null) as any[],
    overdueLeads: (data.overdueLeads as any[]).filter((l) => l.followUpDate !== null) as any[],
    wonLeads: (data.wonLeads as any[]).map((l) => ({ ...l, updatedAt: l.updatedAt instanceof Date ? l.updatedAt.toISOString().slice(0, 10) : String(l.updatedAt).slice(0, 10) })),
    pipelineCounts: data.pipelineCounts as { status: string; count: number }[],
    topPerformers,
  };
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

  const sections: ReportSection[] = (settings.reportSections as ReportSection[] | null) ?? DEFAULT_REPORT_SECTIONS;

  const data = await buildSummaryReportData(sections);

  logs.push(`Sending ${periodLabel} summary to ${data.allUsers.length} user(s) — ${data.recentLeads.length} recent, ${data.upcomingLeads.length} upcoming`);

  let emailsSent = 0;
  for (const user of data.allUsers) {
    const recipientName = user.name || user.email.split("@")[0];
    const result = await sendSummaryEmail({
      toEmail: user.email,
      recipientName,
      periodLabel: `${periodLabel} Morning`,
      sections,
      recentLeads: data.recentLeads,
      upcomingLeads: data.upcomingLeads,
      overdueLeads: data.overdueLeads,
      wonLeads: data.wonLeads,
      pipelineCounts: data.pipelineCounts,
      topPerformers: data.topPerformers,
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

  cron.schedule("0 8 * * *", async () => {
    logger.info("Running daily past-due reminder check");
    try {
      const result = await runPastDueReminders();
      logger.info(result, "Past-due reminder run complete");
    } catch (err) {
      logger.error({ err }, "Past-due reminder run failed");
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
