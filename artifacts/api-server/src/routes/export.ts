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
import { requireAdmin } from "../lib/auth";

const router = Router();

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

export default router;
