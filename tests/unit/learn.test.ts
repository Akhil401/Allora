import { describe, it, expect } from "vitest";
import { isLessonUnlocked, nextLessonId, completedCount } from "@/core/application/use-cases/learn";

const ids = ["a1-1-1", "a1-1-2", "a1-1-3", "a1-2-1"];

describe("linear unlock", () => {
  it("unlocks the first lesson by default", () => {
    expect(isLessonUnlocked(ids, new Set(), "a1-1-1")).toBe(true);
  });

  it("keeps later lessons locked until the previous is completed", () => {
    expect(isLessonUnlocked(ids, new Set(), "a1-1-2")).toBe(false);
    expect(isLessonUnlocked(ids, new Set(["a1-1-1"]), "a1-1-2")).toBe(true);
  });

  it("unlocks across chapter boundaries", () => {
    expect(isLessonUnlocked(ids, new Set(["a1-1-3"]), "a1-2-1")).toBe(true);
  });

  it("returns false for unknown ids", () => {
    expect(isLessonUnlocked(ids, new Set(ids), "zzz")).toBe(false);
  });

  it("finds the next lesson id and null at the end", () => {
    expect(nextLessonId(ids, "a1-1-1")).toBe("a1-1-2");
    expect(nextLessonId(ids, "a1-2-1")).toBeNull();
  });

  it("counts completed lessons", () => {
    expect(completedCount(ids, new Set(["a1-1-1", "a1-1-2", "unknown"]))).toBe(2);
  });
});
