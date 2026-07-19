/**
 * Prompt for generating a concise patente B theory study guide for one topic.
 * Pure function (no I/O) so it's testable and versionable.
 */
export function buildPatenteTheoryPrompt(topic: string): string {
  return [
    "You are an Italian driving-school instructor writing a concise STUDY GUIDE for the",
    "Italian driving-licence (patente B) theory exam.",
    `Topic: "${topic}".`,
    "Write in clear English for a learner who is also learning Italian, but keep the key",
    "Italian terms in parentheses the first time they appear (e.g. right of way (precedenza)).",
    "Cover the essential rules and facts a student must know to answer the official true/false",
    "questions on this topic. Be accurate and practical.",
    "Format: 200–350 words, a few short titled sections (plain text, one heading per line",
    "followed by 2–4 sentences). No markdown symbols, no bullet characters, no preamble —",
    "start directly with the first section.",
  ].join("\n");
}
