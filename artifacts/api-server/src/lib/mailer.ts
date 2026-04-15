import nodemailer from "nodemailer";
import { logger } from "./logger";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn("SMTP credentials not configured — emails will be logged only");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user, pass },
  });
}

async function deliver(to: string, subject: string, html: string, text: string): Promise<{ sent: boolean; message: string }> {
  const transporter = createTransporter();
  if (!transporter) {
    logger.info({ to, subject }, "Email would be sent (SMTP not configured)");
    return { sent: false, message: "SMTP not configured, email logged only" };
  }
  await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html, text });
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
  const text = `Hi ${opts.toName},\n\nThis is a follow-up from your sales rep ${opts.repName} regarding ${opts.companyName}.\n\n${opts.notes ? `Notes: ${opts.notes}` : ""}${opts.followUpDate ? `\nScheduled Follow-Up Date: ${opts.followUpDate}` : ""}\n\nThank you for your time.`.trim();
  return deliver(opts.toEmail, `Follow-up: ${opts.companyName}`, `<p>${text.replace(/\n/g, "<br>")}</p>`, text);
}

export async function sendFollowUpReminderEmail(opts: {
  toEmail: string;
  repName: string;
  leads: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; notes: string | null }>;
}): Promise<{ sent: boolean; message: string }> {
  const subject = `SalesCRM — You have ${opts.leads.length} follow-up${opts.leads.length === 1 ? "" : "s"} coming up`;

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
      <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#f59e0b;margin:0;font-size:18px">⚡ SalesCRM</h2>
      </div>
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
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:0;padding:12px 24px;border-radius:0 0 8px 8px">
        <p style="margin:0;font-size:12px;color:#9ca3af">This is an automated reminder from SalesCRM.</p>
      </div>
    </div>`;

  const text = `Hi ${opts.repName},\n\nYou have ${opts.leads.length} upcoming follow-up(s):\n\n` +
    opts.leads.map((l) => `• ${l.companyName} (${l.contactName}) — ${l.followUpDate} [${l.status}]`).join("\n");

  return deliver(opts.toEmail, subject, html, text);
}

export async function sendSummaryEmail(opts: {
  toEmail: string;
  recipientName: string;
  periodLabel: string;
  recentLeads: Array<{ companyName: string; contactName: string; status: string; repEmail: string; updatedAt: string }>;
  upcomingLeads: Array<{ companyName: string; contactName: string; followUpDate: string; status: string; repEmail: string }>;
}): Promise<{ sent: boolean; message: string }> {
  const subject = `SalesCRM — ${opts.periodLabel} Activity Summary`;

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
      <div style="background:#0f172a;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#f59e0b;margin:0;font-size:18px">⚡ SalesCRM</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">${opts.periodLabel} Activity Summary</p>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;padding:24px">
        <p style="margin:0 0 4px">Hi <strong>${opts.recipientName}</strong>,</p>
        <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Here's your sales activity overview.</p>
        ${recentSection}
        ${upcomingSection}
      </div>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:0;padding:12px 24px;border-radius:0 0 8px 8px">
        <p style="margin:0;font-size:12px;color:#9ca3af">Automated ${opts.periodLabel.toLowerCase()} summary from SalesCRM.</p>
      </div>
    </div>`;

  const text = `SalesCRM ${opts.periodLabel} Summary for ${opts.recipientName}\n\n` +
    `Recent Activity:\n${opts.recentLeads.map((l) => `• ${l.companyName} — ${l.status} (${l.repEmail})`).join("\n") || "None"}\n\n` +
    `Upcoming Follow-ups:\n${opts.upcomingLeads.map((l) => `• ${l.companyName} — ${l.followUpDate} (${l.repEmail})`).join("\n") || "None"}`;

  return deliver(opts.toEmail, subject, html, text);
}
