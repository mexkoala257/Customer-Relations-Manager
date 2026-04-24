import nodemailer from "nodemailer";
import { logger } from "./logger";
import { db, appSettingsTable, emailLogsTable } from "@workspace/db";
import type { ReportSection } from "@workspace/db";

const ACCENT_HEX: Record<string, { bg: string; text: string }> = {
  amber:  { bg: "#f59e0b", text: "#1c1917" },
  blue:   { bg: "#3b82f6", text: "#ffffff" },
  green:  { bg: "#22c55e", text: "#ffffff" },
  purple: { bg: "#a855f7", text: "#ffffff" },
  rose:   { bg: "#f43f5e", text: "#ffffff" },
  teal:   { bg: "#14b8a6", text: "#ffffff" },
};

async function getAllSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(appSettingsTable);
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return map;
  } catch {
    return {};
  }
}

function getEmailBranding(settings: Record<string, string>) {
  const companyName = settings["company_name"] || "SalesCRM";
  const accentKey = settings["accent_color"] || "amber";
  const colors = ACCENT_HEX[accentKey] ?? ACCENT_HEX["amber"];
  return { companyName, accentBg: colors.bg, accentText: colors.text };
}

function emailHeader(companyName: string, accentBg: string, accentText: string, subtitle?: string) {
  return `
    <div style="background:${accentBg};padding:20px 24px;border-radius:8px 8px 0 0">
      <h2 style="color:${accentText};margin:0;font-size:18px;font-weight:700;letter-spacing:-0.3px">${companyName}</h2>
      ${subtitle ? `<p style="color:${accentText};opacity:0.8;margin:4px 0 0;font-size:13px">${subtitle}</p>` : ""}
    </div>`;
}

function emailFooter(companyName: string) {
  return `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:0;padding:12px 24px;border-radius:0 0 8px 8px">
      <p style="margin:0;font-size:12px;color:#9ca3af">Automated message from ${companyName}.</p>
    </div>`;
}

async function createTransporter() {
  const dbSettings = await getAllSettings();

  const host = dbSettings["smtp_host"] || process.env.SMTP_HOST;
  const user = dbSettings["smtp_user"] || process.env.SMTP_USER;
  const pass = dbSettings["smtp_pass"] || process.env.SMTP_PASS;
  const port = Number(dbSettings["smtp_port"] || process.env.SMTP_PORT) || 587;
  const secure = dbSettings["smtp_secure"] === "true";

  if (!host || !user || !pass) {
    logger.warn("SMTP credentials not configured — emails will be logged only");
    return { transporter: null, from: null, settings: dbSettings };
  }

  const fromName = dbSettings["smtp_from_name"] || dbSettings["company_name"] || "SalesCRM";
  const from = `"${fromName}" <${user}>`;

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return { transporter, from, settings: dbSettings };
}

async function deliver(to: string, subject: string, html: string, text: string, type: string): Promise<{ sent: boolean; message: string }> {
  const { transporter, from } = await createTransporter();

  if (!transporter) {
    logger.info({ to, subject }, "Email would be sent (SMTP not configured)");
    try {
      await db.insert(emailLogsTable).values({ type, toEmail: to, subject, status: "skipped" });
    } catch { /* don't block on log failure */ }
    return { sent: false, message: "SMTP not configured, email logged only" };
  }

  try {
    await transporter.sendMail({ from, to, subject, html, text });
    try {
      await db.insert(emailLogsTable).values({ type, toEmail: to, subject, status: "sent" });
    } catch { /* don't block on log failure */ }
    return { sent: true, message: "Email sent successfully" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to, subject, err }, "Failed to send email");
    try {
      await db.insert(emailLogsTable).values({ type, toEmail: to, subject, status: "failed", errorMessage: msg });
    } catch { /* don't block on log failure */ }
    return { sent: false, message: `Email failed: ${msg}` };
  }
}

export async function sendWatcherNotificationEmail(opts: {
  toEmail: string;
  entityType: "lead" | "customer";
  entityName: string;
  changedBy: string;
  changes: Array<{ field: string; from: string; to: string }>;
  entityUrl: string;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const label = opts.entityType === "lead" ? "Lead" : "Customer";
  const subject = `[${label} Update] ${opts.entityName} has been updated`;

  const changeRows = opts.changes.map((c) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:8px 12px;color:#6b7280;font-size:13px;width:160px">${c.field}</td>
      <td style="padding:8px 12px;font-size:13px;color:#9ca3af;text-decoration:line-through">${c.from}</td>
      <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:600">${c.to}</td>
    </tr>`).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      ${emailHeader(companyName, accentBg, accentText, `${label} Updated`)}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 16px">
          <strong>${opts.changedBy}</strong> made changes to the ${label.toLowerCase()} <strong>${opts.entityName}</strong> that you are following.
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr style="background:#f9fafb;text-align:left">
              <th style="padding:8px 12px;font-size:12px;color:#6b7280;font-weight:600">Field</th>
              <th style="padding:8px 12px;font-size:12px;color:#6b7280;font-weight:600">Was</th>
              <th style="padding:8px 12px;font-size:12px;color:#6b7280;font-weight:600">Now</th>
            </tr>
          </thead>
          <tbody>${changeRows}</tbody>
        </table>
        <a href="${opts.entityUrl}" style="display:inline-block;background:${accentBg};color:${accentText};padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">
          View ${label}
        </a>
      </div>
      ${emailFooter(companyName)}
    </div>`;

  const text = `${opts.changedBy} updated ${opts.entityName}:\n\n` +
    opts.changes.map((c) => `• ${c.field}: "${c.from}" → "${c.to}"`).join("\n") +
    `\n\nView at: ${opts.entityUrl}`;

  return deliver(opts.toEmail, subject, html, text, "watcher_notification");
}

export async function sendBugReportEmail(opts: {
  toEmail: string;
  reporterEmail: string;
  title: string;
  description: string;
  severity: string;
  pageUrl: string | null;
  reportId: number;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const severityColors: Record<string, string> = {
    low: "#22c55e",
    medium: "#f59e0b",
    high: "#ef4444",
  };
  const sColor = severityColors[opts.severity] ?? "#f59e0b";

  const subject = `[Bug Report #${opts.reportId}] ${opts.title}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      ${emailHeader(companyName, accentBg, accentText, "Bug Report Submitted")}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 16px">A bug report has been submitted by <strong>${opts.reporterEmail}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
          <tr>
            <td style="padding:8px 0;color:#6b7280;width:120px;vertical-align:top">Report #</td>
            <td style="padding:8px 0;font-weight:600">#${opts.reportId}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;vertical-align:top">Title</td>
            <td style="padding:8px 0;font-weight:600">${opts.title}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;vertical-align:top">Severity</td>
            <td style="padding:8px 0">
              <span style="background:${sColor}20;color:${sColor};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;text-transform:uppercase">${opts.severity}</span>
            </td>
          </tr>
          ${opts.pageUrl ? `<tr>
            <td style="padding:8px 0;color:#6b7280;vertical-align:top">Page</td>
            <td style="padding:8px 0;font-family:monospace;font-size:13px">${opts.pageUrl}</td>
          </tr>` : ""}
        </table>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Description</p>
          <p style="margin:0;white-space:pre-wrap;font-size:14px;line-height:1.6">${opts.description}</p>
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Log in to the admin panel to view and manage bug reports.</p>
      </div>
      ${emailFooter(companyName)}
    </div>`;

  const text = `Bug Report #${opts.reportId}\n\nReported by: ${opts.reporterEmail}\nTitle: ${opts.title}\nSeverity: ${opts.severity}\n${opts.pageUrl ? `Page: ${opts.pageUrl}\n` : ""}\nDescription:\n${opts.description}`;

  return deliver(opts.toEmail, subject, html, text, "bug_report");
}

export async function sendFollowUpEmail(opts: {
  toEmail: string;
  toName: string;
  companyName: string;
  repName: string;
  notes: string | null;
  followUpDate: string | null;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName: brandName, accentBg, accentText } = getEmailBranding(settings);

  const text = `Hi ${opts.toName},\n\nThis is a follow-up from your sales rep ${opts.repName} regarding ${opts.companyName}.\n\n${opts.notes ? `Notes: ${opts.notes}` : ""}${opts.followUpDate ? `\nScheduled Follow-Up Date: ${opts.followUpDate}` : ""}\n\nThank you for your time.`.trim();

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      ${emailHeader(brandName, accentBg, accentText)}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 12px">Hi <strong>${opts.toName}</strong>,</p>
        <p style="margin:0 0 12px">This is a follow-up from your sales rep <strong>${opts.repName}</strong> regarding <strong>${opts.companyName}</strong>.</p>
        ${opts.notes ? `<p style="margin:0 0 12px;color:#374151"><strong>Notes:</strong> ${opts.notes}</p>` : ""}
        ${opts.followUpDate ? `<p style="margin:0 0 12px;color:#374151"><strong>Scheduled Follow-Up:</strong> ${opts.followUpDate}</p>` : ""}
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px">Thank you for your time.</p>
      </div>
      ${emailFooter(brandName)}
    </div>`;

  return deliver(opts.toEmail, `Follow-up: ${opts.companyName}`, html, text, "follow_up");
}

export async function sendFollowUpReminderEmail(opts: {
  toEmail: string;
  repName: string;
  leads: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; notes: string | null }>;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const subject = `${companyName} — You have ${opts.leads.length} follow-up${opts.leads.length === 1 ? "" : "s"} coming up`;

  const rows = opts.leads.map((l) =>
    `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:10px 12px;font-weight:600">${l.companyName}</td>
      <td style="padding:10px 12px">${l.contactName}</td>
      <td style="padding:10px 12px">${l.followUpDate}</td>
      <td style="padding:10px 12px"><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:12px">${l.status}</span></td>
    </tr>`
  ).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
      ${emailHeader(companyName, accentBg, accentText)}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 16px">Hi <strong>${opts.repName}</strong>, you have upcoming follow-ups that need attention:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f9fafb;text-align:left">
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Company</th>
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Contact</th>
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Follow-up Date</th>
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${emailFooter(companyName)}
    </div>`;

  const text = `Hi ${opts.repName},\n\nYou have ${opts.leads.length} upcoming follow-up(s):\n\n` +
    opts.leads.map((l) => `• ${l.companyName} (${l.contactName}) — ${l.followUpDate} [${l.status}]`).join("\n");

  return deliver(opts.toEmail, subject, html, text, "reminder_upcoming");
}

export async function sendPastDueReminderEmail(opts: {
  toEmail: string;
  repName: string;
  leads: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; notes: string | null }>;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const subject = `${companyName} — ${opts.leads.length} overdue follow-up${opts.leads.length === 1 ? "" : "s"} need your attention`;

  const rows = opts.leads.map((l) => {
    const daysAgo = Math.round((Date.now() - new Date(l.followUpDate).getTime()) / 86400000);
    const overdue = daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;
    return `<tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:10px 12px;font-weight:600">${l.companyName}</td>
      <td style="padding:10px 12px">${l.contactName}</td>
      <td style="padding:10px 12px">${l.followUpDate}</td>
      <td style="padding:10px 12px;color:#dc2626;font-weight:600">${overdue}</td>
      <td style="padding:10px 12px"><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:12px">${l.status}</span></td>
    </tr>`;
  }).join("");

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      ${emailHeader(companyName, accentBg, accentText, "Daily Past-Due Alert")}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 8px">Hi <strong>${opts.repName}</strong>,</p>
        <p style="margin:0 0 16px;color:#dc2626;font-weight:600">You have ${opts.leads.length} overdue follow-up${opts.leads.length === 1 ? "" : "s"} that require immediate attention:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#fef2f2;text-align:left">
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Company</th>
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Contact</th>
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Was Due</th>
              <th style="padding:10px 12px;font-weight:600;color:#dc2626">Overdue By</th>
              <th style="padding:10px 12px;font-weight:600;color:#6b7280">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${emailFooter(companyName)}
    </div>`;

  const text = `Hi ${opts.repName},\n\nYou have ${opts.leads.length} overdue follow-up(s):\n\n` +
    opts.leads.map((l) => `• ${l.companyName} (${l.contactName}) — was due ${l.followUpDate} [${l.status}]`).join("\n") +
    `\n\nPlease log in to update these leads.`;

  return deliver(opts.toEmail, subject, html, text, "reminder_past_due");
}

export async function sendSummaryEmail(opts: {
  toEmail: string;
  recipientName: string;
  periodLabel: string;
  sections?: ReportSection[];
  recentLeads: Array<{ companyName: string; contactName: string; status: string; repEmail: string; repName?: string | null; updatedAt: string; notes?: string | null }>;
  upcomingLeads: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; repEmail: string; repName?: string | null; notes?: string | null }>;
  overdueLeads?: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; repEmail: string; repName?: string | null; notes?: string | null }>;
  wonLeads?: Array<{ companyName: string; contactName: string; status: string; repEmail: string; repName?: string | null; updatedAt: string; notes?: string | null }>;
  pipelineCounts?: Array<{ status: string; count: number }>;
  topPerformers?: Array<{ repEmail: string; repName: string; count: number }>;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const subject = `${companyName} — ${opts.periodLabel} Activity Summary`;

  function mkRow(cells: string[]) {
    return `<tr style="border-bottom:1px solid #e5e7eb">${cells.map((c) => `<td style="padding:9px 12px;font-size:13px">${c ?? "—"}</td>`).join("")}</tr>`;
  }

  function firstName(repName: string | null | undefined, repEmail: string): string {
    if (repName && repName.trim()) return repName.trim().split(/\s+/)[0];
    return repEmail.split("@")[0];
  }

  function sectionHeader(title: string, color = "#374151") {
    return `<h3 style="font-size:14px;font-weight:700;color:${color};margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #e5e7eb">${title}</h3>`;
  }

  function tableWrap(headCells: string[], rows: string, bgColor = "#f9fafb") {
    const ths = headCells.map((h) => `<th style="padding:9px 12px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${h}</th>`).join("");
    return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <thead><tr style="background:${bgColor};text-align:left">${ths}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  const isEnabled = (id: string) => {
    if (!opts.sections) return id === "recent_activity" || id === "upcoming_followups";
    const sec = opts.sections.find((s) => s.id === id);
    return sec?.enabled ?? false;
  };

  const getSection = (id: string) => opts.sections?.find((s) => s.id === id);

  const htmlParts: string[] = [];
  const textParts: string[] = [];

  // Pipeline Summary
  if (isEnabled("pipeline_summary") && opts.pipelineCounts?.length) {
    htmlParts.push(sectionHeader("Pipeline Overview", "#1e40af"));
    const rows = opts.pipelineCounts.map((p) =>
      `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:9px 12px;font-size:13px">${p.status}</td>
        <td style="padding:9px 12px;font-size:13px;font-weight:700;text-align:right">${p.count}</td>
      </tr>`
    ).join("");
    htmlParts.push(tableWrap(["Status", "Leads"], rows, "#eff6ff"));
    textParts.push(`Pipeline Overview:\n${opts.pipelineCounts.map((p) => `• ${p.status}: ${p.count}`).join("\n")}`);
  }

  // Recent Activity
  if (isEnabled("recent_activity")) {
    const sec = getSection("recent_activity");
    const daysBack = sec?.daysBack ?? 7;
    htmlParts.push(sectionHeader(`Recent Activity (last ${daysBack} days)`));
    if (opts.recentLeads.length) {
      const rows = opts.recentLeads.map((l) => mkRow([l.companyName, l.contactName, l.status, firstName(l.repName, l.repEmail), l.notes || "—"])).join("");
      htmlParts.push(tableWrap(["Company", "Contact", "Status", "Rep", "Notes"], rows));
    } else {
      htmlParts.push(`<p style="color:#9ca3af;font-size:13px">No recent activity this period.</p>`);
    }
    textParts.push(`Recent Activity:\n${opts.recentLeads.map((l) => `• ${l.companyName} — ${l.status} (${firstName(l.repName, l.repEmail)})${l.notes ? `: ${l.notes}` : ""}`).join("\n") || "None"}`);
  }

  // Upcoming Follow-ups
  if (isEnabled("upcoming_followups")) {
    const sec = getSection("upcoming_followups");
    const daysAhead = sec?.daysAhead ?? 7;
    htmlParts.push(sectionHeader(`Upcoming Follow-ups (next ${daysAhead} days)`, "#065f46"));
    if (opts.upcomingLeads.length) {
      const rows = opts.upcomingLeads.map((l) => mkRow([l.companyName, l.contactName, l.followUpDate, l.status, firstName(l.repName, l.repEmail), l.notes || "—"])).join("");
      htmlParts.push(tableWrap(["Company", "Contact", "Date", "Status", "Rep", "Notes"], rows, "#ecfdf5"));
    } else {
      htmlParts.push(`<p style="color:#9ca3af;font-size:13px">No follow-ups scheduled in the next ${daysAhead} days.</p>`);
    }
    textParts.push(`Upcoming Follow-ups:\n${opts.upcomingLeads.map((l) => `• ${l.companyName} — ${l.followUpDate} (${firstName(l.repName, l.repEmail)})${l.notes ? `: ${l.notes}` : ""}`).join("\n") || "None"}`);
  }

  // Overdue Leads
  if (isEnabled("overdue_leads")) {
    htmlParts.push(sectionHeader("Overdue Follow-ups — Action Required", "#991b1b"));
    const items = opts.overdueLeads ?? [];
    if (items.length) {
      const rows = items.map((l) => mkRow([l.companyName, l.contactName, l.followUpDate, l.status, firstName(l.repName, l.repEmail), l.notes || "—"])).join("");
      htmlParts.push(tableWrap(["Company", "Contact", "Due Date", "Status", "Rep", "Notes"], rows, "#fef2f2"));
    } else {
      htmlParts.push(`<p style="color:#9ca3af;font-size:13px">No overdue follow-ups.</p>`);
    }
    textParts.push(`Overdue Follow-ups:\n${items.map((l) => `• ${l.companyName} — ${l.followUpDate} (${firstName(l.repName, l.repEmail)})${l.notes ? `: ${l.notes}` : ""}`).join("\n") || "None"}`);
  }

  // Won Leads
  if (isEnabled("won_leads")) {
    htmlParts.push(sectionHeader("Won / Closed Deals", "#065f46"));
    const items = opts.wonLeads ?? [];
    if (items.length) {
      const rows = items.map((l) => mkRow([l.companyName, l.contactName, firstName(l.repName, l.repEmail), l.updatedAt, l.notes || "—"])).join("");
      htmlParts.push(tableWrap(["Company", "Contact", "Rep", "Closed", "Notes"], rows, "#ecfdf5"));
    } else {
      htmlParts.push(`<p style="color:#9ca3af;font-size:13px">No won deals this period.</p>`);
    }
    textParts.push(`Won Deals:\n${items.map((l) => `• ${l.companyName} (${firstName(l.repName, l.repEmail)})${l.notes ? `: ${l.notes}` : ""}`).join("\n") || "None"}`);
  }

  // Top Performers
  if (isEnabled("top_performers")) {
    htmlParts.push(sectionHeader("Top Performers", "#5b21b6"));
    const items = opts.topPerformers ?? [];
    if (items.length) {
      const rows = items.map((p, i) =>
        `<tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:9px 12px;font-size:13px;color:#7c3aed;font-weight:700">#${i + 1}</td>
          <td style="padding:9px 12px;font-size:13px">${p.repName}</td>
          <td style="padding:9px 12px;font-size:13px;color:#6b7280">${p.repEmail}</td>
          <td style="padding:9px 12px;font-size:13px;font-weight:700;text-align:right">${p.count}</td>
        </tr>`
      ).join("");
      htmlParts.push(tableWrap(["Rank", "Name", "Email", "Leads"], rows, "#f5f3ff"));
    } else {
      htmlParts.push(`<p style="color:#9ca3af;font-size:13px">No activity data available.</p>`);
    }
    textParts.push(`Top Performers:\n${items.map((p, i) => `#${i + 1} ${p.repName} — ${p.count} leads`).join("\n") || "None"}`);
  }

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      ${emailHeader(companyName, accentBg, accentText, `${opts.periodLabel} Activity Summary`)}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 4px">Hi <strong>${opts.recipientName}</strong>,</p>
        <p style="margin:0 0 20px;color:#6b7280;font-size:13px">Here's your sales activity overview.</p>
        ${htmlParts.join("\n") || `<p style="color:#9ca3af;font-size:13px">No sections configured for this report.</p>`}
      </div>
      ${emailFooter(companyName)}
    </div>`;

  const text = `${companyName} ${opts.periodLabel} Summary for ${opts.recipientName}\n\n` +
    (textParts.join("\n\n") || "No sections configured.");

  return deliver(opts.toEmail, subject, html, text, "summary");
}
