import nodemailer from "nodemailer";
import { logger } from "./logger";
import { db, appSettingsTable } from "@workspace/db";

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

async function deliver(to: string, subject: string, html: string, text: string): Promise<{ sent: boolean; message: string }> {
  const { transporter, from } = await createTransporter();
  if (!transporter) {
    logger.info({ to, subject }, "Email would be sent (SMTP not configured)");
    return { sent: false, message: "SMTP not configured, email logged only" };
  }
  await transporter.sendMail({ from, to, subject, html, text });
  return { sent: true, message: "Email sent successfully" };
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

  return deliver(opts.toEmail, `Follow-up: ${opts.companyName}`, html, text);
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

  return deliver(opts.toEmail, subject, html, text);
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

  return deliver(opts.toEmail, subject, html, text);
}

export async function sendSummaryEmail(opts: {
  toEmail: string;
  recipientName: string;
  periodLabel: string;
  recentLeads: Array<{ companyName: string; contactName: string; status: string; repEmail: string; updatedAt: string }>;
  upcomingLeads: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; repEmail: string }>;
}): Promise<{ sent: boolean; message: string }> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const subject = `${companyName} — ${opts.periodLabel} Activity Summary`;

  function mkRow(cells: string[]) {
    return `<tr style="border-bottom:1px solid #e5e7eb">${cells.map((c) => `<td style="padding:9px 12px;font-size:13px">${c}</td>`).join("")}</tr>`;
  }

  const recentSection = opts.recentLeads.length
    ? `<h3 style="font-size:14px;color:#374151;margin:20px 0 8px">Recent Activity</h3>
       <table style="width:100%;border-collapse:collapse">
         <thead><tr style="background:#f9fafb;text-align:left">
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Company</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Contact</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Status</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Rep</th>
         </thead><tbody>
         ${opts.recentLeads.map((l) => mkRow([l.companyName, l.contactName, l.status, l.repEmail])).join("")}
         </tbody></table>`
    : `<p style="color:#9ca3af;font-size:13px">No recent activity this period.</p>`;

  const upcomingSection = opts.upcomingLeads.length
    ? `<h3 style="font-size:14px;color:#374151;margin:20px 0 8px">Upcoming Follow-ups (next 7 days)</h3>
       <table style="width:100%;border-collapse:collapse">
         <thead><tr style="background:#f9fafb;text-align:left">
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Company</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Contact</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Date</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Status</th>
           <th style="padding:9px 12px;font-size:12px;color:#6b7280">Rep</th>
         </thead><tbody>
         ${opts.upcomingLeads.map((l) => mkRow([l.companyName, l.contactName, l.followUpDate, l.status, l.repEmail])).join("")}
         </tbody></table>`
    : `<p style="color:#9ca3af;font-size:13px">No follow-ups scheduled in the next 7 days.</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      ${emailHeader(companyName, accentBg, accentText, `${opts.periodLabel} Activity Summary`)}
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 4px">Hi <strong>${opts.recipientName}</strong>,</p>
        <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Here's your sales activity overview.</p>
        ${recentSection}
        ${upcomingSection}
      </div>
      ${emailFooter(companyName)}
    </div>`;

  const text = `${companyName} ${opts.periodLabel} Summary for ${opts.recipientName}\n\n` +
    `Recent Activity:\n${opts.recentLeads.map((l) => `• ${l.companyName} — ${l.status} (${l.repEmail})`).join("\n") || "None"}\n\n` +
    `Upcoming Follow-ups:\n${opts.upcomingLeads.map((l) => `• ${l.companyName} — ${l.followUpDate} (${l.repEmail})`).join("\n") || "None"}`;

  return deliver(opts.toEmail, subject, html, text);
}
