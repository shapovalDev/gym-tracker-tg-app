import {
  MAX_SETS_PER_EXERCISE,
  summarizeSession,
  type Paginated,
  type PreviousResultDto,
  type SessionDto,
  type SessionListItemDto,
  type SetDto,
  type sessionListQuerySchema,
  type setUpsertSchema,
} from '@gym/shared';
import type { z } from 'zod';
import type { Db } from '../db';
import { Prisma, type SessionStatus } from '../generated/prisma/client';
import { conflict, notFound } from '../http/errors';
import {
  decimalToNumber,
  iso,
  ownedExercise,
  ownedSession,
  ownedWorkout,
  type DbOrTx,
} from './common';

const sessionInclude = {
  exercises: {
    orderBy: [{ position: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      exercise: { select: { muscleGroup: true } },
      sets: { orderBy: [{ setNumber: 'asc' as const }, { createdAt: 'asc' as const }] },
    },
  },
};
type SessionRow = Prisma.WorkoutSessionGetPayload<{ include: typeof sessionInclude }>;
type SetRow = SessionRow['exercises'][number]['sets'][number];

function toSetDto(s: SetRow): SetDto {
  return {
    id: s.id,
    sessionExerciseId: s.sessionExerciseId,
    setNumber: s.setNumber,
    weightKg: decimalToNumber(s.weightKg),
    reps: s.reps,
    status: s.status,
    updatedAt: s.updatedAt.toISOString(),
  };
}

function summaryOf(s: SessionRow) {
  return summarizeSession({
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    exercises: s.exercises.map((e) => ({
      sets: e.sets.map((x) => ({
        status: x.status,
        reps: x.reps,
        weightKg: decimalToNumber(x.weightKg),
      })),
    })),
  });
}

/** Last completed result of each exercise before this session started. */
async function previousResults(db: DbOrTx, userId: string, s: SessionRow) {
  const exerciseIds = [...new Set(s.exercises.map((e) => e.exerciseId))];
  const found = await Promise.all(
    exerciseIds.map((exerciseId) =>
      db.sessionExercise.findFirst({
        where: {
          exerciseId,
          sessionId: { not: s.id },
          session: { userId, status: 'completed', startedAt: { lt: s.startedAt } },
          sets: { some: {} },
        },
        orderBy: [{ session: { startedAt: 'desc' } }, { position: 'asc' }],
        include: {
          session: { select: { id: true, startedAt: true } },
          sets: { orderBy: [{ setNumber: 'asc' }, { createdAt: 'asc' }] },
        },
      }),
    ),
  );
  const map = new Map<string, PreviousResultDto>();
  for (const row of found) {
    if (!row) continue;
    map.set(row.exerciseId, {
      sessionId: row.session.id,
      date: row.session.startedAt.toISOString(),
      sets: row.sets.map((x) => ({
        setNumber: x.setNumber,
        weightKg: decimalToNumber(x.weightKg),
        reps: x.reps,
        status: x.status,
      })),
    });
  }
  return map;
}

async function loadSession(db: DbOrTx, userId: string, sessionId: string): Promise<SessionDto> {
  const s = await db.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionInclude,
  });
  if (!s) throw notFound('Session');
  const previous = await previousResults(db, userId, s);
  return {
    id: s.id,
    status: s.status,
    programId: s.programId,
    workoutId: s.workoutId,
    programName: s.programNameSnapshot,
    workoutName: s.workoutNameSnapshot,
    startedAt: s.startedAt.toISOString(),
    completedAt: iso(s.completedAt),
    summary: summaryOf(s),
    exercises: s.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      name: e.exerciseNameSnapshot,
      muscleGroup: e.exercise.muscleGroup,
      position: e.position,
      plannedSets: e.plannedSets,
      targetRepsMin: e.targetRepsMin,
      targetRepsMax: e.targetRepsMax,
      notes: e.notes,
      sets: e.sets.map(toSetDto),
      previous: previous.get(e.exerciseId) ?? null,
    })),
  };
}

export const getSession = loadSession;

export async function getActiveSession(db: Db, userId: string): Promise<SessionDto | null> {
  const s = await db.workoutSession.findFirst({
    where: { userId, status: 'in_progress' },
    select: { id: true },
  });
  return s ? loadSession(db, userId, s.id) : null;
}

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Starts a session from a planned workout (exercises are snapshotted) or an
 * empty free session. Retrying with the same client id returns the same session.
 */
export async function startSession(
  db: Db,
  userId: string,
  input: { id?: string | undefined; workoutId?: string | null | undefined },
) {
  if (input.id) {
    const existing = await db.workoutSession.findFirst({
      where: { id: input.id },
      select: { userId: true },
    });
    if (existing) {
      if (existing.userId !== userId) throw conflict('ID_TAKEN', 'Session id already in use');
      return loadSession(db, userId, input.id);
    }
  }
  const active = await db.workoutSession.findFirst({
    where: { userId, status: 'in_progress' },
    select: { id: true },
  });
  if (active) {
    throw conflict('SESSION_IN_PROGRESS', 'Finish or cancel the current workout first', {
      sessionId: active.id,
    });
  }
  const workout = input.workoutId ? await ownedWorkout(db, userId, input.workoutId) : null;
  const planned = workout
    ? await db.workoutExercise.findMany({
        where: { workoutId: workout.id },
        orderBy: { position: 'asc' },
        include: { exercise: { select: { name: true } } },
      })
    : [];
  try {
    const session = await db.workoutSession.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        programId: workout?.programId ?? null,
        workoutId: workout?.id ?? null,
        programNameSnapshot: workout?.program.name ?? null,
        workoutNameSnapshot: workout?.name ?? null,
        exercises: {
          create: planned.map((p, position) => ({
            exerciseId: p.exerciseId,
            exerciseNameSnapshot: p.exercise.name,
            position,
            plannedSets: p.plannedSets,
            targetRepsMin: p.targetRepsMin,
            targetRepsMax: p.targetRepsMax,
            notes: p.notes,
          })),
        },
      },
    });
    return loadSession(db, userId, session.id);
  } catch (err) {
    // Two concurrent starts: the partial unique index lets only one win.
    if (isUniqueViolation(err)) {
      if (input.id) {
        const same = await db.workoutSession.findFirst({
          where: { id: input.id, userId },
          select: { id: true },
        });
        if (same) return loadSession(db, userId, same.id);
      }
      const winner = await db.workoutSession.findFirst({
        where: { userId, status: 'in_progress' },
        select: { id: true },
      });
      throw conflict('SESSION_IN_PROGRESS', 'Finish or cancel the current workout first', {
        sessionId: winner?.id,
      });
    }
    throw err;
  }
}

/** Results may be recorded during the workout and corrected later from history. */
function assertEditable(status: SessionStatus) {
  if (status === 'cancelled')
    throw conflict('SESSION_CANCELLED', 'Cancelled sessions are read-only');
}

export async function addSessionExercise(
  db: Db,
  userId: string,
  sessionId: string,
  input: { id?: string | undefined; exerciseId: string },
) {
  const session = await ownedSession(db, userId, sessionId);
  assertEditable(session.status);
  const exercise = await ownedExercise(db, userId, input.exerciseId);
  if (input.id) {
    const existing = await db.sessionExercise.findUnique({
      where: { id: input.id },
      select: { sessionId: true },
    });
    if (existing) {
      if (existing.sessionId !== sessionId) throw conflict('ID_TAKEN', 'Id already in use');
      return loadSession(db, userId, sessionId);
    }
  }
  const max = await db.sessionExercise.aggregate({
    where: { sessionId },
    _max: { position: true },
  });
  try {
    await db.sessionExercise.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        sessionId,
        exerciseId: exercise.id,
        exerciseNameSnapshot: exercise.name,
        position: (max._max.position ?? -1) + 1,
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err; // concurrent retry already created it
  }
  return loadSession(db, userId, sessionId);
}

export async function removeSessionExercise(
  db: Db,
  userId: string,
  sessionId: string,
  sessionExerciseId: string,
) {
  const session = await ownedSession(db, userId, sessionId);
  assertEditable(session.status);
  const deleted = await db.sessionExercise.deleteMany({
    where: { id: sessionExerciseId, sessionId },
  });
  if (deleted.count === 0) throw notFound('Session exercise');
  return loadSession(db, userId, sessionId);
}

/**
 * PUT semantics with a client-generated id: the first call creates the set,
 * retries and later edits replace it. A retried request can never create a
 * duplicate row.
 */
export async function upsertSet(
  db: Db,
  userId: string,
  sessionId: string,
  setId: string,
  input: z.output<typeof setUpsertSchema>,
): Promise<{ set: SetDto; created: boolean }> {
  const session = await ownedSession(db, userId, sessionId);
  assertEditable(session.status);
  const sessionExercise = await db.sessionExercise.findFirst({
    where: { id: input.sessionExerciseId, sessionId },
    select: { id: true },
  });
  if (!sessionExercise) throw notFound('Session exercise');

  const data = {
    setNumber: input.setNumber,
    weightKg: new Prisma.Decimal(input.weightKg.toFixed(2)),
    reps: input.reps,
    status: input.status,
  };

  const write = async (): Promise<{ set: SetRow; created: boolean }> => {
    const existing = await db.exerciseSet.findUnique({
      where: { id: setId },
      select: { sessionExercise: { select: { sessionId: true } } },
    });
    if (existing) {
      if (existing.sessionExercise.sessionId !== sessionId) throw notFound('Set');
      const set = await db.exerciseSet.update({
        where: { id: setId },
        data: { ...data, sessionExerciseId: sessionExercise.id },
      });
      return { set, created: false };
    }
    const agg = await db.exerciseSet.aggregate({
      where: { sessionExerciseId: sessionExercise.id },
      _count: true,
      _max: { setNumber: true },
    });
    if (agg._count >= MAX_SETS_PER_EXERCISE)
      throw conflict('TOO_MANY_SETS', `At most ${MAX_SETS_PER_EXERCISE} sets per exercise`);
    // A new set whose number is already taken (stale client, second device) goes to the end.
    const taken = await db.exerciseSet.count({
      where: { sessionExerciseId: sessionExercise.id, setNumber: data.setNumber },
    });
    const setNumber = taken > 0 ? (agg._max.setNumber ?? 0) + 1 : data.setNumber;
    const set = await db.exerciseSet.create({
      data: { ...data, setNumber, id: setId, sessionExerciseId: sessionExercise.id },
    });
    return { set, created: true };
  };

  try {
    const r = await write();
    return { set: toSetDto(r.set), created: r.created };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const r = await write(); // a concurrent duplicate created it first -> update
    return { set: toSetDto(r.set), created: false };
  }
}

/** Idempotent: deleting an already-deleted set succeeds. Remaining sets are renumbered 1..n. */
export async function deleteSet(db: Db, userId: string, sessionId: string, setId: string) {
  const session = await ownedSession(db, userId, sessionId);
  assertEditable(session.status);
  const existing = await db.exerciseSet.findUnique({
    where: { id: setId },
    select: { sessionExerciseId: true, sessionExercise: { select: { sessionId: true } } },
  });
  if (!existing) return;
  if (existing.sessionExercise.sessionId !== sessionId) throw notFound('Set');
  await db.$transaction(async (tx) => {
    await tx.exerciseSet.delete({ where: { id: setId } });
    const rest = await tx.exerciseSet.findMany({
      where: { sessionExerciseId: existing.sessionExerciseId },
      orderBy: [{ setNumber: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, setNumber: true },
    });
    for (const [i, s] of rest.entries()) {
      if (s.setNumber !== i + 1)
        await tx.exerciseSet.update({ where: { id: s.id }, data: { setNumber: i + 1 } });
    }
  });
}

export async function completeSession(
  db: Db,
  userId: string,
  sessionId: string,
  confirmIncomplete: boolean,
) {
  const s = await db.workoutSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionInclude,
  });
  if (!s) throw notFound('Session');
  if (s.status === 'completed') return loadSession(db, userId, sessionId); // idempotent retry
  if (s.status === 'cancelled')
    throw conflict('SESSION_CANCELLED', 'Cancelled sessions cannot be completed');

  const unfinished = s.exercises
    .map((e) => ({
      sessionExerciseId: e.id,
      name: e.exerciseNameSnapshot,
      planned: e.plannedSets ?? 0,
      recorded: e.sets.length,
    }))
    .filter((e) => e.recorded < Math.max(e.planned, 1));
  if (unfinished.length > 0 && !confirmIncomplete) {
    throw conflict('INCOMPLETE_SESSION', 'Some exercises have unrecorded sets', { unfinished });
  }
  const updated = await db.workoutSession.updateMany({
    where: { id: sessionId, status: 'in_progress' },
    data: { status: 'completed', completedAt: new Date() },
  });
  if (updated.count === 0) {
    const now = await ownedSession(db, userId, sessionId);
    if (now.status !== 'completed') throw conflict('INVALID_STATUS', `Session is ${now.status}`);
  }
  return loadSession(db, userId, sessionId);
}

/** Cancelling keeps the record (status=cancelled) but it never counts as a completed workout. */
export async function cancelSession(db: Db, userId: string, sessionId: string) {
  const s = await ownedSession(db, userId, sessionId);
  if (s.status === 'cancelled') return loadSession(db, userId, sessionId);
  if (s.status === 'completed')
    throw conflict('SESSION_COMPLETED', 'Completed sessions cannot be cancelled; delete instead');
  await db.workoutSession.updateMany({
    where: { id: sessionId, status: 'in_progress' },
    data: { status: 'cancelled' },
  });
  return loadSession(db, userId, sessionId);
}

export async function deleteSession(db: Db, userId: string, sessionId: string) {
  const deleted = await db.workoutSession.deleteMany({ where: { id: sessionId, userId } });
  if (deleted.count === 0) throw notFound('Session');
}

export function toListItem(s: SessionRow): SessionListItemDto {
  return {
    id: s.id,
    status: s.status,
    programName: s.programNameSnapshot,
    workoutName: s.workoutNameSnapshot,
    startedAt: s.startedAt.toISOString(),
    completedAt: iso(s.completedAt),
    exerciseNames: s.exercises.filter((e) => e.sets.length > 0).map((e) => e.exerciseNameSnapshot),
    summary: summaryOf(s),
  };
}

export async function listSessions(
  db: Db,
  userId: string,
  q: z.output<typeof sessionListQuerySchema>,
): Promise<Paginated<SessionListItemDto>> {
  const limit = q.limit ?? 20;
  const status = q.status ?? 'completed';
  const rows = await db.workoutSession.findMany({
    where: {
      userId,
      ...(status === 'all' ? { status: { not: 'in_progress' } } : { status }),
      startedAt: {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lt: new Date(q.to) } : {}),
      },
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    include: sessionInclude,
    take: limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { items: page.map(toListItem), nextCursor: hasMore ? page[page.length - 1]!.id : null };
}

export { sessionInclude };
