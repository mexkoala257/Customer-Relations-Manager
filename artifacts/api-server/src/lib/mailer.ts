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

export async function sendFollowUpEmail(opts: {
  toEmail: string;
  toName: string;
  companyName: string;
  repName: string;
  notes: string | null;
  followUpDate: string | null;
}): Promise<{ sent: boolean; message: string }> {
  const transporter = createTransporter();

  const body = `
Hi ${opts.toName},

This is a follow-up from your sales rep ${opts.repName} regarding ${opts.companyName}.

${opts.notes ? `Notes: ${opts.notes}` : ""}
${opts.followUpDate ? `Scheduled Follow-Up Date: ${opts.followUpDate}` : ""}

Thank you for your time.
  `.trim();

  if (!transporter) {
    logger.info({ to: opts.toEmail, subject: "Sales Follow-Up" }, "Email would be sent (SMTP not configured)");
    return { sent: false, message: "SMTP not configured, email logged only" };
  }

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: opts.toEmail,
    subject: `Follow-up: ${opts.companyName}`,
    text: body,
  });

  return { sent: true, message: "Email sent successfully" };
}
