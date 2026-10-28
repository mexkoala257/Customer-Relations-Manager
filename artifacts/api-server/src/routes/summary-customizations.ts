import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { SaveSummaryCustomizationBody, PreviewSummaryCustomizationBody } from "@workspace/api-zod";
import { db, reminderSettingsTable, DEFAULT_REPORT_SECTIONS } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  listSummaryRecipients, loadSummaryCustomizations, validateCoworkerSelection,
  saveSummaryCoworkers, resetSummaryCoworkers,
} from "../lib/summary-customizations";
import { buildSummaryReportData } from "../lib/scheduler";
import { buildRecipientSummaryOptions } from "../lib/summary-recipient";
import { renderSummaryEmail } from "../lib/mailer";

const router = Router();

router.get("/admin/summary-customizations", requireAdmin, async (_req, res) => {
  const [users, saved] = await Promise.all([listSummaryRecipients(), loadSummaryCustomizations()]);
  const userIds = new Set(users.map((user) => user.id));
  const salesIds = new Set(users.filter((user) => user.role === "sales").map((user) => user.id));
  const configurations = saved
    .filter((configuration) => userIds.has(configuration.recipientId))
    .map((configuration) => ({
      ...configuration,
      coworkerIds: configuration.coworkerIds.filter((id) =>
        id !== configuration.recipientId && salesIds.has(id)),
    }));
  res.json({ users, configurations });
});

router.put("/admin/summary-customizations/:userId", requireAdmin, async (req, res) => {
  const parsed = SaveSummaryCustomizationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide a valid ordered coworker list." });
  const users = await listSummaryRecipients();
  const recipientId = String(req.params.userId);
  if (!users.some((user) => user.id === recipientId)) {
    return res.status(404).json({ error: "Recipient not found." });
  }
  const error = validateCoworkerSelection(recipientId, parsed.data.coworkerIds, users);
  if (error) return res.status(400).json({ error });
  return res.json(await saveSummaryCoworkers(recipientId, parsed.data.coworkerIds));
});

router.delete("/admin/summary-customizations/:userId", requireAdmin, async (req, res) => {
  const recipientId = String(req.params.userId);
  const users = await listSummaryRecipients();
  if (!users.some((user) => user.id === recipientId)) {
    return res.status(404).json({ error: "Recipient not found." });
  }
  await resetSummaryCoworkers(recipientId);
  return res.json({ success: true });
});

router.post("/admin/summary-customizations/:userId/preview", requireAdmin, async (req, res) => {
  const parsed = PreviewSummaryCustomizationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide a valid ordered coworker list." });
  const users = await listSummaryRecipients();
  const recipientId = String(req.params.userId);
  const recipient = users.find((user) => user.id === recipientId);
  if (!recipient) return res.status(404).json({ error: "Recipient not found." });
  const error = validateCoworkerSelection(recipientId, parsed.data.coworkerIds, users);
  if (error) return res.status(400).json({ error });
  const [settings] = await db.select().from(reminderSettingsTable)
    .where(eq(reminderSettingsTable.id, 1)).limit(1);
  const sections = settings?.reportSections ?? DEFAULT_REPORT_SECTIONS;
  const data = await buildSummaryReportData(sections);
  // Render only: no email delivery, snapshot writes, or saved preference changes.
  return res.json(await renderSummaryEmail(buildRecipientSummaryOptions(
    data, recipient, sections, "Preview",
    parsed.data.useDefault ? undefined : parsed.data.coworkerIds,
  )));
});

export default router;
