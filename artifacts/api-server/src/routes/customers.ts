import { Router } from "express";
import { db, customersTable, leadsTable, usersTable } from "@workspace/db";
import { eq, ilike, or, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  CreateCustomerBody,
  UpdateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  DeleteCustomerParams,
  ListCustomersQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const qp = ListCustomersQueryParams.safeParse(req.query);
  const search = qp.success ? qp.data.search : undefined;

  let query = db.select().from(customersTable);

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

export default router;
