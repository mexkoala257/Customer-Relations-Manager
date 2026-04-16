import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

const DEFAULTS: Record<string, string> = {
  company_name: "SalesCRM",
  accent_color: "amber",
};

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettingsTable);
  const map: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getAllSettings();
  res.json({
    companyName: settings.company_name,
    accentColor: settings.accent_color,
  });
});

router.patch("/settings", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const { companyName, accentColor } = req.body;

  const updates: { key: string; value: string }[] = [];
  if (typeof companyName === "string" && companyName.trim()) {
    updates.push({ key: "company_name", value: companyName.trim() });
  }
  if (typeof accentColor === "string") {
    updates.push({ key: "accent_color", value: accentColor });
  }

  for (const { key, value } of updates) {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  }

  const settings = await getAllSettings();
  res.json({
    companyName: settings.company_name,
    accentColor: settings.accent_color,
  });
});

export default router;
