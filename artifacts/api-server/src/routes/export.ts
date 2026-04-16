import { Router } from "express";
import {
  db,
  usersTable,
  customersTable,
  leadsTable,
  appSettingsTable,
  teamMessagesTable,
  teamUpdatesTable,
} from "@workspace/db";
import { requireAdmin, requireSuperAdmin } from "../lib/auth";

const router = Router();

// ── Export ────────────────────────────────────────────────────────────────────

router.get("/admin/export", requireAdmin, async (_req, res): Promise<void> => {
  const [users, customers, leads, settings, teamMessages, teamUpdates] =
    await Promise.all([
      db.select().from(usersTable),
      db.select().from(customersTable),
      db.select().from(leadsTable),
      db.select().from(appSettingsTable),
      db.select().from(teamMessagesTable),
      db.select().from(teamUpdatesTable),
    ]);

  const settingsMap: Record<string, string> = {};
  for (const row of settings) {
    if (row.key === "smtp_pass" || row.key === "logo_url") continue;
    settingsMap[row.key] = row.value;
  }

  const sanitizedUsers = users.map(({ passwordHash: _ph, ...u }) => u);

  const payload = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    tables: {
      users: sanitizedUsers,
      customers,
      leads,
      teamMessages,
      teamUpdates,
      settings: settingsMap,
    },
    counts: {
      users: users.length,
      customers: customers.length,
      leads: leads.length,
      teamMessages: teamMessages.length,
      teamUpdates: teamUpdates.length,
    },
  };

  const filename = `crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.json(payload);
});

// ── Restore ───────────────────────────────────────────────────────────────────

router.post("/admin/restore", requireSuperAdmin, async (req, res): Promise<void> => {
  const body = req.body as {
    version?: string;
    tables?: {
      customers?: any[];
      leads?: any[];
      teamMessages?: any[];
      teamUpdates?: any[];
      settings?: Record<string, string>;
    };
  };

  if (!body?.tables) {
    res.status(400).json({ error: "Invalid backup file: missing tables." });
    return;
  }

  const { customers = [], leads = [], teamMessages = [], teamUpdates = [], settings = {} } = body.tables;

  // Restore in dependency order: leads → customers (delete), then insert customers → leads
  // Delete leads first (they reference customers via FK)
  await db.delete(leadsTable);
  await db.delete(customersTable);
  await db.delete(teamMessagesTable);
  await db.delete(teamUpdatesTable);

  const results = { customers: 0, leads: 0, teamMessages: 0, teamUpdates: 0, settings: 0 };

  // Restore customers (keep original UUIDs so lead references still work)
  if (customers.length > 0) {
    const rows = customers.map((c: any) => ({
      id: c.id,
      companyName: c.companyName ?? c.company_name ?? "",
      contactName: c.contactName ?? c.contact_name ?? "",
      phone: c.phone ?? null,
      streetAddress: c.streetAddress ?? c.street_address ?? null,
      city: c.city ?? null,
      state: c.state ?? null,
      zipCode: c.zipCode ?? c.zip_code ?? null,
      contactRole: c.contactRole ?? c.contact_role ?? null,
      createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
    }));
    for (const row of rows) {
      await db.insert(customersTable).values(row).onConflictDoNothing();
    }
    results.customers = rows.length;
  }

  // Restore leads (keep original UUIDs)
  if (leads.length > 0) {
    for (const l of leads) {
      try {
        await db.insert(leadsTable).values({
          id: l.id,
          customerId: l.customerId ?? l.customer_id,
          userId: l.userId ?? l.user_id,
          notes: l.notes ?? null,
          status: l.status ?? "New",
          isActive: l.isActive ?? l.is_active ?? true,
          followUpDate: l.followUpDate ?? l.follow_up_date ?? null,
          dateKey: l.dateKey ?? l.date_key ?? null,
          metadata: l.metadata ?? null,
          createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
        }).onConflictDoNothing();
        results.leads++;
      } catch {
        // Skip leads whose customer/user references no longer exist
      }
    }
  }

  // Restore team messages (serial IDs — don't preserve)
  if (teamMessages.length > 0) {
    for (const m of teamMessages) {
      try {
        await db.insert(teamMessagesTable).values({
          userId: m.userId ?? m.user_id,
          text: m.text ?? "",
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        });
        results.teamMessages++;
      } catch {
        // Skip if user no longer exists
      }
    }
  }

  if (teamUpdates.length > 0) {
    for (const u of teamUpdates) {
      try {
        await db.insert(teamUpdatesTable).values({
          userId: u.userId ?? u.user_id,
          status: u.status ?? "notice",
          text: u.text ?? "",
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        });
        results.teamUpdates++;
      } catch {
        // Skip if user no longer exists
      }
    }
  }

  // Upsert settings (skip sensitive keys)
  const skipKeys = new Set(["smtp_pass", "logo_url"]);
  for (const [key, value] of Object.entries(settings)) {
    if (skipKeys.has(key) || typeof value !== "string") continue;
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
    results.settings++;
  }

  res.json({ ok: true, restored: results });
});

export default router;
