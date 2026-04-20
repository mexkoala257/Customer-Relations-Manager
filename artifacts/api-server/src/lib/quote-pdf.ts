import PDFDocument from "pdfkit";
import { getAllSettings, getEmailBranding } from "./mailer";

export interface QuotePdfData {
  quoteId: string;
  title: string;
  status: string;
  notes: string | null;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  createdAt: Date;
  customer: {
    companyName: string;
    contactName: string;
    phone: string | null;
    streetAddress: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  rep: {
    email: string;
    fullName: string | null;
  };
  items: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    total: string;
  }>;
}

function fmt(n: string | number) {
  return `$${Number(n).toFixed(2)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function isSupportedImageBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  return isPng || isJpeg;
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | null> {
  try {
    let buf: Buffer;
    if (logoUrl.startsWith("data:")) {
      const mime = logoUrl.split(";")[0].split(":")[1] ?? "";
      if (!mime.includes("png") && !mime.includes("jpeg") && !mime.includes("jpg")) return null;
      const base64 = logoUrl.split(",")[1];
      if (!base64) return null;
      buf = Buffer.from(base64, "base64");
    } else {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    }
    return isSupportedImageBuffer(buf) ? buf : null;
  } catch {
    return null;
  }
}

export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  const settings = await getAllSettings();
  const { companyName, accentBg, accentText } = getEmailBranding(settings);

  const logoUrl: string = settings["logo_url"] ?? "";
  const logoBuffer = logoUrl ? await fetchLogoBuffer(logoUrl) : null;

  const darkBg = "#0f172a";
  const mid = "#334155";
  const light = "#64748b";
  const border = "#e2e8f0";
  const bgLight = "#f8fafc";

  const W = 612;
  const ML = 48;
  const MR = 48;
  const CW = W - ML - MR;

  const LOGO_SIZE = 44;
  const LOGO_GAP = 12;
  const textX = logoBuffer ? ML + LOGO_SIZE + LOGO_GAP : ML;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.addPage();

    // ── Header bar ─────────────────────────────────────────────────────
    doc.rect(0, 0, W, 72).fill(darkBg);

    // Logo (if available) — white rounded-square background so any colour logo looks clean
    let logoRendered = false;
    if (logoBuffer) {
      try {
        doc.roundedRect(ML, 14, LOGO_SIZE, LOGO_SIZE, 6).fill("#ffffff");
        doc.image(logoBuffer, ML + 4, 18, { width: LOGO_SIZE - 8, height: LOGO_SIZE - 8, fit: [LOGO_SIZE - 8, LOGO_SIZE - 8] });
        logoRendered = true;
      } catch {
        // Unsupported image format — skip logo, fall back to text-only header
      }
    }
    const effectiveTextX = logoRendered ? textX : ML;

    doc.fontSize(20).font("Helvetica-Bold").fillColor(accentBg)
      .text(companyName, effectiveTextX, 18);
    doc.fontSize(9).font("Helvetica").fillColor("#94a3b8")
      .text("SALES QUOTATION", effectiveTextX, 43, { characterSpacing: 2 });

    // Quote number / date block
    const qDate = data.createdAt instanceof Date
      ? data.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date(data.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#94a3b8")
      .text("QUOTE #", W - MR - 130, 18, { width: 130, align: "right" });
    doc.fontSize(10).font("Helvetica-Bold").fillColor(accentBg)
      .text(data.quoteId.slice(0, 8).toUpperCase(), W - MR - 130, 30, { width: 130, align: "right" });
    doc.fontSize(8).font("Helvetica").fillColor("#94a3b8")
      .text(qDate, W - MR - 130, 46, { width: 130, align: "right" });

    // ── Title ──────────────────────────────────────────────────────────
    let y = 90;
    doc.fontSize(15).font("Helvetica-Bold").fillColor(darkBg)
      .text(data.title, ML, y, { width: CW });
    y += 24;

    // Status chip
    const statusColor: Record<string, string> = {
      draft: "#94a3b8", sent: accentBg, accepted: "#22c55e", declined: "#ef4444",
    };
    const sc = statusColor[data.status] ?? "#94a3b8";
    const chipW = 64;
    doc.roundedRect(ML, y, chipW, 18, 9).fill(sc);
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff")
      .text(data.status.toUpperCase(), ML, y + 4, { width: chipW, align: "center" });
    y += 30;

    // ── Bill-to / From columns ────────────────────────────────────────
    const colW = CW / 2 - 12;

    // Bill To
    doc.roundedRect(ML, y, colW, 100, 5).fill(bgLight);
    doc.rect(ML, y, 3, 100).fill(accentBg);
    doc.fontSize(8).font("Helvetica-Bold").fillColor(light)
      .text("BILL TO", ML + 10, y + 10, { characterSpacing: 1 });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(darkBg)
      .text(data.customer.companyName, ML + 10, y + 24);
    doc.fontSize(9).font("Helvetica").fillColor(mid)
      .text(data.customer.contactName, ML + 10, y + 40);
    if (data.customer.phone) {
      doc.text(data.customer.phone, ML + 10, y + 54);
    }
    const addrParts = [
      data.customer.streetAddress,
      [data.customer.city, data.customer.state, data.customer.zipCode].filter(Boolean).join(", "),
    ].filter(Boolean).join("\n");
    if (addrParts) {
      doc.text(addrParts, ML + 10, y + (data.customer.phone ? 68 : 54), { width: colW - 20 });
    }

    // Prepared By
    const col2X = ML + colW + 24;
    doc.roundedRect(col2X, y, colW, 100, 5).fill(bgLight);
    doc.rect(col2X, y, 3, 100).fill(accentBg);
    doc.fontSize(8).font("Helvetica-Bold").fillColor(light)
      .text("PREPARED BY", col2X + 10, y + 10, { characterSpacing: 1 });
    doc.fontSize(11).font("Helvetica-Bold").fillColor(darkBg)
      .text(data.rep.fullName ?? data.rep.email.split("@")[0], col2X + 10, y + 24);
    doc.fontSize(9).font("Helvetica").fillColor(mid)
      .text(data.rep.email, col2X + 10, y + 40);

    y += 116;

    // ── Line items table ──────────────────────────────────────────────
    const cols = [
      { label: "DESCRIPTION",  w: CW * 0.5,  align: "left"  },
      { label: "QTY",          w: CW * 0.1,  align: "right" },
      { label: "UNIT PRICE",   w: CW * 0.2,  align: "right" },
      { label: "TOTAL",        w: CW * 0.2,  align: "right" },
    ] as const;

    // Table header
    doc.rect(ML, y, CW, 24).fill(darkBg);
    let cx = ML;
    for (const col of cols) {
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#94a3b8")
        .text(col.label, cx + 6, y + 7, { width: col.w - 12, align: col.align, characterSpacing: 0.5 });
      cx += col.w;
    }
    y += 24;

    // Rows
    data.items.forEach((item, idx) => {
      const rowH = 24;
      doc.rect(ML, y, CW, rowH).fill(idx % 2 === 0 ? "#ffffff" : bgLight);
      cx = ML;
      const cells = [item.description, item.quantity, fmt(item.unitPrice), fmt(item.total)];
      cells.forEach((cell, ci) => {
        doc.fontSize(9).font("Helvetica").fillColor(darkBg)
          .text(cell, cx + 6, y + 7, { width: cols[ci].w - 12, align: cols[ci].align });
        cx += cols[ci].w;
      });
      y += rowH;
    });

    // Table bottom border
    doc.moveTo(ML, y).lineTo(ML + CW, y).strokeColor(border).lineWidth(0.5).stroke();
    y += 16;

    // ── Totals block ─────────────────────────────────────────────────
    const totalW = 200;
    const totalX = ML + CW - totalW;

    function totalRow(label: string, value: string, bold = false, highlight = false) {
      const rh = 22;
      if (highlight) {
        doc.rect(totalX - 8, y, totalW + 8, rh).fill(accentBg);
        doc.fontSize(10).font("Helvetica-Bold").fillColor(accentText)
          .text(label, totalX, y + 5, { width: 100 })
          .text(value, totalX + 100, y + 5, { width: totalW - 100, align: "right" });
      } else {
        doc.fontSize(9).font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(bold ? darkBg : mid)
          .text(label, totalX, y + 4, { width: 100 })
          .text(value, totalX + 100, y + 4, { width: totalW - 100, align: "right" });
      }
      y += rh;
    }

    totalRow("Subtotal", fmt(data.subtotal));
    totalRow(`Tax (${Number(data.taxRate).toFixed(1)}%)`, fmt(data.taxAmount));
    totalRow("TOTAL DUE", fmt(data.total), true, true);

    y += 20;

    // ── Notes ────────────────────────────────────────────────────────
    if (data.notes) {
      doc.roundedRect(ML, y, CW, 60, 5).fill(bgLight);
      doc.rect(ML, y, 3, 60).fill(accentBg);
      doc.fontSize(8).font("Helvetica-Bold").fillColor(light)
        .text("NOTES", ML + 10, y + 8, { characterSpacing: 1 });
      doc.fontSize(9).font("Helvetica").fillColor(mid)
        .text(data.notes, ML + 10, y + 22, { width: CW - 20, lineGap: 2 });
      y += 72;
    }

    // ── Footer ───────────────────────────────────────────────────────
    const footerY = 792 - 40;
    doc.rect(0, footerY, W, 40).fill(darkBg);
    doc.fontSize(8).font("Helvetica").fillColor("#475569")
      .text(
        `${companyName}  ·  This quotation is valid for 30 days from the date of issue.`,
        ML, footerY + 14, { width: CW }
      );

    doc.end();
  });
}
