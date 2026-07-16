import { z } from "zod";

/**
 * Schema for the tutor's structured correction of a user's Italian message.
 * The LLM is prompted to return exactly this JSON; we validate it before
 * persisting so malformed model output can never corrupt the database.
 */
export const correctionSchema = z.object({
  hasError: z.boolean(),
  originalText: z.string(),
  correctedText: z.string(),
  explanationEn: z.string(),
  errors: z
    .array(
      z.object({
        type: z.string(),
        detail: z.string(),
        severity: z.enum(["low", "med", "high"]).default("low"),
      }),
    )
    .default([]),
  vocabulary: z
    .array(
      z.object({
        termIt: z.string(),
        termEn: z.string(),
        partOfSpeech: z.string().optional(),
      }),
    )
    .default([]),
});

export type CorrectionObject = z.infer<typeof correctionSchema>;

/**
 * Parse model output into a CorrectionObject. Tolerates ```json fences and
 * leading/trailing prose. Returns null if it cannot be salvaged.
 */
export function parseCorrection(raw: string): CorrectionObject | null {
  const cleaned = extractJson(raw);
  if (!cleaned) return null;
  try {
    return correctionSchema.parse(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}
