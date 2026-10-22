import type { ExerciseDto, ExerciseHistoryEntryDto } from '@gym/shared';
import type { z } from 'zod';
import type {
  exerciseCreateSchema,
  exerciseListQuerySchema,
  exerciseUpdateSchema,
} from '@gym/shared';
import type { Db } from '../db';
import type { Exercise } from '../generated/prisma/client';
import { decimalToNumber, iso, ownedExercise } from './common';

export function toExerciseDto(e: Exercise): ExerciseDto {
  return {
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup,
    description: e.description,
    archivedAt: iso(e.archivedAt),
    createdAt: e.createdAt.toISOString(),
  };
}

export async function listExercises(
  db: Db,
  userId: string,
  q: z.output<typeof exerciseListQuerySchema>,
) {
  const items = await db.exercise.findMany({
    where: {
      userId,
      ...(q.archived === 'true' ? {} : { archivedAt: null }),
      ...(q.muscleGroup ? { muscleGroup: q.muscleGroup } : {}),
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    },
    orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
    take: 500,
  });
  return { items: items.map(toExerciseDto) };
}

export async function getExercise(db: Db, userId: string, id: string) {
  return toExerciseDto(await ownedExercise(db, userId, id));
}

export async function createExercise(
  db: Db,
  userId: string,
  input: z.output<typeof exerciseCreateSchema>,
) {
  const e = await db.exercise.create({ data: { ...input, userId } });
  return toExerciseDto(e);
}

export async function updateExercise(
  db: Db,
  userId: string,
  id: string,
  input: z.output<typeof exerciseUpdateSchema>,
) {
  await ownedExercise(db, userId, id);
  // History uses exerciseId + name snapshots, so renaming never breaks analytics.
  const e = await db.exercise.update({ where: { id }, data: input });
  return toExerciseDto(e);
}

export async function setExerciseArchived(db: Db, userId: string, id: string, archived: boolean) {
  await ownedExercise(db, userId, id);
  const e = await db.exercise.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
  return toExerciseDto(e);
}

/**
 * Recent completed sessions of one exercise with every set (warm-ups and
 * comments included), newest first — the "exercise history" sheet.
 */
export async function exerciseHistory(
  db: Db,
  userId: string,
  exerciseId: string,
  limit: number,
): Promise<{ items: ExerciseHistoryEntryDto[] }> {
  await ownedExercise(db, userId, exerciseId);
  const rows = await db.sessionExercise.findMany({
    where: { exerciseId, session: { userId, status: 'completed' }, sets: { some: {} } },
    orderBy: [{ session: { startedAt: 'desc' } }, { position: 'asc' }],
    take: limit,
    include: {
      session: { select: { id: true, startedAt: true, workoutNameSnapshot: true } },
      sets: { orderBy: [{ setNumber: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  return {
    items: rows.map((r) => ({
      sessionId: r.session.id,
      date: r.session.startedAt.toISOString(),
      workoutName: r.session.workoutNameSnapshot,
      sets: r.sets.map((x) => ({
        setNumber: x.setNumber,
        weightKg: decimalToNumber(x.weightKg),
        reps: x.reps,
        status: x.status,
        setType: x.setType,
        note: x.note,
      })),
    })),
  };
}
