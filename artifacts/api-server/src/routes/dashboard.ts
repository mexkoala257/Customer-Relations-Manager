import { Router } from "express";
import { db, leadsTable, customersTable, usersTable } from "@workspace/db";
import { eq, and, count, desc, gte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.user!.role === "admin";
  const userId = req.user!.userId;

  const today = new Date().toISOString().split("T")[0];

  // Calculate the start of the current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday);
  monday.setHours(0, 0, 0, 0);

  const [totalLeadsRow] = await db.select({ count: count() }).from(leadsTable).where(eq(leadsTable.isActive, true));
  const [myLeadsRow] = await db
    .select({ count: count() })
    .from(leadsTable)
    .where(eq(leadsTable.userId, userId));
  const [followUpsRow] = await db
    .select({ count: count() })
    .from(leadsTable)
    .where(
      isAdmin
        ? eq(leadsTable.followUpDate, today)
        : and(eq(leadsTable.userId, userId), eq(leadsTable.followUpDate, today))
    );
  const [totalCustomersRow] = await db.select({ count: count() }).from(customersTable);
  const [wonLeadsRow] = await db
    .select({ count: count() })
    .from(leadsTable)
    .where(
      isAdmin
        ? eq(leadsTable.status, "Close Win")
        : and(eq(leadsTable.userId, userId), eq(leadsTable.status, "Close Win"))
    );
  const [newLeadsRow] = await db
    .select({ count: count() })
    .from(leadsTable)
    .where(
      isAdmin
        ? eq(leadsTable.status, "New")
        : and(eq(leadsTable.userId, userId), eq(leadsTable.status, "New"))
    );
  const [leadsThisWeekRow] = await db
    .select({ count: count() })
    .from(leadsTable)
    .where(
      isAdmin
        ? gte(leadsTable.createdAt, monday)
        : and(eq(leadsTable.userId, userId), gte(leadsTable.createdAt, monday))
    );

  // Fetch the current user's weekly goal
  const [userRow] = await db
    .select({ weeklyLeadGoal: usersTable.weeklyLeadGoal })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.json({
    totalLeads: Number(totalLeadsRow?.count ?? 0),
    myLeads: Number(myLeadsRow?.count ?? 0),
    followUpsToday: Number(followUpsRow?.count ?? 0),
    totalCustomers: Number(totalCustomersRow?.count ?? 0),
    wonLeads: Number(wonLeadsRow?.count ?? 0),
    newLeads: Number(newLeadsRow?.count ?? 0),
    leadsThisWeek: Number(leadsThisWeekRow?.count ?? 0),
    weeklyLeadGoal: userRow?.weeklyLeadGoal ?? null,
  });
});

router.get("/dashboard/activity", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.user!.role === "admin";
  const userId = req.user!.userId;

  const leads = await db
    .select({
      id: leadsTable.id,
      customerId: leadsTable.customerId,
      userId: leadsTable.userId,
      notes: leadsTable.notes,
      status: leadsTable.status,
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
    })
    .from(leadsTable)
    .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .where(isAdmin ? undefined : eq(leadsTable.userId, userId))
    .orderBy(desc(leadsTable.createdAt))
    .limit(10);

  res.json(leads);
});

router.get("/dashboard/status-breakdown", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.user!.role === "admin";
  const userId = req.user!.userId;

  const breakdown = await db
    .select({
      status: leadsTable.status,
      count: count(),
    })
    .from(leadsTable)
    .where(isAdmin ? undefined : eq(leadsTable.userId, userId))
    .groupBy(leadsTable.status)
    .orderBy(leadsTable.status);

  res.json(breakdown.map((r) => ({ status: r.status, count: Number(r.count) })));
});

export default router;
