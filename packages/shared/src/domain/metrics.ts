import { fromCentiKg, roundWeightKg, toCentiKg } from './weight';
import { countsVolume } from './tracking';
import type { SetStatus, SetType, TrackingType } from '../constants';

/**
 * Analytics primitives. All functions are pure and operate on *recorded* sets
 * only; planned sets never reach this module.
 *
 * Working set = status "completed" with reps >= 1 (or, for timed exercises,
 *               durationSec >= 1) and not marked as warm-up.
 * Volume      = Σ weight × reps over working sets of `weight_reps` exercises
 *               only: a counterweight or extra load on body weight is not a load.
 * e1RM        = Epley estimate weight × (1 + reps / 30), only for working sets
 *               of `weight_reps` exercises with weight > 0 and
 *               1 <= reps <= E1RM_MAX_REPS (estimates from very high-rep sets
 *               are not comparable to heavy sets).
 */
export const E1RM_MAX_REPS = 12;

export interface MetricSet {
  sessionId: string;
  /** Session start time; used as the data point's date. */
  date: Date;
  weightKg: number;
  reps: number;
  status: SetStatus;
  /** Missing means "working" (sets recorded before set types existed). */
  setType?: SetType;
  /** Timed sets only. */
  durationSec?: number | null;
  /** The exercise's type; missing means `weight_reps`. */
  trackingType?: TrackingType;
}

type WorkingFields = Pick<MetricSet, 'status' | 'reps' | 'setType' | 'durationSec'>;

export function isWorkingSet(set: WorkingFields): boolean {
  if (set.status !== 'completed' || set.setType === 'warmup') return false;
  const positive = (n: number | null | undefined) => Number.isInteger(n) && (n as number) >= 1;
  return positive(set.reps) || positive(set.durationSec);
}

const loadCounts = (s: Pick<MetricSet, 'trackingType'>) =>
  countsVolume(s.trackingType ?? 'weight_reps');

export const isWarmup = (set: Pick<MetricSet, 'setType'>) => set.setType === 'warmup';

export function epleyE1rm(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS) return null;
  return roundWeightKg(weightKg * (1 + reps / 30));
}

/** Total volume in kg, computed exactly in centi-kg. */
export function volumeKg(
  sets: readonly (WorkingFields & Pick<MetricSet, 'weightKg' | 'trackingType'>)[],
): number {
  let centi = 0;
  for (const s of sets)
    if (loadCounts(s) && isWorkingSet(s)) centi += toCentiKg(s.weightKg) * s.reps;
  return fromCentiKg(centi);
}

export interface SessionPoint {
  sessionId: string;
  date: string;
  maxWeightKg: number;
  /** Smallest weight: the best counterweight of an `assisted` exercise. */
  minWeightKg: number;
  totalReps: number;
  /** Most reps in one set. */
  maxReps: number;
  /** Longest timed set, if any. */
  maxDurationSec: number | null;
  volumeKg: number;
  bestE1rmKg: number | null;
  workingSets: number;
  /** Best reps achieved at the selected weight in this session, if requested. */
  repsAtWeight: number | null;
}

/** One data point per session that has at least one working set. No gap filling. */
export function sessionPoints(
  sets: readonly MetricSet[],
  atWeightKg?: number | null,
): SessionPoint[] {
  const bySession = new Map<string, MetricSet[]>();
  for (const s of sets) {
    if (!isWorkingSet(s)) continue;
    const list = bySession.get(s.sessionId);
    if (list) list.push(s);
    else bySession.set(s.sessionId, [s]);
  }
  const target = atWeightKg == null ? null : toCentiKg(atWeightKg);
  const points: SessionPoint[] = [];
  for (const [sessionId, list] of bySession) {
    let maxWeight = 0;
    let minWeight = Infinity;
    let totalReps = 0;
    let maxReps = 0;
    let maxDuration: number | null = null;
    let bestE1rm: number | null = null;
    let repsAtWeight: number | null = null;
    for (const s of list) {
      maxWeight = Math.max(maxWeight, s.weightKg);
      minWeight = Math.min(minWeight, s.weightKg);
      totalReps += s.reps;
      maxReps = Math.max(maxReps, s.reps);
      if (s.durationSec != null && s.durationSec >= 1)
        maxDuration = Math.max(maxDuration ?? 0, s.durationSec);
      const e = loadCounts(s) ? epleyE1rm(s.weightKg, s.reps) : null;
      if (e !== null && (bestE1rm === null || e > bestE1rm)) bestE1rm = e;
      if (target !== null && toCentiKg(s.weightKg) === target) {
        repsAtWeight = Math.max(repsAtWeight ?? 0, s.reps);
      }
    }
    points.push({
      sessionId,
      date: list[0]!.date.toISOString(),
      maxWeightKg: maxWeight,
      minWeightKg: minWeight,
      totalReps,
      maxReps,
      maxDurationSec: maxDuration,
      volumeKg: volumeKg(list),
      bestE1rmKg: bestE1rm,
      workingSets: list.length,
      repsAtWeight,
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface RecordEntry {
  value: number;
  weightKg: number;
  reps: number;
  durationSec: number | null;
  sessionId: string;
  date: string;
}

export interface PersonalRecords {
  bestWeight: RecordEntry | null;
  bestE1rm: RecordEntry | null;
  bestRepsAtWeight: RecordEntry | null;
  /** Most reps in one set (body-weight exercises). */
  bestReps: RecordEntry | null;
  /** Smallest counterweight with at least one rep (assisted exercises). */
  leastWeight: RecordEntry | null;
  /** Longest timed set. */
  longestDuration: RecordEntry | null;
  bestSessionVolume: { value: number; sessionId: string; date: string } | null;
}

/**
 * Ties are resolved in favour of the earliest occurrence (the first time a
 * record was set), which is what "record" means to the user.
 */
export function personalRecords(
  sets: readonly MetricSet[],
  atWeightKg?: number | null,
): PersonalRecords {
  const working = sets.filter(isWorkingSet).sort((a, b) => a.date.getTime() - b.date.getTime());
  const entry = (s: MetricSet, value: number): RecordEntry => ({
    value,
    weightKg: s.weightKg,
    reps: s.reps,
    durationSec: s.durationSec ?? null,
    sessionId: s.sessionId,
    date: s.date.toISOString(),
  });

  let bestWeight: RecordEntry | null = null;
  let bestE1rm: RecordEntry | null = null;
  let bestRepsAtWeight: RecordEntry | null = null;
  let bestReps: RecordEntry | null = null;
  let leastWeight: RecordEntry | null = null;
  let longestDuration: RecordEntry | null = null;
  const target = atWeightKg == null ? null : toCentiKg(atWeightKg);

  for (const s of working) {
    if (
      s.weightKg > 0 &&
      (bestWeight === null ||
        s.weightKg > bestWeight.weightKg ||
        (s.weightKg === bestWeight.weightKg && s.reps > bestWeight.reps))
    ) {
      bestWeight = entry(s, s.weightKg);
    }
    const e = loadCounts(s) ? epleyE1rm(s.weightKg, s.reps) : null;
    if (e !== null && (bestE1rm === null || e > bestE1rm.value)) bestE1rm = entry(s, e);
    if (s.reps >= 1 && (bestReps === null || s.reps > bestReps.reps)) bestReps = entry(s, s.reps);
    if (
      s.reps >= 1 &&
      (leastWeight === null ||
        s.weightKg < leastWeight.weightKg ||
        (s.weightKg === leastWeight.weightKg && s.reps > leastWeight.reps))
    ) {
      leastWeight = entry(s, s.weightKg);
    }
    const d = s.durationSec ?? 0;
    if (d >= 1 && (longestDuration === null || d > longestDuration.value))
      longestDuration = entry(s, d);
    if (target !== null && toCentiKg(s.weightKg) === target) {
      if (bestRepsAtWeight === null || s.reps > bestRepsAtWeight.reps)
        bestRepsAtWeight = entry(s, s.reps);
    }
  }

  let bestSessionVolume: PersonalRecords['bestSessionVolume'] = null;
  for (const p of sessionPoints(working)) {
    if (p.volumeKg > 0 && (bestSessionVolume === null || p.volumeKg > bestSessionVolume.value)) {
      bestSessionVolume = { value: p.volumeKg, sessionId: p.sessionId, date: p.date };
    }
  }
  return {
    bestWeight,
    bestE1rm,
    bestRepsAtWeight,
    bestReps,
    leastWeight,
    longestDuration,
    bestSessionVolume,
  };
}

/** Distinct weights of working sets, descending — used for the "reps at weight" picker. */
export function distinctWorkingWeights(sets: readonly MetricSet[]): number[] {
  const centis = new Set<number>();
  for (const s of sets) if (isWorkingSet(s)) centis.add(toCentiKg(s.weightKg));
  return [...centis].sort((a, b) => b - a).map(fromCentiKg);
}

/** Percentage change; null when there is no baseline. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface SummarySession {
  startedAt: Date;
  completedAt: Date | null;
  exercises: {
    trackingType?: TrackingType;
    sets: (WorkingFields & Pick<MetricSet, 'weightKg'>)[];
  }[];
}

export interface SessionSummary {
  /** Total workout duration (start → finish), not time under load. */
  durationSeconds: number | null;
  exercisesCompleted: number;
  totalSets: number;
  skippedSets: number;
  /** Warm-up sets: shown, but not part of totalSets or volume. */
  warmupSets: number;
  volumeKg: number;
}

export function summarizeSession(session: SummarySession): SessionSummary {
  let exercisesCompleted = 0;
  let totalSets = 0;
  let skippedSets = 0;
  let warmupSets = 0;
  const all: Parameters<typeof volumeKg>[0][number][] = [];
  for (const ex of session.exercises) {
    const working = ex.sets.filter(isWorkingSet);
    if (working.length > 0) exercisesCompleted += 1;
    totalSets += working.length;
    skippedSets += ex.sets.filter((s) => s.status === 'skipped' && !isWarmup(s)).length;
    warmupSets += ex.sets.filter(isWarmup).length;
    all.push(...ex.sets.map((s) => ({ ...s, trackingType: ex.trackingType })));
  }
  const durationSeconds = session.completedAt
    ? Math.max(0, Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000))
    : null;
  return {
    durationSeconds,
    exercisesCompleted,
    totalSets,
    skippedSets,
    warmupSets,
    volumeKg: volumeKg(all),
  };
}
