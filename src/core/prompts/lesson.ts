/** Prompt builder for generating a lesson's teaching content (JSON). */
export interface LessonPromptInput {
  level: string; // A1..C2
  chapterTitle: string;
  lessonTitle: string;
  objective: string;
  /** For extra AI versions: a distinct angle to take. */
  variantFocus?: string;
  /** Italian words/phrases already covered — the new version must avoid them. */
  avoid?: string[];
}

export function buildLessonPrompt(input: LessonPromptInput): string {
  const lines = [
    "You are an expert Italian teacher writing a self-study lesson for an English speaker.",
    `CEFR level: ${input.level}. Chapter: ${input.chapterTitle}.`,
    `Lesson: "${input.lessonTitle}". Objective: ${input.objective}.`,
  ];

  if (input.variantFocus) {
    lines.push(
      "This is an ADDITIONAL version of the same lesson (the learner wants more on this exact topic).",
      `Take a clearly DIFFERENT angle: ${input.variantFocus}`,
      "Do NOT repeat the explanation, examples, or phrases from previous versions — bring fresh material.",
    );
    if (input.avoid && input.avoid.length > 0) {
      lines.push(
        "Already covered in previous versions (do NOT reuse these Italian items): " +
          input.avoid.slice(0, 40).join("; "),
      );
    }
  }

  lines.push(
    "Return ONLY a JSON object (no prose, no code fences) with this exact shape:",
    `{
  "intro": string,          // 1-2 sentences in English: what this version covers
  "explanation": string,    // core teaching in clear English with Italian shown inline; short paragraphs separated by \\n
  "examples": [ { "it": string, "en": string } ],   // 4-8 example sentences
  "keyPhrases": [ { "it": string, "en": string } ], // 3-6 must-know words/phrases
  "practice": [ { "question": string, "answer": string } ] // 3-5 short exercises with answers
}`,
    "Guidelines:",
    "- Explanations in English; all Italian must be correct and level-appropriate.",
    "- Keep it focused on the objective and within the CEFR level.",
    "- Practice questions should be answerable from this lesson.",
  );

  return lines.join("\n");
}

/** Distinct focus for each extra version (variant 1 and 2). */
export const VARIANT_FOCUS: Record<number, string> = {
  1: "everyday real-life examples, common mistakes learners make, and extra practical phrases.",
  2: "deeper nuances, exceptions and irregularities, cultural/contextual notes, and a few more challenging practice items.",
};
