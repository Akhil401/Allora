/**
 * Pure progress calculations (no I/O) — easy to unit test.
 */

export interface DayProgress {
  day: string; // YYYY-MM-DD
  goalMet: boolean;
}

/**
 * Count the current daily streak: consecutive days with goal met, ending today
 * or yesterday (so the streak doesn't break until a full day is missed).
 * `rows` may be in any order.
 */
export function computeStreak(rows: DayProgress[], today = new Date()): number {
  const met = new Set(rows.filter((r) => r.goalMet).map((r) => r.day));
  if (met.size === 0) return 0;

  const toKey = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date(today);

  // Allow the streak to be "alive" if today isn't done yet but yesterday was.
  if (!met.has(toKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (met.has(toKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
