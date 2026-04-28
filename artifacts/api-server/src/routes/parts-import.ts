import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../lib/auth";
import { GoogleGenAI } from "@google/genai";
import { db, partsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a data extraction assistant. Extract ALL part numbers and prices from this Interstate Batteries price sheet text into a JSON array.
The sheet has 3 price tiers: Retail, Xstore, and Tier 1 (may be labeled T1, Tier1, or similar).
Output a compact JSON array. Each element: {"p":"PART_NUMBER","r":"retail_price_or_null","x":"xstore_price_or_null","t":"tier1_price_or_null","c":"category_guess_or_null"}
Use short keys to stay within token limits. Omit null values entirely rather than writing null.
CRITICAL PART NUMBER RULES:
- Copy each part number EXACTLY as it appears in the table row — do NOT add, remove, or alter any characters.
- PDF price sheets often have section headers (e.g. "Automotive", "Marine", "AGM") above groups of rows. These headers are NOT part of the part number. Never prepend a section header letter or abbreviation to a part number. For example, if "Automotive" is a section header and the row shows "MT-41", the part number is "MT-41" — NOT "AMT-41".
- Part numbers typically contain only letters, digits, and hyphens (e.g. MT-41, SRM-4D, UTX9).
CATEGORY RULES:
- The PDF is divided into sections with a header label such as "Automotive", "Marine", "AGM", "Deep Cycle", "Commercial", "Lawn & Garden", or "Powersport".
- Track which section header is currently active as you read through the document. Every part row that follows a header belongs to that category.
- Set "c" to the active section header name for every part in that section (e.g. "Automotive", "Marine"). Do NOT leave "c" null if a section header is visible above the row.
IMPORTANT price tier rules for Interstate Batteries:
- "r" (Retail) = the HIGHEST price, what end consumers pay (MSRP)
- "x" (Xstore) = the LOWER dealer/store price, always less than retail
- "t" (Tier 1) = the LOWEST price, best dealer rate
If unsure which column is which, assign the highest value to "r" and lower to "x".
Do not invent prices. If you cannot extract valid rows, return [].

Price sheet text:
${text.slice(0, 30000)}`,
          },
        ],
      },
    ],
  });

  const content = response.text ?? "[]";
  console.log("[parts-import] parsePartsFromText raw response (first 500 chars):", content.slice(0, 500));
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const raw = JSON.parse(cleaned) as Array<Record<string, string | null>>;
    // Map compact keys back to full field names
    const parsed: ExtractedPart[] = raw.map((row) => ({
      partNumber: (row.p ?? row.partNumber ?? "") as string,
      retailPrice: (row.r ?? row.retailPrice ?? null) as string | null,
      xstorePrice: (row.x ?? row.xstorePrice ?? null) as string | null,
      tier1Price: (row.t ?? row.tier1Price ?? null) as string | null,
      categoryGuess: (row.c ?? row.categoryGuess ?? null) as string | null,
      description: (row.description ?? null) as string | null,
    })).filter((p) => p.partNumber);
    console.log("[parts-import] parsed", parsed.length, "parts");
    return parsed;
  } catch (e) {
    console.error("[parts-import] JSON parse error:", e, "| raw:", content.slice(0, 300));
    return [];
  }
}

async function enrichDescriptions(parts: ExtractedPart[]): Promise<ExtractedPart[]> {
  if (parts.length === 0) return parts;

  const partNumbers = parts.map((p) => p.partNumber).join(", ");
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are a battery product expert specializing in Interstate Batteries. Given a list of Interstate Battery part numbers, provide a short description for each one based on your product knowledge (type, voltage, CCA, group size, etc.). Return ONLY a valid JSON object mapping partNumber → description string. If you don't know a part number, use null.

Provide descriptions for these Interstate Battery part numbers: ${partNumbers}`,
          },
        ],
      },
    ],
  });

  const content = response.text ?? "{}";
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
      console.log("[parts-import] PDF text length:", text.length, "| first 200:", text.slice(0, 200));
      if (!text.trim()) return res.status(422).json({ error: "Could not extract text from PDF" });

      const parts = await parsePartsFromText(text);
      if (parts.length === 0) {
        return res.status(422).json({ error: "No parts could be extracted from the PDF" });
      }

      const enriched = await enrichDescriptions(parts);
      return res.json({ parts: enriched, pageCount: text.length });
    } catch (err) {
      console.error("Import extract error:", err);
      return res.status(500).json({ error: "Failed to process PDF", detail: String(err) });
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
