import path from "path";
import fs from "fs";
import { Router } from "express";
import multer from "multer";
import { db, teamMessagesTable, teamUpdatesTable, teamPhotosTable, teamDocumentsTable, teamVideosTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

function canDelete(userId: string, ownerId: string, role: string) {
  return role === "admin" || role === "superadmin" || userId === ownerId;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date as string);
  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Video upload setup ─────────────────────────────────────────────────────────

const VIDEOS_DIR = path.join(process.cwd(), "uploads", "videos");
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEOS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) cb(null, true);
    else cb(new Error("Only video files are allowed"));
  },
});

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
  res.json(rows.map((r) => ({ ...r, createdAt: formatDate(r.createdAt) })));
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
  res.json(rows.map((r) => ({ ...r, createdAt: formatDate(r.createdAt) })));
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

// ── Videos ────────────────────────────────────────────────────────────────────

router.get("/team/videos", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: teamVideosTable.id,
      title: teamVideosTable.title,
      originalName: teamVideosTable.originalName,
      createdAt: teamVideosTable.createdAt,
      userId: teamVideosTable.userId,
      authorEmail: usersTable.email,
    })
    .from(teamVideosTable)
    .leftJoin(usersTable, eq(teamVideosTable.userId, usersTable.id))
    .orderBy(desc(teamVideosTable.createdAt));
  res.json(rows);
});

router.post("/team/videos", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "Video file is required" }); return; }
  const title = req.body.title?.trim() || req.file.originalname.replace(/\.[^.]+$/, "");
  const [row] = await db
    .insert(teamVideosTable)
    .values({
      userId: req.user!.userId,
      title,
      filename: req.file.filename,
      originalName: req.file.originalname,
    })
    .returning({ id: teamVideosTable.id, title: teamVideosTable.title, originalName: teamVideosTable.originalName, createdAt: teamVideosTable.createdAt, userId: teamVideosTable.userId });
  res.status(201).json(row);
});

router.get("/team/videos/:id/stream", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(teamVideosTable).where(eq(teamVideosTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const filePath = path.join(VIDEOS_DIR, row.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

router.get("/team/videos/:id/player", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db
    .select({ id: teamVideosTable.id, title: teamVideosTable.title })
    .from(teamVideosTable)
    .where(eq(teamVideosTable.id, id));
  if (!row) { res.status(404).send("Video not found"); return; }

  const streamUrl = `/api/team/videos/${id}/stream`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(row.title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    video { width: 100%; height: 100vh; display: block; object-fit: contain; background: #000; }
    .title-bar {
      position: fixed; top: 0; left: 0; right: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
      padding: 16px 24px;
      font-family: system-ui, sans-serif;
      color: #fff;
      font-size: 1.1rem;
      font-weight: 600;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
    }
    body:hover .title-bar { opacity: 1; }
  </style>
</head>
<body>
  <div class="title-bar">${escapeHtml(row.title)}</div>
  <video
    id="v"
    autoplay
    controls
    loop
    playsinline
  >
    <source src="${streamUrl}" type="video/mp4" />
    Your browser does not support video playback.
  </video>
  <script>
    const v = document.getElementById('v');
    v.addEventListener('click', () => {
      if (!document.fullscreenElement) v.requestFullscreen().catch(() => {});
    });
    v.addEventListener('canplay', () => { v.play().catch(() => {}); });
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.delete("/team/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(teamVideosTable).where(eq(teamVideosTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (!canDelete(req.user!.userId, row.userId, req.user!.role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const filePath = path.join(VIDEOS_DIR, row.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await db.delete(teamVideosTable).where(eq(teamVideosTable.id, id));
  res.sendStatus(204);
});

function escapeHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default router;
