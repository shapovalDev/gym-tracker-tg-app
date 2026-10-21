/**
 * Workout cycle logic.
 *
 * The next workout is derived — never stored — from the program's current
 * workout order and the most recent *completed* session of that program:
 *  - no completed sessions            -> first workout
 *  - last completed workout exists    -> the workout after it (wraps to first)
 *  - last completed workout deleted   -> first workout (cycle restarts)
 * Cancelled and in-progress sessions never advance the cycle. Rest days are
 * irrelevant because time is not part of the calculation. Each program keeps
 * its own position, so switching the active program is lossless.
 */
export interface CycleWorkout {
  id: string;
  position: number;
}

export function sortByPosition<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

export function nextWorkoutId(
  workouts: readonly CycleWorkout[],
  lastCompletedWorkoutId: string | null | undefined,
): string | null {
  const ordered = sortByPosition(workouts);
  if (ordered.length === 0) return null;
  const first = ordered[0]!;
  if (!lastCompletedWorkoutId) return first.id;
  const index = ordered.findIndex((w) => w.id === lastCompletedWorkoutId);
  if (index === -1) return first.id;
  return ordered[(index + 1) % ordered.length]!.id;
}

/** Validates that `ids` is an exact permutation of `existing`. */
export function isPermutation(ids: readonly string[], existing: readonly string[]): boolean {
  if (ids.length !== existing.length) return false;
  const set = new Set(ids);
  if (set.size !== ids.length) return false;
  return existing.every((id) => set.has(id));
}
