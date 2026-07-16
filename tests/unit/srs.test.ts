import { describe, it, expect } from "vitest";
import { scheduleNext, REVIEW_QUALITY } from "@/core/application/use-cases/srs";

const now = new Date("2026-07-15T00:00:00Z");
const fresh = { easeFactor: 250, intervalDays: 0, repetitions: 0 };

describe("scheduleNext (SM-2)", () => {
  it("first successful review → 1 day", () => {
    const r = scheduleNext(fresh, REVIEW_QUALITY.good, now);
    expect(r.repetitions).toBe(1);
    expect(r.intervalDays).toBe(1);
  });

  it("second successful review → 6 days", () => {
    const r = scheduleNext(
      { easeFactor: 250, intervalDays: 1, repetitions: 1 },
      REVIEW_QUALITY.good,
      now,
    );
    expect(r.repetitions).toBe(2);
    expect(r.intervalDays).toBe(6);
  });

  it("third review multiplies by ease factor", () => {
    const r = scheduleNext(
      { easeFactor: 250, intervalDays: 6, repetitions: 2 },
      REVIEW_QUALITY.good,
      now,
    );
    expect(r.repetitions).toBe(3);
    expect(r.intervalDays).toBeGreaterThanOrEqual(14); // ~6 * 2.5
  });

  it("a failed review resets to 1 day and repetition 0", () => {
    const r = scheduleNext(
      { easeFactor: 250, intervalDays: 20, repetitions: 5 },
      REVIEW_QUALITY.again,
      now,
    );
    expect(r.repetitions).toBe(0);
    expect(r.intervalDays).toBe(1);
  });

  it("ease factor never drops below 1.3 (130)", () => {
    let state = { easeFactor: 130, intervalDays: 1, repetitions: 1 };
    for (let i = 0; i < 5; i++) state = scheduleNext(state, REVIEW_QUALITY.again, now);
    expect(state.easeFactor).toBeGreaterThanOrEqual(130);
  });

  it("sets a future dueAt", () => {
    const r = scheduleNext(fresh, REVIEW_QUALITY.easy, now);
    expect(r.dueAt.getTime()).toBeGreaterThan(now.getTime());
  });
});
