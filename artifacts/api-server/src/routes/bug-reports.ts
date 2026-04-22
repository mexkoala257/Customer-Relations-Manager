import { Router } from "express";
import { db, bugReportsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { sendBugReportEmail } from "../lib/mailer";

const router = Router();

// ── Submit a bug report (any authenticated user) ──────────────────────────────

router.post("/bug-reports", requireAuth, async (req, res): Promise<void> => {
  const { title, description, severity, pageUrl } = req.body;

  if (!title?.trim()) { res.status(400).json({ error: "Title is required" }); return; }
  if (!description?.trim()) { res.status(400).json({ error: "Description is required" }); return; }

  const validSeverities = ["low", "medium", "high"];
  const sev = validSeverities.includes(severity) ? severity : "medium";

  const [row] = await db
    .insert(bugReportsTable)
    .values({
      userId: req.user!.userId,
      title: title.trim(),
      description: description.trim(),
      severity: sev,
      pageUrl: pageUrl?.trim() || null,
    })
    .returning();

  // Find superadmin email to notify
  try {
    const [superadmin] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.role, "superadmin"))
      .limit(1);

    const [reporter] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.userId))
      .limit(1);

    if (superadmin?.email) {
      await sendBugReportEmail({
        toEmail: superadmin.email,
        reporterEmail: reporter?.email ?? req.user!.userId,
        title: row.title,
        description: row.description,
        severity: row.severity,
        pageUrl: row.pageUrl,
        reportId: row.id,
      });
    }
  } catch {
    // Email failure should not block the report submission
  }

  res.status(201).json(row);
});

// ── List all bug reports (admin only) ─────────────────────────────────────────

router.get("/bug-reports", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: bugReportsTable.id,
      title: bugReportsTable.title,
      description: bugReportsTable.description,
      severity: bugReportsTable.severity,
      pageUrl: bugReportsTable.pageUrl,
      status: bugReportsTable.status,
      createdAt: bugReportsTable.createdAt,
      userId: bugReportsTable.userId,
      reporterEmail: usersTable.email,
    })
    .from(bugReportsTable)
    .leftJoin(usersTable, eq(bugReportsTable.userId, usersTable.id))
    .orderBy(desc(bugReportsTable.createdAt));
  res.json(rows);
});

// ── Update status (admin only) ────────────────────────────────────────────────

router.patch("/bug-reports/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const validStatuses = ["open", "in_progress", "resolved"];
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const [row] = await db
    .update(bugReportsTable)
    .set({ status })
    .where(eq(bugReportsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

// ── Delete (admin only) ───────────────────────────────────────────────────────

router.delete("/bug-reports/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(bugReportsTable).where(eq(bugReportsTable.id, id));
  res.sendStatus(204);
});

export default router;
