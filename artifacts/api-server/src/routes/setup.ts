import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { db, usersTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "../lib/auth";

const router = Router();

async function superadminExists(): Promise<boolean> {
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "superadmin"))
    .limit(1);
  return rows.length > 0;
}

router.get("/setup/status", async (_req, res): Promise<void> => {
  const needed = !(await superadminExists());
  res.json({ needed });
});

router.post("/setup", async (req, res): Promise<void> => {
  if (await superadminExists()) {
    res.status(403).json({ error: "Setup has already been completed." });
    return;
  }

  const { superadmin, branding, smtp, extraUsers } = req.body as {
    superadmin: { email: string; password: string };
    branding: { companyName: string; accentColor: string; logoUrl?: string };
    smtp: { host: string; port: number; user: string; pass: string; fromName: string; secure: boolean };
    extraUsers?: Array<{ email: string; password: string; role: string }>;
  };

  if (!superadmin?.email || !superadmin?.password) {
    res.status(400).json({ error: "Superadmin email and password are required." });
    return;
  }
  if (superadmin.password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const hash = await bcrypt.hash(superadmin.password, 10);
  await db.insert(usersTable).values({
    email: superadmin.email.trim().toLowerCase(),
    passwordHash: hash,
    staffId: 0,
    role: "superadmin",
  });

  if (extraUsers && Array.isArray(extraUsers)) {
    let staffId = 1;
    for (const u of extraUsers) {
      if (!u.email || !u.password) continue;
      const h = await bcrypt.hash(u.password, 10);
      await db.insert(usersTable).values({
        email: u.email.trim().toLowerCase(),
        passwordHash: h,
        staffId: staffId++,
        role: (u.role === "admin" || u.role === "sales") ? u.role : "sales",
      }).onConflictDoNothing();
    }
  }

  const settingRows: { key: string; value: string }[] = [
    { key: "company_name", value: (branding?.companyName || "SalesCRM").trim() },
    { key: "accent_color", value: branding?.accentColor || "amber" },
    { key: "logo_url", value: branding?.logoUrl ?? "" },
  ];

  if (smtp?.host) {
    settingRows.push({ key: "smtp_host", value: smtp.host.trim() });
    settingRows.push({ key: "smtp_port", value: String(smtp.port || 587) });
    settingRows.push({ key: "smtp_user", value: smtp.user.trim() });
    settingRows.push({ key: "smtp_pass", value: smtp.pass });
    settingRows.push({ key: "smtp_from_name", value: (smtp.fromName || branding?.companyName || "SalesCRM").trim() });
    settingRows.push({ key: "smtp_secure", value: smtp.secure ? "true" : "false" });
  }

  settingRows.push({ key: "setup_complete", value: "true" });

  for (const row of settingRows) {
    await db
      .insert(appSettingsTable)
      .values(row)
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: row.value } });
  }

  res.json({ ok: true, message: "Setup complete. You can now log in." });
});

router.post("/setup/reconfigure", requireSuperAdmin, async (req, res): Promise<void> => {
  const { branding, smtp, extraUsers } = req.body as {
    branding: { companyName: string; accentColor: string; logoUrl?: string };
    smtp?: { host: string; port: number; user: string; pass: string; fromName: string; secure: boolean };
    extraUsers?: Array<{ email: string; password: string; role: string }>;
  };

  const settingRows: { key: string; value: string }[] = [];

  if (branding?.companyName?.trim()) {
    settingRows.push({ key: "company_name", value: branding.companyName.trim() });
    settingRows.push({ key: "accent_color", value: branding.accentColor || "amber" });
    settingRows.push({ key: "logo_url", value: branding.logoUrl ?? "" });
  }

  if (smtp?.host) {
    settingRows.push({ key: "smtp_host", value: smtp.host.trim() });
    settingRows.push({ key: "smtp_port", value: String(smtp.port || 587) });
    settingRows.push({ key: "smtp_user", value: smtp.user.trim() });
    settingRows.push({ key: "smtp_pass", value: smtp.pass });
    settingRows.push({ key: "smtp_from_name", value: (smtp.fromName || branding?.companyName || "SalesCRM").trim() });
    settingRows.push({ key: "smtp_secure", value: smtp.secure ? "true" : "false" });
  }

  for (const row of settingRows) {
    await db
      .insert(appSettingsTable)
      .values(row)
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: row.value } });
  }

  if (extraUsers && Array.isArray(extraUsers)) {
    const existing = await db.select({ email: usersTable.email }).from(usersTable);
    const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
    let staffId = existing.length + 1;
    for (const u of extraUsers) {
      if (!u.email || !u.password) continue;
      const normalized = u.email.trim().toLowerCase();
      if (existingEmails.has(normalized)) continue;
      const h = await bcrypt.hash(u.password, 10);
      await db.insert(usersTable).values({
        email: normalized,
        passwordHash: h,
        staffId: staffId++,
        role: (u.role === "admin" || u.role === "sales") ? u.role : "sales",
      }).onConflictDoNothing();
    }
  }

  res.json({ ok: true, message: "Configuration updated." });
});

router.post("/setup/test-email", async (req, res): Promise<void> => {
  const { host, port, user, pass, secure, toEmail } = req.body as {
    host: string; port: number; user: string; pass: string; secure: boolean; toEmail: string;
  };

  if (!host || !user || !pass || !toEmail) {
    res.status(400).json({ error: "host, user, pass, and toEmail are required." });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: !!secure,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"Setup Test" <${user}>`,
      to: toEmail,
      subject: "SalesCRM — SMTP Test",
      text: "Your email configuration is working correctly.",
    });
    res.json({ ok: true, message: "Test email sent successfully." });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to send test email." });
  }
});

export default router;
