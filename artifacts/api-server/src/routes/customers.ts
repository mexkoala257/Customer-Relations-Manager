import { Router } from "express";
import { db, customersTable, leadsTable, usersTable, accountNotesTable } from "@workspace/db";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
  ListCustomersQueryParams,
} from "@workspace/api-zod";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

const router = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const qp = ListCustomersQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;

  const customers = search
    ? await db.select().from(customersTable).where(
        or(
          ilike(customersTable.companyName, `%${search}%`),
          ilike(customersTable.contactName, `%${search}%`),
          ilike(customersTable.city, `%${search}%`),
        )
      ).orderBy(customersTable.companyName)
    : await db.select().from(customersTable).orderBy(customersTable.companyName);

  res.json(customers);
});

router.post("/customers", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db.insert(customersTable).values(parsed.data).returning();
  res.status(201).json(customer);
});

router.get("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, params.data.id));

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const leads = await db
    .select({
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
    })
    .from(leadsTable)
    .leftJoin(customersTable, eq(leadsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(leadsTable.userId, usersTable.id))
    .where(eq(leadsTable.customerId, params.data.id))
    .orderBy(desc(leadsTable.createdAt));

  res.json({ ...customer, leads });
});

router.patch("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [customer] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(eq(customersTable.id, params.data.id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  res.json(customer);
});

router.delete("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(customersTable).where(eq(customersTable.id, params.data.id));
  res.sendStatus(204);
});

/* ── Assign rep ──────────────────────────────────────────────────────────── */

router.patch("/customers/:id/assign-rep", requireAuth, async (req, res): Promise<void> => {
  const role = req.user!.role;
  if (role !== "admin" && role !== "superadmin") {
    res.status(403).json({ error: "Admins only" });
    return;
  }

  const { id } = req.params;
  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid customer ID" });
    return;
  }

  const newUserId: unknown = req.body?.userId;
  if (typeof newUserId !== "string" || !isUuid(newUserId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const updated = await db
    .update(leadsTable)
    .set({ userId: newUserId })
    .where(and(eq(leadsTable.customerId, id), eq(leadsTable.isActive, true)))
    .returning({ id: leadsTable.id });

  res.json({ updatedLeads: updated.length });
});

/* ── Account Notes ──────────────────────────────────────────────────────── */

router.get("/customers/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid customer ID" });
    return;
  }

  const notes = await db
    .select({
      id: accountNotesTable.id,
      customerId: accountNotesTable.customerId,
      userId: accountNotesTable.userId,
      body: accountNotesTable.body,
      createdAt: accountNotesTable.createdAt,
      author: {
        id: usersTable.id,
        email: usersTable.email,
        staffId: usersTable.staffId,
      },
    })
    .from(accountNotesTable)
    .leftJoin(usersTable, eq(accountNotesTable.userId, usersTable.id))
    .where(eq(accountNotesTable.customerId, id))
    .orderBy(desc(accountNotesTable.createdAt));

  res.json(notes);
});

router.post("/customers/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const { id } = req.params;
  if (!isUuid(id)) {
    res.status(400).json({ error: "Invalid customer ID" });
    return;
  }

  const body: string = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body) {
    res.status(400).json({ error: "Note body is required" });
    return;
  }
  if (body.length > 5000) {
    res.status(400).json({ error: "Note is too long (max 5000 characters)" });
    return;
  }

  const [note] = await db
    .insert(accountNotesTable)
    .values({ customerId: id, userId: req.user!.userId, body })
    .returning();

  const [full] = await db
    .select({
      id: accountNotesTable.id,
      customerId: accountNotesTable.customerId,
      userId: accountNotesTable.userId,
      body: accountNotesTable.body,
      createdAt: accountNotesTable.createdAt,
      author: {
        id: usersTable.id,
        email: usersTable.email,
        staffId: usersTable.staffId,
      },
    })
    .from(accountNotesTable)
    .leftJoin(usersTable, eq(accountNotesTable.userId, usersTable.id))
    .where(eq(accountNotesTable.id, note.id));

  res.status(201).json(full);
});

router.delete("/customers/:id/notes/:noteId", requireAuth, async (req, res): Promise<void> => {
  const { id, noteId } = req.params;
  if (!isUuid(id) || !isUuid(noteId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [note] = await db
    .select()
    .from(accountNotesTable)
    .where(and(eq(accountNotesTable.id, noteId), eq(accountNotesTable.customerId, id)));

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const role = req.user!.role;
  const isAdmin = role === "admin" || role === "superadmin";
  const isOwner = note.userId === req.user!.userId;

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "You can only delete your own notes" });
    return;
  }

  await db.delete(accountNotesTable).where(eq(accountNotesTable.id, noteId));
  res.sendStatus(204);
});

export default router;
