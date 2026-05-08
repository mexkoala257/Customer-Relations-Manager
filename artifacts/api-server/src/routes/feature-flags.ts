import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { requireAuth, requireSuperAdmin } from "../lib/auth";
import { like } from "drizzle-orm";

const router = Router();
const FLAG_PREFIX = "flag_";
const ALL_ROLES = ["admin", "sales", "data-entry"];

export type FlagConfig = {
  roles: string[];
  userOverrides: Record<string, boolean>;
};

function parseConfig(value: string): FlagConfig {
  if (value === "true") return { roles: ALL_ROLES, userOverrides: {} };
  if (value === "false") return { roles: [], userOverrides: {} };
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.roles)) {
      return parsed as FlagConfig;
    }
    return { roles: ALL_ROLES, userOverrides: {} };
  } catch {
    return { roles: ALL_ROLES, userOverrides: {} };
  }
}

function resolveFlag(config: FlagConfig, userId: string, role: string): boolean {
  if (userId in config.userOverrides) return config.userOverrides[userId];
  return config.roles.includes(role);
}

async function getAllConfigs(): Promise<Record<string, FlagConfig>> {
  const rows = await db.select().from(appSettingsTable).where(like(appSettingsTable.key, `${FLAG_PREFIX}%`));
  const configs: Record<string, FlagConfig> = {};
  for (const row of rows) {
    const key = row.key.slice(FLAG_PREFIX.length);
    configs[key] = parseConfig(row.value);
  }
  return configs;
}

async function saveConfig(key: string, config: FlagConfig): Promise<void> {
  const dbKey = `${FLAG_PREFIX}${key}`;
  const value = JSON.stringify(config);
  await db.insert(appSettingsTable)
    .values({ key: dbKey, value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
}

// GET /api/feature-flags — resolved booleans for the current user
router.get("/feature-flags", requireAuth, async (req, res) => {
  const configs = await getAllConfigs();
  const userId = req.user!.userId;
  const role = req.user!.role;

  const flags: Record<string, boolean> = {};
  for (const [key, config] of Object.entries(configs)) {
    flags[key] = resolveFlag(config, userId, role);
  }
  res.setHeader("Cache-Control", "no-store");
  res.json(flags);
});

// GET /api/feature-flags/config — raw config for all flags (superadmin only)
router.get("/feature-flags/config", requireSuperAdmin, async (_req, res) => {
  res.json(await getAllConfigs());
});

// PATCH /api/feature-flags/config — save raw configs (superadmin only)
router.patch("/feature-flags/config", requireSuperAdmin, async (req, res) => {
  const updates = req.body as Record<string, FlagConfig>;
  for (const [key, config] of Object.entries(updates)) {
    await saveConfig(key, config);
  }
  res.json(await getAllConfigs());
});

// PATCH /api/feature-flags — legacy boolean toggle (kept for context compat)
router.patch("/feature-flags", requireSuperAdmin, async (req, res) => {
  const updates = req.body as Record<string, boolean>;
  for (const [key, enabled] of Object.entries(updates)) {
    if (typeof enabled !== "boolean") continue;
    await saveConfig(key, { roles: enabled ? ALL_ROLES : [], userOverrides: {} });
  }
  const configs = await getAllConfigs();
  const userId = req.user!.userId;
  const role = req.user!.role;
  const flags: Record<string, boolean> = {};
  for (const [key, config] of Object.entries(configs)) {
    flags[key] = resolveFlag(config, userId, role);
  }
  res.json(flags);
});

export default router;
