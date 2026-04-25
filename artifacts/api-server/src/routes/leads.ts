import { Router } from "express";
import { db, leadsTable, customersTable, usersTable, watchersTable } from "@workspace/db";
import { eq, and, desc, asc, sql, ne, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sendFollowUpEmail, sendWatcherNotificationEmail } from "../lib/mailer";
import {
  CreateLeadBody,
  UpdateLeadBody,
  GetLeadParams,
  UpdateLeadParams,
  DeleteLeadParams,
  ListLeadsQueryParams,
  SendFollowupEmailParams,
} from "@workspace/api-zod";

const router = Router();

function buildLeadSelect() {
  return {
    id: leadsTable.id,
    customerId: leadsTable.customerId,
    userId: leadsTable.userId,
    notes: leadsTable.notes,
    status: leadsTable.status,
    isActive: leadsTable.isActive,
    followUpDate: leadsTable.followUpDate,
    dateKey: leadsTable.dateKey,
    metadata: leadsTable.metadata,
    createdAt: leadsTable.createdAt,
    customer: {
      id: customersTable.id,
      companyName: customersTable.companyName,
      contactName: customersTable.contactName,
      phone: customersTable.phone,
      streetAddress: customersTable.streetAddress,
      city: customersTable.city,
      state: customersTable.state,
      zipCode: customersTable.zipCode,
      createdAt: customersTable.createdAt,
    },
    user: {
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      staffId: usersTable.staffId,
      role: usersTable.role,
    },
  };
}

/** Returns the weekday dateKey boundaries (YYYYMMDD) for the current ISO week. */
function thisWeekDateKeys(): { mondayKey: number; sundayKey: number } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    parseInt(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`,
      10,
    );
  return { mondayKey: fmt(monday), sundayKey: fmt(sunday) };
}

/** Finds the sales rep with the fewest active leads created this week. */
async function findRepWithFewestLeadsThisWeek(): Promise<string | null> {
  const salesReps = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "sales"));

  if (salesReps.length === 0) return null;

  const { mondayKey, sundayKey } = thisWeekDateKeys();

  const weeklyCounts = await db
    .select({
      userId: leadsTable.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .where(
      and(
        sql`${leadsTable.dateKey} >= ${mondayKey}`,
        sql`${leadsTable.dateKey} <= ${sundayKey}`,
        inArray(
          leadsTable.userId,
          salesReps.map((r) => r.id),
        ),
      ),
    )
    .groupBy(leadsTable.userId);

  const countMap = new Map(weeklyCounts.map((r) => [r.userId, r.count]));

  let assignedId = salesReps[0].id;
  let minCount = countMap.get(salesReps[0].id) ?? 0;
  for (const rep of salesReps.slice(1)) {
    const c = countMap.get(rep.id) ?? 0;
    if (c < minCount) {
      minCount = c;
      assignedId = rep.id;
    }
  }

  return assignedId;
}

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  const qp = ListLeadsQueryParams.safeParse(req.query);
  const { status, userId, followUpToday, followUpThisWeek, pastDue } = qp.success ? qp.data : {};

  const role = req.user!.role;
  const isAdmin = role === "admin" || role === "superadmin";
  const isDataEntry = role === "data-entry";
  const canSeeAll = isAdmin || isDataEntry;

  const conditions = [eq(leadsTable.isActive, true)];

  if (!canSeeAll) {
    conditions.push(eq(leadsTable.userId, req.user!.userId));
  } else if (userId) {
    conditions.push(eq(leadsTable.userId, userId));
  }

  if (status) {
    conditions.push(eq(leadsTable.status, status as "New" | "Qualify" | "Discovery" | "Proposal" | "Negotiate" | "Close Loss" | "Close Win" | "Maintain" | "Grow"));
  }

  if (followUpToday === "true") {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    conditions.push(eq(leadsTable.followUpDate, todayStr));
  }

  if (followUpThisWeek === "true") {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = sunday.toISOString().split("T")[0];
    conditions.push(
      and(
        sql`${leadsTable.followUpDate} >= ${mondayStr}`,
        sql`${leadsTable.followUpDate} <= ${sundayStr}`,
        sql`${leadsTable.followUpDate} IS NOT NULL`
      )!
    );
  }

  if (pastDue === "true") {
    const todayStr = new Date().toISOString().split("T")[0];
    conditions.push(
      and(
        sql`${leadsTable.followUpDate} IS NOT NULL`,
        sql`${leadsTable.followUpDate} < ${todayStr}`
      )!
    );
  }

  const leads = await db
    .select(buildLeadSelect())
    .from(leadsTable)
    .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(pastDue === "true" ? asc(leadsTable.followUpDate) : desc(leadsTable.createdAt));

  res.json(leads);
});

router.post("/leads", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isDataEntry = req.user!.role === "data-entry";

  let assignedUserId: string;
  if (isDataEntry) {
    const repId = await findRepWithFewestLeadsThisWeek();
    if (!repId) {
      res.status(400).json({ error: "No sales reps available to assign this lead" });
      return;
    }
    assignedUserId = repId;
  } else {
    assignedUserId = req.user!.userId;
  }

  const today = new Date();
  const dateKey = parseInt(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`,
    10
  );

  const [lead] = await db.insert(leadsTable).values({
    ...parsed.data,
    userId: assignedUserId,
    dateKey,
    isActive: true,
  }).returning();

  await db
    .update(leadsTable)
    .set({ isActive: false })
    .where(
      and(
        eq(leadsTable.customerId, parsed.data.customerId),
        ne(leadsTable.id, lead.id)
      )
    );

  res.status(201).json(lead);
});

router.get("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .select(buildLeadSelect())
    .from(leadsTable)
    .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .where(eq(leadsTable.id, params.data.id));

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const role = req.user!.role;
  const isAdmin = role === "admin" || role === "superadmin";
  const isDataEntry = role === "data-entry";
  if (!isAdmin && !isDataEntry && lead.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(lead);
});

router.patch("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const role = req.user!.role;
  const isAdmin = role === "admin" || role === "superadmin";
  const isDataEntry = role === "data-entry";

  if (!isAdmin && !isDataEntry && existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updateData = { ...parsed.data };
  // Only admins can reassign leads; data-entry and sales reps cannot change userId
  if (!isAdmin) {
    delete (updateData as Record<string, unknown>).userId;
  }

  // Detect what changed for watcher notifications
  const watchedFields: Array<{ field: string; key: keyof typeof updateData; existing: string | null }> = [
    { field: "Status", key: "status", existing: existing.status },
    { field: "Notes", key: "notes", existing: existing.notes ?? "" },
    { field: "Follow-up Date", key: "followUpDate", existing: existing.followUpDate ?? "" },
  ];
  const changes = watchedFields
    .filter(({ key }) => key in updateData && String((updateData as Record<string, unknown>)[key] ?? "") !== String(existing[key] ?? ""))
    .map(({ field, key, existing: from }) => ({
      field,
      from: from || "(none)",
      to: String((updateData as Record<string, unknown>)[key] ?? "") || "(none)",
    }));

  const [lead] = await db
    .update(leadsTable)
    .set(updateData)
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  // Notify watchers asynchronously (don't block the response)
  if (changes.length > 0) {
    (async () => {
      try {
        const [updaterUser] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
        const [customer] = await db.select({ companyName: customersTable.companyName }).from(customersTable).where(eq(customersTable.id, existing.customerId));
        const watchers = await db
          .select({ userId: watchersTable.userId, email: usersTable.email })
          .from(watchersTable)
          .leftJoin(usersTable, eq(watchersTable.userId, usersTable.id))
          .where(and(eq(watchersTable.entityType, "lead"), eq(watchersTable.entityId, String(params.data.id))));

        const entityUrl = `${process.env.APP_URL ?? ""}/leads/${params.data.id}`;
        for (const w of watchers) {
          if (!w.email || w.userId === req.user!.userId) continue; // don't notify the person who made the change
          await sendWatcherNotificationEmail({
            toEmail: w.email,
            entityType: "lead",
            entityName: customer?.companyName ?? "Lead",
            changedBy: updaterUser?.email ?? "A team member",
            changes,
            entityUrl,
          });
        }
      } catch { /* silent */ }
    })();
  }

  res.json(lead);
});

router.delete("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const role = req.user!.role;
  const isDataEntry = role === "data-entry";
  if (isDataEntry) {
    res.status(403).json({ error: "Data entry users cannot delete leads" });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const isAdmin = role === "admin" || role === "superadmin";
  if (!isAdmin && existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/leads/:id/send-followup", requireAuth, async (req, res): Promise<void> => {
  const params = SendFollowupEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [lead] = await db
    .select(buildLeadSelect())
    .from(leadsTable)
    .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .where(eq(leadsTable.id, params.data.id));

  if (!lead) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const repEmail = lead.user?.email ?? "";
  const repFullName = lead.user?.fullName?.trim() ?? "";
  const repFirstName = repFullName ? repFullName.split(/\s+/)[0] : repEmail.split("@")[0];

  const result = await sendFollowUpEmail({
    toEmail: repEmail,
    toName: repFirstName,
    companyName: lead.customer?.companyName ?? "Company",
    repName: repFirstName,
    notes: lead.notes,
    followUpDate: lead.followUpDate,
  });

  res.json({ message: result.message });
});

export default router;
