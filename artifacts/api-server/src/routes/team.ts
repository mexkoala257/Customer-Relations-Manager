import { Router } from "express";
import { db, teamMessagesTable, teamUpdatesTable, teamPhotosTable, teamDocumentsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function canDelete(userId: string, ownerId: string, role: string) {
  return role === "admin" || userId === ownerId;
}

// ── Messages ──────────────────────────────────────────────────────────────────

router.get("/team/messages", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: teamMessagesTable.id,
      text: teamMessagesTable.text,
      createdAt: teamMessagesTable.createdAt,
      userId: teamMessagesTable.userId,
      authorEmail: usersTable.email,
    })
    .from(teamMessagesTable)
    .leftJoin(usersTable, eq(teamMessagesTable.userId, usersTable.id))
    .orderBy(desc(teamMessagesTable.createdAt));
  res.json(rows);
});

router.post("/team/messages", requireAuth, async (req, res): Promise<void> => {
  const { text } = req.body;
  if (!text?.trim()) {
    res.status(400).json({ error: "Text is required" });
    return;
  }
  const [row] = await db
    .insert(teamMessagesTable)
    .values({ userId: req.user!.userId, text: text.trim() })
    .returning();
  res.status(201).json(row);
});

router.delete("/team/messages/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(teamMessagesTable).where(eq(teamMessagesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!canDelete(req.user!.userId, row.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(teamMessagesTable).where(eq(teamMessagesTable.id, id));
  res.sendStatus(204);
});

// ── Updates ───────────────────────────────────────────────────────────────────

router.get("/team/updates", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: teamUpdatesTable.id,
      status: teamUpdatesTable.status,
      text: teamUpdatesTable.text,
      createdAt: teamUpdatesTable.createdAt,
      userId: teamUpdatesTable.userId,
      authorEmail: usersTable.email,
    })
    .from(teamUpdatesTable)
    .leftJoin(usersTable, eq(teamUpdatesTable.userId, usersTable.id))
    .orderBy(desc(teamUpdatesTable.createdAt));
  res.json(rows);
});

router.post("/team/updates", requireAuth, async (req, res): Promise<void> => {
  const { status, text } = req.body;
  if (!text?.trim()) { res.status(400).json({ error: "Text is required" }); return; }
  const validStatuses = ["notice", "urgent", "critical"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  const [row] = await db
    .insert(teamUpdatesTable)
    .values({ userId: req.user!.userId, status: status ?? "notice", text: text.trim() })
    .returning();
  res.status(201).json(row);
});

router.delete("/team/updates/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(teamUpdatesTable).where(eq(teamUpdatesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!canDelete(req.user!.userId, row.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(teamUpdatesTable).where(eq(teamUpdatesTable.id, id));
  res.sendStatus(204);
});

// ── Photos ────────────────────────────────────────────────────────────────────

router.get("/team/photos", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: teamPhotosTable.id,
      caption: teamPhotosTable.caption,
      data: teamPhotosTable.data,
      createdAt: teamPhotosTable.createdAt,
      userId: teamPhotosTable.userId,
      authorEmail: usersTable.email,
    })
    .from(teamPhotosTable)
    .leftJoin(usersTable, eq(teamPhotosTable.userId, usersTable.id))
    .orderBy(desc(teamPhotosTable.createdAt));
  res.json(rows);
});

router.post("/team/photos", requireAuth, async (req, res): Promise<void> => {
  const { data, caption } = req.body;
  if (!data) { res.status(400).json({ error: "Image data is required" }); return; }
  const [row] = await db
    .insert(teamPhotosTable)
    .values({ userId: req.user!.userId, data, caption: caption?.trim() || null })
    .returning({ id: teamPhotosTable.id, caption: teamPhotosTable.caption, createdAt: teamPhotosTable.createdAt, userId: teamPhotosTable.userId });
  res.status(201).json(row);
});

router.delete("/team/photos/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(teamPhotosTable).where(eq(teamPhotosTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!canDelete(req.user!.userId, row.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(teamPhotosTable).where(eq(teamPhotosTable.id, id));
  res.sendStatus(204);
});

// ── Documents ─────────────────────────────────────────────────────────────────

router.get("/team/documents", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: teamDocumentsTable.id,
      name: teamDocumentsTable.name,
      data: teamDocumentsTable.data,
      createdAt: teamDocumentsTable.createdAt,
      userId: teamDocumentsTable.userId,
      authorEmail: usersTable.email,
    })
    .from(teamDocumentsTable)
    .leftJoin(usersTable, eq(teamDocumentsTable.userId, usersTable.id))
    .orderBy(desc(teamDocumentsTable.createdAt));
  res.json(rows);
});

router.post("/team/documents", requireAuth, async (req, res): Promise<void> => {
  const { name, data } = req.body;
  if (!name?.trim() || !data) { res.status(400).json({ error: "Name and data are required" }); return; }
  const [row] = await db
    .insert(teamDocumentsTable)
    .values({ userId: req.user!.userId, name: name.trim(), data })
    .returning({ id: teamDocumentsTable.id, name: teamDocumentsTable.name, createdAt: teamDocumentsTable.createdAt, userId: teamDocumentsTable.userId });
  res.status(201).json(row);
});

router.delete("/team/documents/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(teamDocumentsTable).where(eq(teamDocumentsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!canDelete(req.user!.userId, row.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.delete(teamDocumentsTable).where(eq(teamDocumentsTable.id, id));
  res.sendStatus(204);
});

export default router;
