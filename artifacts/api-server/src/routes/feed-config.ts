import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../lib/auth";

const router = Router();

export type FeedField = { key: string; label: string; enabled: boolean };
export type FeedConfig = { fields: FeedField[]; sortOrder: "asc" | "desc" };

const FEED_DEFAULTS: Record<string, FeedConfig> = {
  messages: {
    sortOrder: "desc",
    fields: [
      { key: "author",      label: "Author Name",   enabled: true },
      { key: "authorEmail", label: "Author Email",   enabled: false },
      { key: "text",        label: "Message Text",   enabled: true },
      { key: "createdAt",   label: "Date / Time",    enabled: true },
      { key: "id",          label: "Record ID",      enabled: false },
      { key: "userId",      label: "User ID",        enabled: false },
    ],
  },
  updates: {
    sortOrder: "desc",
    fields: [
      { key: "author",      label: "Author Name",   enabled: true },
      { key: "authorEmail", label: "Author Email",   enabled: false },
      { key: "status",      label: "Priority",       enabled: true },
      { key: "text",        label: "Update Text",    enabled: true },
      { key: "createdAt",   label: "Date / Time",    enabled: true },
      { key: "id",          label: "Record ID",      enabled: false },
      { key: "userId",      label: "User ID",        enabled: false },
    ],
  },
};

function settingKey(feed: string) { return `feed_config_${feed}`; }

export async function getFeedConfig(feed: string): Promise<FeedConfig> {
  const row = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, settingKey(feed)))
    .then((r) => r[0]);
  if (!row) return FEED_DEFAULTS[feed] ?? { sortOrder: "desc", fields: [] };
  try { return JSON.parse(row.value) as FeedConfig; } catch { return FEED_DEFAULTS[feed] ?? { sortOrder: "desc", fields: [] }; }
}

// GET /api/feed-config/:feed
router.get("/feed-config/:feed", requireAuth, async (req, res) => {
  const { feed } = req.params;
  if (!FEED_DEFAULTS[feed]) { res.status(404).json({ error: "Unknown feed" }); return; }
  res.json(await getFeedConfig(feed));
});

// PATCH /api/feed-config/:feed
router.patch("/feed-config/:feed", requireSuperAdmin, async (req, res) => {
  const { feed } = req.params;
  if (!FEED_DEFAULTS[feed]) { res.status(404).json({ error: "Unknown feed" }); return; }
  const config: FeedConfig = req.body;
  const value = JSON.stringify(config);
  await db
    .insert(appSettingsTable)
    .values({ key: settingKey(feed), value })
    .onConflictDoUpdate({ target: appSettingsTable.key, set: { value } });
  res.json(config);
});

export default router;
