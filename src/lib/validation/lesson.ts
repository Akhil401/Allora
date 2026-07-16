import { z } from "zod";

/** Structured teaching content for a lesson (LLM-generated, then DB-cached). */
export const lessonContentSchema = z.object({
  intro: z.string(),
  explanation: z.string(), // English explanation, may reference Italian inline
  examples: z.array(z.object({ it: z.string(), en: z.string() })).default([]),
  keyPhrases: z.array(z.object({ it: z.string(), en: z.string() })).default([]),
  practice: z.array(z.object({ question: z.string(), answer: z.string() })).default([]),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;

export function parseLessonContent(raw: string): LessonContent | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return lessonContentSchema.parse(JSON.parse(candidate.slice(start, end + 1)));
  } catch {
    return null;
  }
}
