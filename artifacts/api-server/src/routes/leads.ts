import { Router } from "express";
import { db, leadsTable, customersTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sendFollowUpEmail } from "../lib/mailer";
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
      staffId: usersTable.staffId,
      role: usersTable.role,
    },
  };
}

router.get("/leads", requireAuth, async (req, res): Promise<void> => {
  const qp = ListLeadsQueryParams.safeParse(req.query);
  const { status, userId, followUpToday, followUpThisWeek } = qp.success ? qp.data : {};

  const isAdmin = req.user!.role === "admin";
  const conditions = [eq(leadsTable.isActive, true)];

  if (!isAdmin) {
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

  const leads = await db
    .select(buildLeadSelect())
    .from(leadsTable)
    .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(leadsTable.createdAt));

  res.json(leads);
});

router.post("/leads", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date();
  const dateKey = parseInt(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`,
    10
  );

  const [lead] = await db.insert(leadsTable).values({
    ...parsed.data,
    userId: req.user!.userId,
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

  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && lead.userId !== req.user!.userId) {
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

  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && existing.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const updateData = { ...parsed.data };
  if (!isAdmin) {
    delete (updateData as Record<string, unknown>).userId;
  }

  const [lead] = await db
    .update(leadsTable)
    .set(updateData)
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  res.json(lead);
});

router.delete("/leads/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Lead not found" });
    return;
  }

  const isAdmin = req.user!.role === "admin";
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

  const result = await sendFollowUpEmail({
    toEmail: lead.customer?.contactName
      ? `${lead.customer.contactName.toLowerCase().replace(/\s+/g, ".")}@example.com`
      : "customer@example.com",
    toName: lead.customer?.contactName ?? "Customer",
    companyName: lead.customer?.companyName ?? "Company",
    repName: lead.user?.email ?? "Sales Rep",
    notes: lead.notes,
    followUpDate: lead.followUpDate,
  });

  res.json({ message: result.message });
});

export default router;
