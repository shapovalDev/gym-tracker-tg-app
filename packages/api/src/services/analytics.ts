import {
  daysAgo,
  distinctWorkingWeights,
  filterByDateRange,
  isWorkingSet,
  percentChange,
  periodRange,
  personalRecords,
  previousPeriodRange,
  sessionPoints,
  volumeKg,
  type ExerciseAnalyticsDto,
  type ExerciseHighlightDto,
  type HomeDto,
  type MetricSet,
  type Period,
  type StatsSummaryDto,
} from '@gym/shared';
import type { Db } from '../db';
import { decimalToNumber, iso, ownedExercise } from './common';
import { computeNextWorkoutId } from './programs';
import { sessionInclude, toListItem } from './sessions';

/**
 * Analytics are computed on read from the recorded sets of *completed*
 * sessions, so edits and deletions are reflected immediately — there are no
 * cached aggregates to invalidate. Per-user data volume is small (thousands of
 * sets), which keeps this cheap; add materialized aggregates only if needed.
 */

async function exerciseSets(
  db: Db,
  userId: string,
  exerciseId: string,
  from: Date | null,
): Promise<MetricSet[]> {
  const rows = await db.exerciseSet.findMany({
    where: {
      sessionExercise: {
        exerciseId,
        session: { userId, status: 'completed', ...(from ? { startedAt: { gte: from } } : {}) },
      },
    },
    select: {
      weightKg: true,
      reps: true,
      status: true,
      sessionExercise: { select: { session: { select: { id: true, startedAt: true } } } },
    },
  });
  return rows.map((r) => ({
    sessionId: r.sessionExercise.session.id,
    date: r.sessionExercise.session.startedAt,
    weightKg: decimalToNumber(r.weightKg),
    reps: r.reps,
    status: r.status,
  }));
}

export async function exerciseAnalytics(
  db: Db,
  userId: string,
  exerciseId: string,
  period: Period,
  weightKg: number | undefined,
): Promise<ExerciseAnalyticsDto> {
  const exercise = await ownedExercise(db, userId, exerciseId);
  const now = new Date();
  const all = await exerciseSets(db, userId, exerciseId, null); // records are all-time
  const range = periodRange(period, now);
  const prevRange = previousPeriodRange(period, now);
  const current = filterByDateRange(all, (s) => s.date, range);
  const previous = prevRange ? filterByDateRange(all, (s) => s.date, prevRange) : null;

  const points = sessionPoints(current, weightKg);
  const prevPoints = previous ? sessionPoints(previous) : null;
  const best = (ps: typeof points) =>
    ps.reduce<number | null>(
      (m, p) => (p.bestE1rmKg !== null && (m === null || p.bestE1rmKg > m) ? p.bestE1rmKg : m),
      null,
    );
  const bestE1rmKg = best(points);
  const previousBestE1rmKg = prevPoints && prevPoints.length ? best(prevPoints) : null;
  const vol = volumeKg(current);
  const previousVolumeKg = previous && previous.some(isWorkingSet) ? volumeKg(previous) : null;

  return {
    exercise: {
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      archivedAt: iso(exercise.archivedAt),
    },
    period,
    weightKg: weightKg ?? null,
    points,
    records: personalRecords(all, weightKg),
    availableWeights: distinctWorkingWeights(current),
    summary: {
      sessions: points.length,
      workingSets: current.filter(isWorkingSet).length,
      volumeKg: vol,
      bestE1rmKg,
      previousBestE1rmKg,
      changeE1rmPct: percentChange(bestE1rmKg, previousBestE1rmKg),
      previousVolumeKg,
      changeVolumePct: percentChange(points.length ? vol : null, previousVolumeKg),
    },
  };
}

async function periodTotals(db: Db, userId: string, from: Date | null, to: Date) {
  const [completedWorkouts, sets] = await Promise.all([
    db.workoutSession.count({
      where: { userId, status: 'completed', startedAt: { ...(from ? { gte: from } : {}), lt: to } },
    }),
    db.exerciseSet.findMany({
      where: {
        sessionExercise: {
          session: {
            userId,
            status: 'completed',
            startedAt: { ...(from ? { gte: from } : {}), lt: to },
          },
        },
      },
      select: { weightKg: true, reps: true, status: true },
    }),
  ]);
  const metricSets = sets.map((s) => ({
    weightKg: decimalToNumber(s.weightKg),
    reps: s.reps,
    status: s.status,
  }));
  return {
    completedWorkouts,
    totalSets: metricSets.filter(isWorkingSet).length,
    volumeKg: volumeKg(metricSets),
  };
}

export async function statsSummary(
  db: Db,
  userId: string,
  period: Period,
): Promise<StatsSummaryDto> {
  const now = new Date();
  const range = periodRange(period, now);
  const prevRange = previousPeriodRange(period, now);
  // `to` is exclusive; nudge so sessions started this millisecond are included.
  const current = await periodTotals(db, userId, range.from, new Date(now.getTime() + 1));
  const previous = prevRange ? await periodTotals(db, userId, prevRange.from, prevRange.to) : null;
  return {
    period,
    ...current,
    previous,
    changeVolumePct: previous ? percentChange(current.volumeKg, previous.volumeKg) : null,
    changeWorkoutsPct: previous
      ? percentChange(current.completedWorkouts, previous.completedWorkouts)
      : null,
  };
}

async function highlights(db: Db, userId: string): Promise<ExerciseHighlightDto[]> {
  const rows = await db.exerciseSet.findMany({
    where: {
      sessionExercise: {
        session: { userId, status: 'completed', startedAt: { gte: daysAgo(120) } },
      },
    },
    select: {
      weightKg: true,
      reps: true,
      status: true,
      sessionExercise: {
        select: {
          exerciseId: true,
          exercise: { select: { name: true, archivedAt: true } },
          session: { select: { id: true, startedAt: true } },
        },
      },
    },
  });
  const byExercise = new Map<string, { name: string; sets: MetricSet[] }>();
  for (const r of rows) {
    const se = r.sessionExercise;
    if (se.exercise.archivedAt) continue;
    const entry = byExercise.get(se.exerciseId) ?? { name: se.exercise.name, sets: [] };
    entry.sets.push({
      sessionId: se.session.id,
      date: se.session.startedAt,
      weightKg: decimalToNumber(r.weightKg),
      reps: r.reps,
      status: r.status,
    });
    byExercise.set(se.exerciseId, entry);
  }
  const result: ExerciseHighlightDto[] = [];
  for (const [exerciseId, { name, sets }] of byExercise) {
    const points = sessionPoints(sets);
    const last = points.at(-1);
    if (!last) continue;
    const prev = points.at(-2) ?? null;
    result.push({
      exerciseId,
      name,
      lastDate: last.date,
      lastBestE1rmKg: last.bestE1rmKg,
      lastMaxWeightKg: last.maxWeightKg,
      changeE1rmPct: prev ? percentChange(last.bestE1rmKg, prev.bestE1rmKg) : null,
    });
  }
  return result.sort((a, b) => b.lastDate.localeCompare(a.lastDate)).slice(0, 4);
}

export async function homeState(db: Db, userId: string): Promise<HomeDto> {
  const [program, activeSession, lastSession, completedLast7Days, completedLast30Days, hl] =
    await Promise.all([
      db.trainingProgram.findFirst({
        where: { userId, isActive: true, archivedAt: null },
        include: {
          workouts: {
            orderBy: { position: 'asc' },
            include: {
              exercises: {
                orderBy: { position: 'asc' },
                select: { exercise: { select: { name: true } } },
              },
            },
          },
        },
      }),
      db.workoutSession.findFirst({
        where: { userId, status: 'in_progress' },
        select: { id: true, workoutNameSnapshot: true, startedAt: true },
      }),
      db.workoutSession.findFirst({
        where: { userId, status: 'completed' },
        orderBy: { startedAt: 'desc' },
        include: sessionInclude,
      }),
      db.workoutSession.count({
        where: { userId, status: 'completed', startedAt: { gte: daysAgo(7) } },
      }),
      db.workoutSession.count({
        where: { userId, status: 'completed', startedAt: { gte: daysAgo(30) } },
      }),
      highlights(db, userId),
    ]);
  const nextId = program ? await computeNextWorkoutId(db, program.id, program.workouts) : null;
  const next = program?.workouts.find((w) => w.id === nextId) ?? null;
  return {
    activeProgram: program
      ? { id: program.id, name: program.name, workoutCount: program.workouts.length }
      : null,
    nextWorkout: next
      ? {
          id: next.id,
          name: next.name,
          position: next.position,
          exerciseCount: next.exercises.length,
          exerciseNames: next.exercises.map((e) => e.exercise.name),
        }
      : null,
    activeSession: activeSession
      ? {
          id: activeSession.id,
          workoutName: activeSession.workoutNameSnapshot,
          startedAt: activeSession.startedAt.toISOString(),
        }
      : null,
    lastSession: lastSession ? toListItem(lastSession) : null,
    completedLast7Days,
    completedLast30Days,
    highlights: hl,
  };
}
