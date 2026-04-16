import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "../lib/auth";

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

function settingsResponse(settings: Record<string, string>) {
  return {
    companyName: settings.company_name,
    accentColor: settings.accent_color,
    logoUrl: settings.logo_url || "",
  };
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getAllSettings();
  res.setHeader("Cache-Control", "no-store");
  res.json(settingsResponse(settings));
});

router.patch("/settings", requireSuperAdmin, async (req, res): Promise<void> => {
  const { companyName, accentColor, logoUrl } = req.body;

  const updates: { key: string; value: string }[] = [];
  if (typeof companyName === "string" && companyName.trim()) {
    updates.push({ key: "company_name", value: companyName.trim() });
  }
  if (typeof accentColor === "string") {
    updates.push({ key: "accent_color", value: accentColor });
  }
  if (typeof logoUrl === "string") {
    updates.push({ key: "logo_url", value: logoUrl });
  }

  for (const { key, value } of updates) {
    await db
      .insert(appSettingsTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  }

  const settings = await getAllSettings();
  res.json(settingsResponse(settings));
});

export default router;
