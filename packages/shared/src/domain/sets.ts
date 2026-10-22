import type { SetType } from '../constants';

interface TypedSet {
  setNumber: number;
  setType?: SetType;
}

const typeOf = (s: TypedSet): SetType => s.setType ?? 'working';

/** Sets of one type in recorded order. */
export function setsOfType<T extends TypedSet>(sets: readonly T[], type: SetType): T[] {
  return [...sets].filter((s) => typeOf(s) === type).sort((a, b) => a.setNumber - b.setNumber);
}

/**
 * The set from last time that corresponds to the one being entered now:
 * the n-th working set is compared with last time's n-th working set, the
 * n-th warm-up with the n-th warm-up. `index` is 0-based within the type.
 */
export function previousCounterpart<T extends TypedSet>(
  previous: readonly T[] | null | undefined,
  type: SetType,
  index: number,
): T | null {
  if (!previous) return null;
  return setsOfType(previous, type)[index] ?? null;
}

/**
 * Display labels: warm-ups are "W1", "W2"… (prefix is localisable), working sets are numbered 1, 2, 3…
 * on their own, regardless of how many warm-ups came before.
 */
export function setLabels<T extends TypedSet>(
  sets: readonly T[],
  warmupPrefix = 'W',
): Map<T, string> {
  const labels = new Map<T, string>();
  let working = 0;
  let warmup = 0;
  for (const s of [...sets].sort((a, b) => a.setNumber - b.setNumber)) {
    if (typeOf(s) === 'warmup') labels.set(s, `${warmupPrefix}${++warmup}`);
    else labels.set(s, String(++working));
  }
  return labels;
}
