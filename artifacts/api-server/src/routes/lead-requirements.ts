import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

const SETTING_KEY = "lead_requirements";

export type LeadFieldConfig = { required: boolean; minChars?: number };
export type LeadRequirementsConfig = {
  contactDate: LeadFieldConfig;
  followUpDate: LeadFieldConfig;
  currentSupplier: LeadFieldConfig;
  temperature: LeadFieldConfig;
  productsDiscussed: LeadFieldConfig;
  notes: LeadFieldConfig;
};

const DEFAULTS: LeadRequirementsConfig = {
  contactDate:       { required: false },
  followUpDate:      { required: true },
  currentSupplier:   { required: false },
  temperature:       { required: false },
  productsDiscussed: { required: false },
  notes:             { required: false, minChars: 0 },
};

async function getConfig(): Promise<LeadRequirementsConfig> {
  const row = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, SETTING_KEY))
    .then((r) => r[0]);
  if (!row) return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(row.value) } as LeadRequirementsConfig; }
  catch { return DEFAULTS; }
}

// GET /api/lead-requirements
router.get("/lead-requirements", requireAuth, async (_req, res) => {
  res.json(await getConfig());
});

// PATCH /api/lead-requirements
router.patch("/lead-requirements", requireAuth, requireAdmin, async (req, res) => {
  const config: LeadRequirementsConfig = { ...DEFAULTS, ...req.body };
  const value = JSON.stringify(config);
  await db
    .insert(appSettingsTable)
    .values({ key: SETTING_KEY, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  res.json(config);
});

export default router;
