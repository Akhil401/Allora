import { z } from "zod";

/** Structured result of an AI dictionary lookup. Validated before returning. */
export const dictionaryResultSchema = z.object({
  termIt: z.string(),
  termEn: z.string(),
  partOfSpeech: z.string().default(""),
  exampleIt: z.string().default(""),
  exampleEn: z.string().default(""),
});

export type DictionaryResult = z.infer<typeof dictionaryResultSchema>;

/** Parse LLM output into a DictionaryResult, tolerating fences/prose. */
export function parseDictionary(raw: string): DictionaryResult | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return dictionaryResultSchema.parse(JSON.parse(candidate.slice(start, end + 1)));
  } catch {
    return null;
  }
}
