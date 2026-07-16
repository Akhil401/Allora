import { describe, it, expect } from "vitest";
import { computeStreak } from "@/core/application/use-cases/progress";

const today = new Date("2026-07-15T12:00:00Z");

describe("computeStreak", () => {
  it("returns 0 with no completed days", () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const rows = [
      { day: "2026-07-15", goalMet: true },
      { day: "2026-07-14", goalMet: true },
      { day: "2026-07-13", goalMet: true },
    ];
    expect(computeStreak(rows, today)).toBe(3);
  });

  it("keeps the streak alive if today isn't done but yesterday was", () => {
    const rows = [
      { day: "2026-07-14", goalMet: true },
      { day: "2026-07-13", goalMet: true },
    ];
    expect(computeStreak(rows, today)).toBe(2);
  });

  it("breaks on a gap", () => {
    const rows = [
      { day: "2026-07-15", goalMet: true },
      { day: "2026-07-13", goalMet: true },
    ];
    expect(computeStreak(rows, today)).toBe(1);
  });

  it("ignores days where the goal was not met", () => {
    const rows = [
      { day: "2026-07-15", goalMet: false },
      { day: "2026-07-14", goalMet: true },
    ];
    expect(computeStreak(rows, today)).toBe(1);
  });
});
