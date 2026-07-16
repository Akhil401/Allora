import { describe, it, expect } from "vitest";
import {
  aggregateMemory,
  buildMemoryPromptBlock,
  recommendLessons,
  labelForError,
  type MemoryInputs,
  type LessonMeta,
} from "@/core/application/use-cases/memory";

const emptyInputs: MemoryInputs = {
  mistakes: [],
  completedTopics: [],
  favoriteTopics: [],
  reviews: { again: 0, hard: 0, good: 0, easy: 0 },
  lessonsCompleted: 0,
  activeDays: 0,
  totalMessages: 0,
};

describe("aggregateMemory", () => {
  it("returns neutral defaults with no data", () => {
    const m = aggregateMemory(emptyInputs);
    expect(m.confidence).toBe(0.5);
    expect(m.learningSpeed).toBe("normal");
    expect(m.weakGrammar).toEqual([]);
    expect(m.summaryEn).toContain("Confidence 50%");
  });

  it("ranks weak grammar by severity weight then count", () => {
    const m = aggregateMemory({
      ...emptyInputs,
      totalMessages: 10,
      mistakes: [
        { errorType: "article", severity: "low" },
        { errorType: "article", severity: "low" },
        { errorType: "article", severity: "low" },
        { errorType: "verb_tense", severity: "high" },
        { errorType: "verb_tense", severity: "high" },
      ],
    });
    // verb_tense weight 6 (2×high) beats article weight 3 (3×low)
    expect(m.weakGrammar[0]?.type).toBe("verb_tense");
    expect(m.weakGrammar[0]?.label).toBe("verb tenses");
    expect(m.weakGrammar[1]?.type).toBe("article");
  });

  it("computes review accuracy and raises confidence when reviews are strong", () => {
    const strong = aggregateMemory({
      ...emptyInputs,
      totalMessages: 20,
      reviews: { again: 0, hard: 1, good: 4, easy: 5 },
    });
    expect(strong.stats.reviewAccuracy).toBe(0.9);
    expect(strong.confidence).toBeGreaterThan(0.8);
  });

  it("lowers confidence with a high mistake rate", () => {
    const weak = aggregateMemory({
      ...emptyInputs,
      totalMessages: 10,
      mistakes: Array.from({ length: 9 }, () => ({
        errorType: "agreement",
        severity: "med" as const,
      })),
    });
    expect(weak.confidence).toBeLessThan(0.3);
  });

  it("classifies learning speed from lessons per active day", () => {
    expect(
      aggregateMemory({ ...emptyInputs, lessonsCompleted: 6, activeDays: 3 }).learningSpeed,
    ).toBe("fast");
    expect(
      aggregateMemory({ ...emptyInputs, lessonsCompleted: 2, activeDays: 3 }).learningSpeed,
    ).toBe("normal");
    expect(
      aggregateMemory({ ...emptyInputs, lessonsCompleted: 1, activeDays: 5 }).learningSpeed,
    ).toBe("slow");
  });

  it("dedupes mastered topics and ranks favorite topics by count", () => {
    const m = aggregateMemory({
      ...emptyInputs,
      completedTopics: ["Greetings", "greetings", "Numbers"],
      favoriteTopics: [
        { topic: "Football", count: 1 },
        { topic: "Travel", count: 5 },
      ],
    });
    expect(m.masteredTopics).toEqual(["Greetings", "Numbers"]);
    expect(m.favoriteTopics[0]).toBe("Travel");
  });
});

describe("buildMemoryPromptBlock", () => {
  it("is empty when there is no memory", () => {
    expect(buildMemoryPromptBlock(null)).toBe("");
  });

  it("includes weak spots, mastered, favorites and recent struggles", () => {
    const m = aggregateMemory({
      ...emptyInputs,
      totalMessages: 5,
      mistakes: [{ errorType: "verb_tense", severity: "high" }],
      completedTopics: ["Greetings"],
      favoriteTopics: [{ topic: "Travel", count: 3 }],
    });
    const block = buildMemoryPromptBlock(m, ["mixed up essere/stare"], "Akhil");
    expect(block).toContain("Akhil");
    expect(block).toContain("verb tenses");
    expect(block).toContain("Greetings");
    expect(block).toContain("Travel");
    expect(block).toContain("essere/stare");
  });
});

describe("recommendLessons", () => {
  const meta: Record<string, LessonMeta> = {
    "a1-1-1": { id: "a1-1-1", title: "Greetings", objective: "Say hello" },
    "a1-1-2": { id: "a1-1-2", title: "The past tense", objective: "Use passato prossimo" },
    "a1-1-3": { id: "a1-1-3", title: "Articles", objective: "Definite articles il/la" },
    "a1-1-4": { id: "a1-1-4", title: "Numbers", objective: "Count to 100" },
  };
  const ordered = ["a1-1-1", "a1-1-2", "a1-1-3", "a1-1-4"];

  it("prioritizes lessons matching weak grammar", () => {
    const m = aggregateMemory({
      ...emptyInputs,
      totalMessages: 4,
      mistakes: [{ errorType: "verb_tense", severity: "high" }],
    });
    const recs = recommendLessons(m, new Set(["a1-1-1"]), ordered, meta, 2);
    expect(recs[0]?.id).toBe("a1-1-2"); // past tense matches verb_tense keywords
  });

  it("never recommends completed lessons and fills in order", () => {
    const recs = recommendLessons(null, new Set(["a1-1-1", "a1-1-2"]), ordered, meta, 2);
    expect(recs.map((r) => r.id)).toEqual(["a1-1-3", "a1-1-4"]);
  });
});

describe("labelForError", () => {
  it("maps known tags and humanizes unknown ones", () => {
    expect(labelForError("verb_tense")).toBe("verb tenses");
    expect(labelForError("some_new_tag")).toBe("some new tag");
  });
});
