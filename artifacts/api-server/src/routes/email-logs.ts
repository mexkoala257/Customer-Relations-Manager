import { Router } from "express";
import { db, emailLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

router.get("/admin/email-logs", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(emailLogsTable)
    .orderBy(desc(emailLogsTable.sentAt))
    .limit(500);

  res.json(logs);
});

export default router;
