import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../lib/auth";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, partsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

interface ExtractedPart {
  partNumber: string;
  description: string | null;
  retailPrice: string | null;
  xstorePrice: string | null;
  tier1Price: string | null;
  categoryGuess: string | null;
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text as string;
}

async function parsePartsFromText(text: string): Promise<ExtractedPart[]> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are a data extraction assistant. You will receive raw text extracted from an Interstate Batteries price sheet PDF.
Extract ALL part numbers and their prices into a JSON array. The price sheet has 3 price tiers: Retail, Xstore, and Tier 1 (sometimes labeled T1 or Tier1 or similar).
Return ONLY a valid JSON array with no markdown, no explanation.
Each object must have:
- partNumber: string (the battery part number, uppercase)
- retailPrice: string or null (numeric string like "89.99")
- xstorePrice: string or null
- tier1Price: string or null
- categoryGuess: string or null (e.g. "Automotive", "Marine", "AGM", "Deep Cycle", "Commercial" — your best guess from context)
If a price is missing or unclear, use null. Do not invent prices. If you cannot extract valid rows, return [].`,
      },
      {
        role: "user",
        content: `Extract all parts from this price sheet text:\n\n${text.slice(0, 28000)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "[]";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as ExtractedPart[];
  } catch {
    return [];
  }
}

async function enrichDescriptions(parts: ExtractedPart[]): Promise<ExtractedPart[]> {
  if (parts.length === 0) return parts;

  const partNumbers = parts.map((p) => p.partNumber).join(", ");
  const response = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: `You are a battery product expert specializing in Interstate Batteries. Given a list of Interstate Battery part numbers, provide a short description for each one based on your product knowledge (type, voltage, CCA, group size, etc.). Return ONLY a valid JSON object mapping partNumber → description string. If you don't know a part number, use null. No markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Provide descriptions for these Interstate Battery part numbers: ${partNumbers}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const map = JSON.parse(cleaned) as Record<string, string | null>;
    return parts.map((p) => ({
      ...p,
      description: map[p.partNumber] ?? p.description ?? null,
    }));
  } catch {
    return parts;
  }
}

// Full import — extract, enrich descriptions, return preview
router.post(
  "/parts/import/extract",
  requireAdmin,
  upload.single("pdf"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });
    try {
      const text = await extractTextFromPdf(req.file.buffer);
      if (!text.trim()) return res.status(422).json({ error: "Could not extract text from PDF" });

      const parts = await parsePartsFromText(text);
      if (parts.length === 0) {
        return res.status(422).json({ error: "No parts could be extracted from the PDF" });
      }

      const enriched = await enrichDescriptions(parts);
      return res.json({ parts: enriched, pageCount: text.length });
    } catch (err) {
      console.error("Import extract error:", err);
      return res.status(500).json({ error: "Failed to process PDF" });
    }
  }
);

// Price update — extract prices only, diff against existing catalog
router.post(
  "/parts/import/price-update",
  requireAdmin,
  upload.single("pdf"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });
    try {
      const text = await extractTextFromPdf(req.file.buffer);
      if (!text.trim()) return res.status(422).json({ error: "Could not extract text from PDF" });

      const parts = await parsePartsFromText(text);
      if (parts.length === 0) {
        return res.status(422).json({ error: "No parts could be extracted from the PDF" });
      }

      // Match against existing catalog
      const existingParts = await db.select().from(partsTable);
      const existingMap = new Map(existingParts.map((p) => [p.partNumber.toUpperCase(), p]));

      const matched: {
        id: number;
        partNumber: string;
        description: string | null;
        currentRetail: string | null;
        currentXstore: string | null;
        currentTier1: string | null;
        newRetail: string | null;
        newXstore: string | null;
        newTier1: string | null;
        hasChanges: boolean;
      }[] = [];

      const newParts: ExtractedPart[] = [];

      for (const p of parts) {
        const existing = existingMap.get(p.partNumber.toUpperCase());
        if (existing) {
          const hasChanges =
            p.retailPrice !== (existing.retailPrice ?? null) ||
            p.xstorePrice !== (existing.xstorePrice ?? null) ||
            p.tier1Price !== (existing.tier1Price ?? null);
          matched.push({
            id: existing.id,
            partNumber: existing.partNumber,
            description: existing.description,
            currentRetail: existing.retailPrice,
            currentXstore: existing.xstorePrice,
            currentTier1: existing.tier1Price,
            newRetail: p.retailPrice,
            newXstore: p.xstorePrice,
            newTier1: p.tier1Price,
            hasChanges,
          });
        } else {
          newParts.push(p);
        }
      }

      // Find parts in DB not in the new PDF
      const newPdfNumbers = new Set(parts.map((p) => p.partNumber.toUpperCase()));
      const discontinued = existingParts
        .filter((p) => p.isActive && !newPdfNumbers.has(p.partNumber.toUpperCase()))
        .map((p) => ({ id: p.id, partNumber: p.partNumber, description: p.description }));

      return res.json({ matched, newParts, discontinued });
    } catch (err) {
      console.error("Price update extract error:", err);
      return res.status(500).json({ error: "Failed to process PDF" });
    }
  }
);

export default router;
