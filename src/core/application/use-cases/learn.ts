/**
 * Pure linear-unlock logic for the course (no I/O, unit-tested).
 * A lesson is unlocked if it's the first in the sequence, or the lesson
 * immediately before it has been completed.
 */

export function isLessonUnlocked(
  orderedIds: string[],
  completed: ReadonlySet<string>,
  lessonId: string,
): boolean {
  const index = orderedIds.indexOf(lessonId);
  if (index <= 0) return index === 0; // first lesson unlocked; unknown id → false
  return completed.has(orderedIds[index - 1]!);
}

/** The id of the next lesson after the given one, or null if it's the last. */
export function nextLessonId(orderedIds: string[], lessonId: string): string | null {
  const index = orderedIds.indexOf(lessonId);
  if (index === -1 || index >= orderedIds.length - 1) return null;
  return orderedIds[index + 1]!;
}

/** How many of the ordered lessons are completed (ignores unknown ids). */
export function completedCount(orderedIds: string[], completed: ReadonlySet<string>): number {
  return orderedIds.reduce((n, id) => (completed.has(id) ? n + 1 : n), 0);
}
