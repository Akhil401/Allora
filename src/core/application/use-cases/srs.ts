/**
 * SM-2 spaced-repetition scheduler (pure, unit-tested).
 *
 * `easeFactor` is stored as an integer ×100 (e.g. 250 → EF 2.5) to keep the DB
 * column an integer. `quality` is the SuperMemo grade 0–5; we map the review
 * buttons Again/Hard/Good/Easy → 1/3/4/5.
 */

export interface SrsState {
  easeFactor: number; // ×100
  intervalDays: number;
  repetitions: number;
}

export interface SrsResult extends SrsState {
  dueAt: Date;
}

const DAY_MS = 86_400_000;

export function scheduleNext(state: SrsState, quality: number, now: Date = new Date()): SrsResult {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  // Update ease factor (classic SM-2 formula), clamped to a 1.3 floor.
  let ef = state.easeFactor / 100;
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ef < 1.3) ef = 1.3;

  let repetitions: number;
  let intervalDays: number;

  if (q < 3) {
    // Lapsed: reset the repetition streak, review again tomorrow.
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = state.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(state.intervalDays * ef));
  }

  return {
    easeFactor: Math.round(ef * 100),
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}

/** Map a review button to a SuperMemo quality grade. */
export const REVIEW_QUALITY = { again: 1, hard: 3, good: 4, easy: 5 } as const;
export type ReviewGrade = keyof typeof REVIEW_QUALITY;
