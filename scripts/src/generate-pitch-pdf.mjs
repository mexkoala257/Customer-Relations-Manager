import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../sales-crm-overview.pdf");

// ── Branding ────────────────────────────────────────────────────────────────
const BRAND = {
  company: "Tri-state Power Solutions",
  appName: "Sales CRM",
  accent: "#22c55e",
  accentDark: "#16a34a",
  dark: "#0f172a",
  mid: "#334155",
  light: "#64748b",
  muted: "#94a3b8",
  bg: "#f8fafc",
  white: "#ffffff",
  border: "#e2e8f0",
  red: "#ef4444",
  amber: "#f59e0b",
};

const W = 612;   // US Letter width (pts)
const H = 792;   // US Letter height (pts)
const ML = 56;   // margin left
const MR = 56;   // margin right
const CW = W - ML - MR; // content width

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function applyColor(doc, hex) {
  doc.fillColor(hex);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawPageHeader(doc, pageNum) {
  if (pageNum === 1) return;
  doc.save();
  doc.rect(0, 0, W, 36).fill(BRAND.dark);
  doc.fontSize(8).fillColor(BRAND.accent).font("Helvetica-Bold")
    .text(BRAND.company.toUpperCase(), ML, 13, { continued: true })
    .fillColor("#94a3b8").font("Helvetica")
    .text(`  ·  ${BRAND.appName}`, { continued: false });
  doc.fontSize(8).fillColor("#475569")
    .text(`Page ${pageNum}`, 0, 13, { align: "right", width: W - MR });
  doc.restore();
}

function drawPageFooter(doc) {
  doc.save();
  doc.rect(0, H - 32, W, 32).fill(BRAND.dark);
  const year = new Date().getFullYear();
  doc.fontSize(8).fillColor("#475569").font("Helvetica")
    .text(`© ${year} ${BRAND.company}  ·  Confidential`, ML, H - 19, { width: CW });
  doc.restore();
}

function sectionHeader(doc, title, y) {
  const [r, g, b] = hexToRgb(BRAND.accent);
  doc.save();
  // accent left bar
  doc.rect(ML, y, 4, 22).fillColor(BRAND.accent).fill();
  doc.fontSize(13).font("Helvetica-Bold").fillColor(BRAND.dark)
    .text(title, ML + 12, y + 4, { width: CW - 12 });
  // underline
  doc.moveTo(ML, y + 26).lineTo(ML + CW, y + 26)
    .strokeColor(BRAND.border).lineWidth(0.5).stroke();
  doc.restore();
  return y + 36;
}

function bulletItem(doc, label, detail, x, y, colW) {
  doc.save();
  doc.circle(x + 4, y + 5, 3).fillColor(BRAND.accent).fill();
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(BRAND.dark)
    .text(label, x + 12, y, { width: colW - 14, continued: !!detail });
  if (detail) {
    doc.font("Helvetica").fillColor(BRAND.mid).text(`  ${detail}`, { width: colW - 14 });
  }
  const h = doc.heightOfString(label + (detail ? `  ${detail}` : ""), { width: colW - 14 });
  doc.restore();
  return Math.max(h, 14) + 6;
}

function featureCard(doc, icon, title, lines, x, y, w, h) {
  doc.save();
  doc.roundedRect(x, y, w, h, 6).fillColor(BRAND.bg).fill();
  doc.roundedRect(x, y, w, h, 6).strokeColor(BRAND.border).lineWidth(0.5).stroke();
  doc.rect(x, y, w, 4).fillColor(BRAND.accent).fill();
  doc.fontSize(16).fillColor(BRAND.accent).font("Helvetica-Bold").text(icon, x + 12, y + 12);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND.dark).text(title, x + 36, y + 14);
  let ly = y + 30;
  for (const line of lines) {
    doc.fontSize(8.5).font("Helvetica").fillColor(BRAND.mid)
      .text(`• ${line}`, x + 12, ly, { width: w - 24 });
    ly += doc.heightOfString(`• ${line}`, { width: w - 24 }) + 3;
  }
  doc.restore();
}

function roleChip(doc, role, color, desc, x, y) {
  const chipW = 90;
  const chipH = 22;
  doc.save();
  doc.roundedRect(x, y, chipW, chipH, 11).fillColor(color).fill();
  doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND.white)
    .text(role, x, y + 6, { width: chipW, align: "center" });
  doc.fontSize(8).font("Helvetica").fillColor(BRAND.light)
    .text(desc, x, y + chipH + 4, { width: chipW + 20 });
  doc.restore();
}

function flowStep(doc, num, title, desc, x, y, w) {
  const bh = 52;
  doc.save();
  doc.roundedRect(x, y, w, bh, 5).fillColor(BRAND.bg).fill();
  doc.roundedRect(x, y, w, bh, 5).strokeColor(BRAND.accent).lineWidth(0.8).stroke();
  doc.circle(x + 22, y + bh / 2, 14).fillColor(BRAND.accent).fill();
  doc.fontSize(12).font("Helvetica-Bold").fillColor(BRAND.white)
    .text(num, x + 22 - 5, y + bh / 2 - 8, { width: 10, align: "center" });
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(BRAND.dark)
    .text(title, x + 44, y + 10, { width: w - 54 });
  doc.fontSize(8).font("Helvetica").fillColor(BRAND.mid)
    .text(desc, x + 44, y + 24, { width: w - 54 });
  doc.restore();
}

function arrowDown(doc, x, y) {
  doc.save();
  doc.moveTo(x, y).lineTo(x, y + 10)
    .strokeColor(BRAND.muted).lineWidth(1).stroke();
  doc.moveTo(x - 4, y + 7).lineTo(x, y + 12).lineTo(x + 4, y + 7)
    .fillColor(BRAND.muted).fill();
  doc.restore();
}

// ── Build PDF ─────────────────────────────────────────────────────────────────

const doc = new PDFDocument({ size: "LETTER", margins: { top: 0, bottom: 0, left: 0, right: 0 }, autoFirstPage: false });
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

// ═══════════════════════════════════════════════════════════════════════
// PAGE 1 — Cover
// ═══════════════════════════════════════════════════════════════════════
doc.addPage();
drawPageFooter(doc);

// dark hero panel
doc.rect(0, 0, W, 420).fill(BRAND.dark);

// decorative circle
doc.circle(W - 60, 80, 180).fillColor("#1e293b").fill();
doc.circle(W - 40, 370, 90).fillColor("#1e293b").fill();

// accent stripe
doc.rect(ML, 100, 5, 60).fillColor(BRAND.accent).fill();

// company name
doc.fontSize(11).font("Helvetica").fillColor(BRAND.accent)
  .text(BRAND.company.toUpperCase(), ML + 18, 102, { characterSpacing: 2 });

// app name
doc.fontSize(48).font("Helvetica-Bold").fillColor(BRAND.white)
  .text("Sales CRM", ML + 16, 128);

// tagline
doc.fontSize(15).font("Helvetica").fillColor("#94a3b8")
  .text("A complete lead management platform built for your team", ML + 16, 205, { width: 380 });

// divider
doc.moveTo(ML + 16, 260).lineTo(ML + 16 + 120, 260)
  .strokeColor(BRAND.accent).lineWidth(2).stroke();

// date & version
const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
doc.fontSize(10).font("Helvetica").fillColor("#64748b")
  .text(`Prepared: ${today}`, ML + 16, 272);
doc.text("Version: 1.0  ·  Confidential", ML + 16, 287);

// key stats strip
const stats = [
  { num: "4", label: "User Roles" },
  { num: "∞", label: "Lead Tracking" },
  { num: "3", label: "Email Types" },
  { num: "100%", label: "Web-Based" },
];
const statW = CW / stats.length;
doc.rect(ML, 340, CW, 68).fillColor("#1e293b").fill();
stats.forEach((s, i) => {
  const sx = ML + i * statW + statW / 2;
  doc.fontSize(22).font("Helvetica-Bold").fillColor(BRAND.accent)
    .text(s.num, sx - 40, 352, { width: 80, align: "center" });
  doc.fontSize(9).font("Helvetica").fillColor("#94a3b8")
    .text(s.label.toUpperCase(), sx - 40, 378, { width: 80, align: "center", characterSpacing: 0.5 });
});

// lower content area
let y = 450;
doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND.dark)
  .text("What's inside this document", ML, y);
y += 20;

const contents = [
  ["System Overview", "What the CRM does and who it's for"],
  ["Core Features", "Lead pipeline, customers, emails, and more"],
  ["User Roles & Permissions", "Superadmin, Admin, Sales, and Data Entry"],
  ["Lead Workflow", "Step-by-step pipeline from entry to close"],
  ["Email & Notifications", "Automated reminders and manual sends"],
  ["Admin Panel", "User management, settings, and backup"],
];
for (const [title, sub] of contents) {
  doc.circle(ML + 4, y + 5, 3).fillColor(BRAND.accent).fill();
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(BRAND.dark)
    .text(title, ML + 12, y, { continued: true })
    .font("Helvetica").fillColor(BRAND.light).text(`  —  ${sub}`);
  y += 20;
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE 2 — Overview & Feature Cards
// ═══════════════════════════════════════════════════════════════════════
doc.addPage();
drawPageHeader(doc, 2);
drawPageFooter(doc);

y = 56;

y = sectionHeader(doc, "System Overview", y);
doc.fontSize(9.5).font("Helvetica").fillColor(BRAND.mid)
  .text(
    `The ${BRAND.company} Sales CRM is a purpose-built, web-based lead management system designed to give your entire sales team a single source of truth. From initial lead entry through follow-up, closure, and reporting — every step of the sales process is tracked, automated, and visible to the right people.`,
    ML, y, { width: CW, lineGap: 4 }
  );
y += 70;

y = sectionHeader(doc, "Core Features at a Glance", y);

const CARDS = [
  {
    icon: "🎯", title: "Lead Pipeline",
    lines: ["Track every prospect from first contact to close", "Visual status pipeline (New → Contacted → Proposal → Won/Lost)", "Follow-up date tracking with overdue alerts", "Assign leads to specific sales reps"],
  },
  {
    icon: "👥", title: "Customer Profiles",
    lines: ["Full contact & company records", "Complete lead history per customer", "Quick entry form for fast data capture", "Searchable customer database"],
  },
  {
    icon: "📧", title: "Email Notifications",
    lines: ["Automated upcoming follow-up reminders", "Daily past-due alerts for overdue leads", "Weekly/Monday activity summary emails", "Branded with your company name & color"],
  },
  {
    icon: "🔐", title: "Access Control",
    lines: ["4 distinct role levels with granular permissions", "JWT-based authentication — no sessions to manage", "Force password change on first login", "Lock/unlock accounts without deleting data"],
  },
  {
    icon: "📊", title: "Dashboard & Reports",
    lines: ["Live status breakdown chart", "Recent activity feed", "Weekly lead goal tracking per rep", "Team performance at a glance"],
  },
  {
    icon: "⚙️", title: "Admin Panel",
    lines: ["Create, edit, and manage all users", "Configure SMTP email settings", "Backup & restore the full database", "Branding customisation (logo, name, color)"],
  },
];

const cardW = (CW - 12) / 2;
const cardH = 110;
CARDS.forEach((card, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const cx = ML + col * (cardW + 12);
  const cy = y + row * (cardH + 10);
  featureCard(doc, card.icon, card.title, card.lines, cx, cy, cardW, cardH);
});
y += Math.ceil(CARDS.length / 2) * (cardH + 10) + 8;

// ═══════════════════════════════════════════════════════════════════════
// PAGE 3 — Roles & Permissions
// ═══════════════════════════════════════════════════════════════════════
doc.addPage();
drawPageHeader(doc, 3);
drawPageFooter(doc);

y = 56;
y = sectionHeader(doc, "User Roles & Permissions", y);

doc.fontSize(9.5).font("Helvetica").fillColor(BRAND.mid)
  .text("Access is controlled through four hierarchical roles. Each role builds on the permissions of the one below it.", ML, y, { width: CW });
y += 30;

// Role chips
const roles = [
  { role: "Superadmin", color: BRAND.accent, desc: "Full system control" },
  { role: "Admin",      color: "#6366f1",    desc: "User & team management" },
  { role: "Sales",      color: "#3b82f6",    desc: "Leads & customers" },
  { role: "Data Entry", color: "#8b5cf6",    desc: "Lead entry only" },
];
roles.forEach((r, i) => {
  roleChip(doc, r.role, r.color, r.desc, ML + i * 140, y);
});
y += 60;

// Permission table
const perms = [
  ["Permission",                    "Data Entry", "Sales", "Admin", "Superadmin"],
  ["View & create leads",           "✓", "✓", "✓", "✓"],
  ["Edit & manage own leads",       "—", "✓", "✓", "✓"],
  ["View all team leads",           "—", "—", "✓", "✓"],
  ["Manage users (create/edit)",    "—", "—", "✓", "✓"],
  ["Lock / unlock accounts",        "—", "—", "✓", "✓"],
  ["Send manual reminder emails",   "—", "—", "✓", "✓"],
  ["Configure email/SMTP settings", "—", "—", "—", "✓"],
  ["Backup & restore database",     "—", "—", "—", "✓"],
  ["Change branding & logo",        "—", "—", "—", "✓"],
  ["Access setup wizard",           "—", "—", "—", "✓"],
];

const colWidths = [200, 70, 70, 70, 80];
const rowH = 20;

perms.forEach((row, ri) => {
  const isHeader = ri === 0;
  const bg = isHeader ? BRAND.dark : (ri % 2 === 0 ? BRAND.bg : BRAND.white);
  doc.rect(ML, y, CW, rowH).fillColor(bg).fill();
  doc.rect(ML, y, CW, rowH).strokeColor(BRAND.border).lineWidth(0.3).stroke();

  let cx = ML;
  row.forEach((cell, ci) => {
    const isCheck = cell === "✓";
    const isDash = cell === "—";
    const color = isHeader ? BRAND.white : (isCheck ? BRAND.accentDark : (isDash ? BRAND.muted : BRAND.dark));
    const font = (isHeader || (!isDash && !isCheck && ci === 0)) ? "Helvetica-Bold" : "Helvetica";
    const align = ci === 0 ? "left" : "center";
    const pad = ci === 0 ? 8 : 0;
    doc.fontSize(ci === 0 ? 8.5 : 9).font(font).fillColor(color)
      .text(cell, cx + pad, y + 5, { width: colWidths[ci] - pad, align });
    cx += colWidths[ci];
  });
  y += rowH;
});

y += 24;
y = sectionHeader(doc, "Security & Account Safety", y);

const secItems = [
  ["JWT Authentication", "Stateless token-based login — no cookies, no session storage."],
  ["Bcrypt Password Hashing", "All passwords are salted and hashed — never stored in plain text."],
  ["Force Password Change", "New accounts are forced to set a unique password on first login."],
  ["Account Locking", "Admins can lock an account immediately, blocking all future logins."],
  ["Role-based Route Guards", "Every API route enforces the minimum required role server-side."],
  ["Audit Trail", "All lead and customer changes are timestamped for accountability."],
];

const scol1W = CW / 2 - 10;
secItems.forEach((item, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const sx = ML + col * (scol1W + 20);
  const sy = y + row * 32;
  bulletItem(doc, item[0], item[1], sx, sy, scol1W);
});

// ═══════════════════════════════════════════════════════════════════════
// PAGE 4 — Lead Workflow
// ═══════════════════════════════════════════════════════════════════════
doc.addPage();
drawPageHeader(doc, 4);
drawPageFooter(doc);

y = 56;
y = sectionHeader(doc, "Lead Pipeline Workflow", y);

doc.fontSize(9.5).font("Helvetica").fillColor(BRAND.mid)
  .text("Every lead follows a clear path from initial capture through to a closed outcome. The system tracks each transition automatically.", ML, y, { width: CW });
y += 28;

const steps = [
  { num: "1", title: "Lead Entry", desc: "Sales rep or data entry staff creates a new lead — company, contact name, phone, email, source, and notes." },
  { num: "2", title: "Status Assignment", desc: "Lead is tagged with an initial status: New, Contacted, Proposal Sent, or Negotiation." },
  { num: "3", title: "Follow-up Scheduling", desc: "Rep sets a follow-up date. The system will automatically send reminders as the date approaches." },
  { num: "4", title: "Ongoing Follow-up", desc: "Rep works the lead, updating notes, status, and follow-up dates as conversations progress." },
  { num: "5", title: "Overdue Alerts", desc: "If a follow-up date passes without update, the rep receives a daily past-due email alert." },
  { num: "6", title: "Closure", desc: "Lead is marked Won or Lost. Customer record is preserved for future opportunities." },
];

const stepW = (CW - 20) / 2;
steps.forEach((step, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const sx = ML + col * (stepW + 20);
  const sy = y + row * 70;
  flowStep(doc, step.num, step.title, step.desc, sx, sy, stepW);
  if (col === 1 && row < Math.floor((steps.length - 1) / 2)) {
    arrowDown(doc, ML + stepW / 2, sy + 52);
    arrowDown(doc, ML + stepW + 20 + stepW / 2, sy + 52);
  }
});

y += Math.ceil(steps.length / 2) * 70 + 20;

y = sectionHeader(doc, "Lead Status Reference", y);

const statuses = [
  { status: "New",           color: "#3b82f6", desc: "Lead has been entered but not yet contacted." },
  { status: "Contacted",     color: "#8b5cf6", desc: "Initial outreach has been made." },
  { status: "Proposal Sent", color: BRAND.accent, desc: "A quote or proposal has been delivered." },
  { status: "Negotiation",   color: "#f59e0b", desc: "Active discussion on terms and pricing." },
  { status: "Won",           color: "#22c55e", desc: "Deal closed successfully." },
  { status: "Lost",          color: "#ef4444", desc: "Opportunity did not convert." },
  { status: "On Hold",       color: "#94a3b8", desc: "Paused pending external factors." },
];

statuses.forEach((s, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const sx = ML + col * (CW / 2);
  const sy = y + row * 24;
  const chipW = 88;
  doc.roundedRect(sx, sy, chipW, 16).fillColor(s.color).fill();
  doc.fontSize(8).font("Helvetica-Bold").fillColor(BRAND.white)
    .text(s.status, sx, sy + 3, { width: chipW, align: "center" });
  doc.fontSize(8.5).font("Helvetica").fillColor(BRAND.mid)
    .text(s.desc, sx + chipW + 8, sy + 3, { width: CW / 2 - chipW - 16 });
});

// ═══════════════════════════════════════════════════════════════════════
// PAGE 5 — Email System & Admin Panel
// ═══════════════════════════════════════════════════════════════════════
doc.addPage();
drawPageHeader(doc, 5);
drawPageFooter(doc);

y = 56;
y = sectionHeader(doc, "Email & Notification System", y);

doc.fontSize(9.5).font("Helvetica").fillColor(BRAND.mid)
  .text("The CRM has a fully branded, automated email system that keeps reps on top of their pipeline without manual effort.", ML, y, { width: CW });
y += 24;

const emailTypes = [
  {
    icon: "📅",
    name: "Follow-up Reminder",
    trigger: "Automatic — sent when a lead's follow-up date is approaching (configurable: 1, 3, 7 days before)",
    who: "Individual sales rep assigned to the lead",
    content: "List of upcoming leads with company, contact, date, and status",
    manual: "Admins can send on-demand from the Manage Users panel",
  },
  {
    icon: "🔴",
    name: "Past-Due Alert",
    trigger: "Automatic — runs daily, fires when a follow-up date has passed without update",
    who: "Sales rep responsible for each overdue lead",
    content: "List of all overdue leads with 'days overdue' counter",
    manual: "Admins can send on-demand per user at any time",
  },
  {
    icon: "📊",
    name: "Activity Summary",
    trigger: "Automatic — sent Monday morning and Friday morning to all users",
    who: "All users (each person receives the full team view)",
    content: "Recent lead activity from the past 7 days + upcoming follow-ups in the next 7 days",
    manual: "Admins can send on-demand to any individual user",
  },
];

emailTypes.forEach((et) => {
  doc.roundedRect(ML, y, CW, 82, 6).fillColor(BRAND.bg).fill();
  doc.roundedRect(ML, y, CW, 82, 6).strokeColor(BRAND.border).lineWidth(0.5).stroke();
  doc.rect(ML, y, 4, 82).fillColor(BRAND.accent).fill();
  doc.fontSize(14).fillColor(BRAND.accent).text(et.icon, ML + 10, y + 8);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND.dark).text(et.name, ML + 30, y + 9);
  const rows = [
    ["Trigger", et.trigger],
    ["Recipient", et.who],
    ["Content", et.content],
    ["Manual Send", et.manual],
  ];
  let ry = y + 26;
  rows.forEach(([label, val]) => {
    doc.fontSize(8).font("Helvetica-Bold").fillColor(BRAND.light).text(label + ":", ML + 14, ry, { continued: true, width: 58 });
    doc.font("Helvetica").fillColor(BRAND.mid).text("  " + val, { width: CW - 80 });
    ry += 13;
  });
  y += 92;
});

doc.fontSize(8.5).font("Helvetica").fillColor(BRAND.light)
  .text("All emails use your configured company name and accent colour in the header and subject line. SMTP settings are configured through the Admin Panel.", ML, y, { width: CW });
y += 30;

y = sectionHeader(doc, "Admin Panel Capabilities", y);

const adminCaps = [
  ["Manage Users",         "Create, edit, lock/unlock, reset passwords, and delete users from a single table."],
  ["User Roles",           "Change any user's role inline — changes take effect on their next request."],
  ["Email Configuration",  "Enter SMTP host, port, credentials, and sender name. Test with a live send."],
  ["Reminder Settings",    "Toggle automatic reminders on/off, configure days-before thresholds."],
  ["Manual Email Sends",   "Trigger a follow-up reminder, past-due alert, or activity summary to any user."],
  ["Branding Editor",      "Set company name, upload logo, and choose accent colour. All emails update instantly."],
  ["Database Backup",      "Download a full JSON backup of all data. Restore from any previous backup file."],
  ["Setup Wizard",         "Guided initial configuration covering SMTP, branding, and first user creation."],
  ["Team Messages",        "Internal message board for team-wide announcements and notes."],
];

const acol = CW / 2 - 10;
adminCaps.forEach((cap, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const ax = ML + col * (acol + 20);
  const ay = y + row * 30;
  bulletItem(doc, cap[0], cap[1], ax, ay, acol);
});

// ═══════════════════════════════════════════════════════════════════════
// PAGE 6 — Getting Started & Summary
// ═══════════════════════════════════════════════════════════════════════
doc.addPage();
drawPageHeader(doc, 6);
drawPageFooter(doc);

y = 56;
y = sectionHeader(doc, "Getting Started", y);

const gettingStarted = [
  { num: "1", title: "Run the Setup Wizard", desc: "On first login as Superadmin, the setup wizard guides you through SMTP configuration, company branding, and creating your first admin account. Takes under 5 minutes." },
  { num: "2", title: "Create Your Team", desc: "Use the Manage Users panel to add sales reps and data entry staff. Set their roles, staff IDs, and weekly lead goals. They receive login details and are prompted to set their own password." },
  { num: "3", title: "Start Entering Leads", desc: "Use the Quick Entry form or the full Customer New page to start building your pipeline. Assign leads to reps and set follow-up dates immediately." },
  { num: "4", title: "Activate Email Reminders", desc: "In the Admin Panel → Email & Reminders, enable automatic follow-up reminders and past-due alerts. Configure how many days before a due date to send the reminder." },
  { num: "5", title: "Monitor the Dashboard", desc: "The dashboard shows a live pipeline breakdown, recent activity, and each rep's progress toward their weekly goal. Check it daily for a quick team health snapshot." },
];

gettingStarted.forEach((step, i) => {
  doc.roundedRect(ML, y, CW, 58, 5).fillColor(BRAND.bg).fill();
  doc.roundedRect(ML, y, CW, 58, 5).strokeColor(BRAND.border).lineWidth(0.5).stroke();
  doc.circle(ML + 22, y + 29, 16).fillColor(BRAND.accentDark).fill();
  doc.fontSize(13).font("Helvetica-Bold").fillColor(BRAND.white)
    .text(step.num, ML + 15, y + 21, { width: 14, align: "center" });
  doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND.dark).text(step.title, ML + 46, y + 8, { width: CW - 56 });
  doc.fontSize(8.5).font("Helvetica").fillColor(BRAND.mid).text(step.desc, ML + 46, y + 24, { width: CW - 56 });
  y += 66;
});

y += 10;
y = sectionHeader(doc, "Summary", y);

// Summary box
doc.roundedRect(ML, y, CW, 120, 8).fillColor(BRAND.dark).fill();
doc.fontSize(12).font("Helvetica-Bold").fillColor(BRAND.accent)
  .text(`${BRAND.company} Sales CRM`, ML + 24, y + 18, { width: CW - 48, align: "center" });
doc.fontSize(9).font("Helvetica").fillColor("#94a3b8")
  .text(
    `A complete, self-hosted sales pipeline platform designed specifically for your team.\nNo per-seat fees. No data leaving your server. Full control from day one.`,
    ML + 24, y + 38, { width: CW - 48, align: "center", lineGap: 4 }
  );

const bullets = ["Lead tracking & pipeline management", "Automated email reminders & alerts", "Role-based access for your whole team", "Admin panel with full user management"];
const bx = ML + 40;
let by = y + 76;
bullets.forEach((b, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const bsx = bx + col * 240;
  const bsy = by + row * 18;
  doc.circle(bsx + 4, bsy + 5, 3).fillColor(BRAND.accent).fill();
  doc.fontSize(8.5).font("Helvetica").fillColor("#cbd5e1").text(b, bsx + 12, bsy, { width: 210 });
});

doc.end();

stream.on("finish", () => {
  console.log(`PDF written to: ${OUT}`);
});
stream.on("error", (err) => {
  console.error("Stream error:", err);
  process.exit(1);
});
