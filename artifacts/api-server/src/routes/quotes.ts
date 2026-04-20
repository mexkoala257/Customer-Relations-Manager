import { Router } from "express";
import {
  db, quotesTable, quoteItemsTable, customersTable, usersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { generateQuotePdf } from "../lib/quote-pdf";
import { createTransporter } from "../lib/mailer";
import { logger } from "../lib/logger";

const router = Router();

function calcTotals(items: Array<{ quantity: string; unitPrice: string }>, taxRate: string) {
  const subtotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0);
  const taxAmount = subtotal * (Number(taxRate) / 100);
  const total = subtotal + taxAmount;
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
  };
}

async function getQuoteWithItems(id: string) {
  const [quote] = await db
    .select({
      id: quotesTable.id,
      title: quotesTable.title,
      status: quotesTable.status,
      notes: quotesTable.notes,
      taxRate: quotesTable.taxRate,
      subtotal: quotesTable.subtotal,
      taxAmount: quotesTable.taxAmount,
      total: quotesTable.total,
      sentAt: quotesTable.sentAt,
      createdAt: quotesTable.createdAt,
      updatedAt: quotesTable.updatedAt,
      customerId: quotesTable.customerId,
      userId: quotesTable.userId,
      customerCompanyName: customersTable.companyName,
      customerContactName: customersTable.contactName,
      customerPhone: customersTable.phone,
      customerStreetAddress: customersTable.streetAddress,
      customerCity: customersTable.city,
      customerState: customersTable.state,
      customerZipCode: customersTable.zipCode,
      repEmail: usersTable.email,
      repFullName: usersTable.fullName,
    })
    .from(quotesTable)
    .innerJoin(customersTable, eq(quotesTable.customerId, customersTable.id))
    .innerJoin(usersTable, eq(quotesTable.userId, usersTable.id))
    .where(eq(quotesTable.id, id));
  if (!quote) return null;

  const items = await db
    .select()
    .from(quoteItemsTable)
    .where(eq(quoteItemsTable.quoteId, id))
    .orderBy(quoteItemsTable.sortOrder);

  return { ...quote, items };
}

router.get("/quotes", requireAuth, async (req, res) => {
  const isAdmin = req.user!.role === "admin" || req.user!.role === "superadmin";
  const rows = await db
    .select({
      id: quotesTable.id,
      title: quotesTable.title,
      status: quotesTable.status,
      total: quotesTable.total,
      sentAt: quotesTable.sentAt,
      createdAt: quotesTable.createdAt,
      customerId: quotesTable.customerId,
      userId: quotesTable.userId,
      customerCompanyName: customersTable.companyName,
      repEmail: usersTable.email,
    })
    .from(quotesTable)
    .innerJoin(customersTable, eq(quotesTable.customerId, customersTable.id))
    .innerJoin(usersTable, eq(quotesTable.userId, usersTable.id))
    .where(isAdmin ? undefined : eq(quotesTable.userId, req.user!.userId))
    .orderBy(desc(quotesTable.createdAt));
  res.json(rows);
});

router.get("/quotes/customer/:customerId", requireAuth, async (req, res) => {
  const rows = await db
    .select({
      id: quotesTable.id,
      title: quotesTable.title,
      status: quotesTable.status,
      total: quotesTable.total,
      sentAt: quotesTable.sentAt,
      createdAt: quotesTable.createdAt,
      userId: quotesTable.userId,
      repEmail: usersTable.email,
    })
    .from(quotesTable)
    .innerJoin(usersTable, eq(quotesTable.userId, usersTable.id))
    .where(eq(quotesTable.customerId, req.params.customerId))
    .orderBy(desc(quotesTable.createdAt));
  res.json(rows);
});

router.get("/quotes/:id", requireAuth, async (req, res) => {
  const quote = await getQuoteWithItems(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  return res.json(quote);
});

router.post("/quotes", requireAuth, async (req, res) => {
  const { customerId, title, notes, taxRate = "0", items = [] } = req.body;
  if (!customerId || !title) {
    return res.status(400).json({ error: "customerId and title are required" });
  }

  const totals = calcTotals(items, taxRate);

  const [quote] = await db
    .insert(quotesTable)
    .values({
      customerId,
      userId: req.user!.userId,
      title,
      notes: notes ?? null,
      taxRate: String(taxRate),
      ...totals,
    })
    .returning();

  if (items.length > 0) {
    await db.insert(quoteItemsTable).values(
      items.map((item: { productId?: string; description: string; quantity: string | number; unitPrice: string | number }, idx: number) => ({
        quoteId: quote.id,
        productId: item.productId ?? null,
        description: item.description,
        quantity: String(item.quantity ?? 1),
        unitPrice: String(item.unitPrice ?? 0),
        total: (Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0)).toFixed(2),
        sortOrder: idx,
      }))
    );
  }

  const full = await getQuoteWithItems(quote.id);
  return res.status(201).json(full);
});

router.put("/quotes/:id", requireAuth, async (req, res) => {
  const { title, notes, taxRate, status, items } = req.body;

  const existing = await db.select().from(quotesTable).where(eq(quotesTable.id, req.params.id)).limit(1);
  if (!existing.length) return res.status(404).json({ error: "Quote not found" });

  const effectiveTaxRate = taxRate !== undefined ? String(taxRate) : existing[0].taxRate;

  if (items !== undefined) {
    await db.delete(quoteItemsTable).where(eq(quoteItemsTable.quoteId, req.params.id));
    if (items.length > 0) {
      await db.insert(quoteItemsTable).values(
        items.map((item: { productId?: string; description: string; quantity: string | number; unitPrice: string | number }, idx: number) => ({
          quoteId: req.params.id,
          productId: item.productId ?? null,
          description: item.description,
          quantity: String(item.quantity ?? 1),
          unitPrice: String(item.unitPrice ?? 0),
          total: (Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0)).toFixed(2),
          sortOrder: idx,
        }))
      );
    }
  }

  const currentItems = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, req.params.id));
  const totals = calcTotals(currentItems.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })), effectiveTaxRate);

  const [updated] = await db
    .update(quotesTable)
    .set({
      ...(title !== undefined && { title }),
      ...(notes !== undefined && { notes }),
      ...(status !== undefined && { status }),
      taxRate: effectiveTaxRate,
      ...totals,
      updatedAt: new Date(),
    })
    .where(eq(quotesTable.id, req.params.id))
    .returning();

  const full = await getQuoteWithItems(updated.id);
  return res.json(full);
});

router.delete("/quotes/:id", requireAuth, async (req, res) => {
  await db.delete(quotesTable).where(eq(quotesTable.id, req.params.id));
  return res.json({ message: "Quote deleted" });
});

router.post("/quotes/:id/email", requireAuth, async (req, res) => {
  const quote = await getQuoteWithItems(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });

  const toEmail = req.body.toEmail ?? quote.repEmail;
  const ccEmail = req.body.ccEmail ?? null;

  try {
    const pdfBuffer = await generateQuotePdf({
      quoteId: quote.id,
      title: quote.title,
      status: quote.status,
      notes: quote.notes,
      taxRate: quote.taxRate,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      total: quote.total,
      createdAt: quote.createdAt,
      customer: {
        companyName: quote.customerCompanyName,
        contactName: quote.customerContactName,
        phone: quote.customerPhone,
        streetAddress: quote.customerStreetAddress,
        city: quote.customerCity,
        state: quote.customerState,
        zipCode: quote.customerZipCode,
      },
      rep: {
        email: quote.repEmail,
        fullName: quote.repFullName,
      },
      items: quote.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
    });

    const { transporter, from } = await createTransporter();
    if (!transporter) {
      return res.json({ sent: false, message: "SMTP not configured — PDF generated but not emailed" });
    }

    const filename = `Quote-${quote.id.slice(0, 8).toUpperCase()}.pdf`;
    await transporter.sendMail({
      from,
      to: toEmail,
      ...(ccEmail ? { cc: ccEmail } : {}),
      subject: `Quote: ${quote.title} — ${quote.customerCompanyName}`,
      text: `Please find attached the quote "${quote.title}" for ${quote.customerCompanyName}.\n\nTotal: $${Number(quote.total).toFixed(2)}`,
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });

    await db.update(quotesTable)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotesTable.id, quote.id));

    logger.info({ quoteId: quote.id, toEmail }, "Quote PDF emailed");
    return res.json({ sent: true, message: `Quote emailed to ${toEmail}` });
  } catch (err) {
    logger.error({ err }, "Failed to generate/send quote PDF");
    return res.status(500).json({ error: "Failed to generate or send quote" });
  }
});

export default router;
