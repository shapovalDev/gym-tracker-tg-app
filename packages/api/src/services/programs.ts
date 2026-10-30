import {
  isPermutation,
  nextScheduledWorkoutId,
  nextWorkoutId,
  orderBySchedule,
  type ProgramDto,
  type ProgramSummaryDto,
  type WorkoutExerciseDto,
  type programCreateSchema,
  type programUpdateSchema,
  type workoutExerciseCreateSchema,
  type workoutExerciseUpdateSchema,
  type workoutUpdateSchema,
} from '@gym/shared';
import type { z } from 'zod';
import type { Db } from '../db';
import { clientToday } from '../http/client-day';
import { badRequest, conflict, notFound } from '../http/errors';
import {
  applyOrder,
  iso,
  ownedExercise,
  ownedProgram,
  ownedWorkout,
  ownedWorkoutExercise,
  type DbOrTx,
} from './common';

const workoutInclude = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: {
      exercise: {
        select: { id: true, name: true, muscleGroup: true, description: true, archivedAt: true },
      },
    },
  },
};

type WorkoutExerciseRow = {
  id: string;
  exerciseId: string;
  position: number;
  plannedSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  notes: string | null;
  exercise: {
    id: string;
    name: string;
    muscleGroup: WorkoutExerciseDto['exercise']['muscleGroup'];
    description: string | null;
    archivedAt: Date | null;
  };
};

function toWorkoutExerciseDto(we: WorkoutExerciseRow): WorkoutExerciseDto {
  return {
    id: we.id,
    exerciseId: we.exerciseId,
    exercise: { ...we.exercise, archivedAt: iso(we.exercise.archivedAt) },
    position: we.position,
    plannedSets: we.plannedSets,
    targetRepsMin: we.targetRepsMin,
    targetRepsMax: we.targetRepsMax,
    notes: we.notes,
  };
}

/** See packages/shared/src/domain/cycle.ts for the rules. */
export async function computeNextWorkoutId(
  db: DbOrTx,
  programId: string,
  workouts: { id: string; position: number; weekday: number | null }[],
): Promise<string | null> {
  // pinned days: the calendar decides (see nextScheduledWorkoutId)
  if (workouts.some((w) => w.weekday != null)) {
    const today = clientToday();
    const doneToday = await db.workoutSession.count({
      where: { programId, status: 'completed', startedAt: { gte: today.start, lt: today.end } },
    });
    const scheduled = nextScheduledWorkoutId(workouts, today.weekday, doneToday > 0);
    if (scheduled) return scheduled;
  }
  const last = await db.workoutSession.findFirst({
    where: { programId, status: 'completed' },
    orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
    select: { workoutId: true },
  });
  return nextWorkoutId(workouts, last?.workoutId ?? null);
}

export async function listPrograms(db: Db, userId: string, includeArchived: boolean) {
  const rows = await db.trainingProgram.findMany({
    where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [
      { isActive: 'desc' },
      { archivedAt: { sort: 'asc', nulls: 'first' } },
      { updatedAt: 'desc' },
    ],
    include: { _count: { select: { workouts: true } } },
  });
  const items: ProgramSummaryDto[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    archivedAt: iso(p.archivedAt),
    workoutCount: p._count.workouts,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
  return { items };
}

export async function getProgram(
  db: DbOrTx,
  userId: string,
  programId: string,
): Promise<ProgramDto> {
  const p = await db.trainingProgram.findFirst({
    where: { id: programId, userId },
    include: { workouts: { orderBy: { position: 'asc' }, include: workoutInclude } },
  });
  if (!p) throw notFound('Program');
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    archivedAt: iso(p.archivedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    nextWorkoutId: await computeNextWorkoutId(db, p.id, p.workouts),
    workouts: p.workouts.map((w) => ({
      id: w.id,
      programId: w.programId,
      name: w.name,
      position: w.position,
      weekday: w.weekday,
      exercises: w.exercises.map(toWorkoutExerciseDto),
    })),
  };
}

export async function createProgram(
  db: Db,
  userId: string,
  input: z.output<typeof programCreateSchema>,
) {
  const id = await db.$transaction(async (tx) => {
    const hasActive = await tx.trainingProgram.count({ where: { userId, isActive: true } });
    const program = await tx.trainingProgram.create({
      data: {
        userId,
        name: input.name,
        description: input.description,
        isActive: hasActive === 0, // first program becomes active automatically
        // a cycle with pinned days follows the calendar
        workouts: {
          create: orderBySchedule(input.workouts ?? []).map((w, position) => ({ ...w, position })),
        },
      },
    });
    return program.id;
  });
  return getProgram(db, userId, id);
}

export async function updateProgram(
  db: Db,
  userId: string,
  programId: string,
  input: z.output<typeof programUpdateSchema>,
) {
  await ownedProgram(db, userId, programId);
  await db.trainingProgram.update({ where: { id: programId }, data: input });
  return getProgram(db, userId, programId);
}

export async function activateProgram(db: Db, userId: string, programId: string) {
  await db.$transaction(async (tx) => {
    const program = await ownedProgram(tx, userId, programId);
    if (program.archivedAt)
      throw conflict('PROGRAM_ARCHIVED', 'Unarchive the program before activating it');
    await tx.trainingProgram.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    await tx.trainingProgram.update({ where: { id: programId }, data: { isActive: true } });
  });
  return getProgram(db, userId, programId);
}

export async function setProgramArchived(
  db: Db,
  userId: string,
  programId: string,
  archived: boolean,
) {
  await ownedProgram(db, userId, programId);
  // Archiving keeps all workouts and sessions; it only hides the program and deactivates it.
  await db.trainingProgram.update({
    where: { id: programId },
    data: archived ? { archivedAt: new Date(), isActive: false } : { archivedAt: null },
  });
  return getProgram(db, userId, programId);
}

export async function duplicateProgram(db: Db, userId: string, programId: string, name?: string) {
  const source = await getProgram(db, userId, programId);
  const id = await db.$transaction(async (tx) => {
    const copy = await tx.trainingProgram.create({
      data: {
        userId,
        name: name ?? copyName(source.name),
        description: source.description,
        isActive: false,
      },
    });
    for (const w of source.workouts) {
      await tx.programWorkout.create({
        data: {
          programId: copy.id,
          name: w.name,
          position: w.position,
          weekday: w.weekday,
          exercises: { create: w.exercises.map(copyPlannedExercise) },
        },
      });
    }
    return copy.id;
  });
  return getProgram(db, userId, id);
}

/** Fallback when the client does not send a (localised) name for the copy. */
const copyName = (name: string) => `${name} (copy)`.slice(0, 100);
const copyPlannedExercise = (e: WorkoutExerciseDto) => ({
  exerciseId: e.exerciseId,
  position: e.position,
  plannedSets: e.plannedSets,
  targetRepsMin: e.targetRepsMin,
  targetRepsMax: e.targetRepsMax,
  notes: e.notes,
});

// ---- Workouts inside a program ---------------------------------------------

export async function addWorkout(db: Db, userId: string, programId: string, name: string) {
  await db.$transaction(async (tx) => {
    await ownedProgram(tx, userId, programId);
    const max = await tx.programWorkout.aggregate({
      where: { programId },
      _max: { position: true },
    });
    await tx.programWorkout.create({
      data: { programId, name, position: (max._max.position ?? -1) + 1 },
    });
  });
  return getProgram(db, userId, programId);
}

/** Renames a workout and, when `weekday` is sent, moves it to that day (null clears it). */
export async function updateWorkout(
  db: Db,
  userId: string,
  workoutId: string,
  input: z.output<typeof workoutUpdateSchema>,
) {
  const w = await ownedWorkout(db, userId, workoutId);
  if (input.weekday != null) {
    const taken = await db.programWorkout.count({
      where: { programId: w.programId, weekday: input.weekday, id: { not: workoutId } },
    });
    if (taken) throw conflict('WEEKDAY_TAKEN', 'Another workout is already planned for this day');
  }
  await db.programWorkout.update({
    where: { id: workoutId },
    data: { name: input.name, ...(input.weekday !== undefined && { weekday: input.weekday }) },
  });
  return getProgram(db, userId, w.programId);
}

/**
 * Deleting a planned workout keeps its sessions (workoutId -> NULL, name kept
 * in the snapshot). If it was the last completed workout, the cycle restarts
 * from the first workout.
 */
export async function deleteWorkout(db: Db, userId: string, workoutId: string) {
  const w = await ownedWorkout(db, userId, workoutId);
  await db.$transaction(async (tx) => {
    await tx.programWorkout.delete({ where: { id: workoutId } });
    const rest = await tx.programWorkout.findMany({
      where: { programId: w.programId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await applyOrder(
      tx,
      'ProgramWorkout',
      w.programId,
      rest.map((r) => r.id),
    );
  });
  return getProgram(db, userId, w.programId);
}

export async function reorderWorkouts(db: Db, userId: string, programId: string, ids: string[]) {
  await db.$transaction(async (tx) => {
    await ownedProgram(tx, userId, programId);
    const existing = await tx.programWorkout.findMany({
      where: { programId },
      select: { id: true },
    });
    if (
      !isPermutation(
        ids,
        existing.map((e) => e.id),
      )
    ) {
      throw badRequest('ids must contain every workout of the program exactly once');
    }
    await applyOrder(tx, 'ProgramWorkout', programId, ids);
  });
  return getProgram(db, userId, programId);
}

export async function duplicateWorkout(db: Db, userId: string, workoutId: string, name?: string) {
  const w = await ownedWorkout(db, userId, workoutId);
  await db.$transaction(async (tx) => {
    const source = await tx.programWorkout.findUniqueOrThrow({
      where: { id: workoutId },
      include: { exercises: { orderBy: { position: 'asc' } } },
    });
    const max = await tx.programWorkout.aggregate({
      where: { programId: w.programId },
      _max: { position: true },
    });
    await tx.programWorkout.create({
      data: {
        programId: w.programId,
        name: name ?? copyName(source.name),
        position: (max._max.position ?? -1) + 1,
        exercises: {
          create: source.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            position: e.position,
            plannedSets: e.plannedSets,
            targetRepsMin: e.targetRepsMin,
            targetRepsMax: e.targetRepsMax,
            notes: e.notes,
          })),
        },
      },
    });
  });
  return getProgram(db, userId, w.programId);
}

// ---- Planned exercises inside a workout -----------------------------------

export async function addWorkoutExercise(
  db: Db,
  userId: string,
  workoutId: string,
  input: z.output<typeof workoutExerciseCreateSchema>,
) {
  const w = await ownedWorkout(db, userId, workoutId);
  const exercise = await ownedExercise(db, userId, input.exerciseId);
  if (exercise.archivedAt)
    throw conflict('EXERCISE_ARCHIVED', 'Archived exercises cannot be added');
  await db.$transaction(async (tx) => {
    const max = await tx.workoutExercise.aggregate({
      where: { workoutId },
      _max: { position: true },
    });
    await tx.workoutExercise.create({
      data: { ...input, workoutId, position: (max._max.position ?? -1) + 1 },
    });
  });
  return getProgram(db, userId, w.programId);
}

export async function updateWorkoutExercise(
  db: Db,
  userId: string,
  id: string,
  input: z.output<typeof workoutExerciseUpdateSchema>,
) {
  const item = await ownedWorkoutExercise(db, userId, id);
  const merged = { ...item, ...input };
  if (
    merged.targetRepsMin != null &&
    merged.targetRepsMax != null &&
    merged.targetRepsMin > merged.targetRepsMax
  ) {
    throw badRequest('Minimum reps must not exceed maximum reps');
  }
  await db.workoutExercise.update({ where: { id }, data: input });
  const w = await ownedWorkout(db, userId, item.workoutId);
  return getProgram(db, userId, w.programId);
}

export async function deleteWorkoutExercise(db: Db, userId: string, id: string) {
  const item = await ownedWorkoutExercise(db, userId, id);
  const w = await ownedWorkout(db, userId, item.workoutId);
  await db.$transaction(async (tx) => {
    await tx.workoutExercise.delete({ where: { id } });
    const rest = await tx.workoutExercise.findMany({
      where: { workoutId: item.workoutId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await applyOrder(
      tx,
      'WorkoutExercise',
      item.workoutId,
      rest.map((r) => r.id),
    );
  });
  return getProgram(db, userId, w.programId);
}

export async function reorderWorkoutExercises(
  db: Db,
  userId: string,
  workoutId: string,
  ids: string[],
) {
  const w = await ownedWorkout(db, userId, workoutId);
  await db.$transaction(async (tx) => {
    const existing = await tx.workoutExercise.findMany({
      where: { workoutId },
      select: { id: true },
    });
    if (
      !isPermutation(
        ids,
        existing.map((e) => e.id),
      )
    ) {
      throw badRequest('ids must contain every exercise of the workout exactly once');
    }
    await applyOrder(tx, 'WorkoutExercise', workoutId, ids);
  });
  return getProgram(db, userId, w.programId);
}
