import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../lib/auth";
import { like } from "drizzle-orm";

const router = Router();

const FLAG_PREFIX = "flag_";

// GET /api/feature-flags — public (auth required), returns { key: boolean }
router.get("/feature-flags", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(like(appSettingsTable.key, `${FLAG_PREFIX}%`));

  const flags: Record<string, boolean> = {};
  for (const row of rows) {
    const key = row.key.slice(FLAG_PREFIX.length);
    flags[key] = row.value !== "false";
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(flags);
});

// PATCH /api/feature-flags — superadmin only
router.patch("/feature-flags", requireSuperAdmin, async (req, res) => {
  const updates = req.body as Record<string, boolean>;
  for (const [key, enabled] of Object.entries(updates)) {
    if (typeof enabled !== "boolean") continue;
    const dbKey = `${FLAG_PREFIX}${key}`;
    await db
      .insert(appSettingsTable)
      .values({ key: dbKey, value: String(enabled) })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: String(enabled) } });
  }
  // Return updated state
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(like(appSettingsTable.key, `${FLAG_PREFIX}%`));

  const flags: Record<string, boolean> = {};
  for (const row of rows) {
    const key = row.key.slice(FLAG_PREFIX.length);
    flags[key] = row.value !== "false";
  }
  res.json(flags);
});

export default router;
