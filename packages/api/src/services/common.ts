import { Prisma } from '../generated/prisma/client';
import type { Db } from '../db';
import { notFound } from '../http/errors';

export type Tx = Prisma.TransactionClient;
export type DbOrTx = Db | Tx;

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
export const decimalToNumber = (d: Prisma.Decimal | number) =>
  typeof d === 'number' ? d : d.toNumber();

/**
 * Ownership helpers. Every nested lookup filters by the owning user through the
 * parent chain, and "not yours" is indistinguishable from "does not exist" (404).
 */
export async function ownedProgram(db: DbOrTx, userId: string, programId: string) {
  const program = await db.trainingProgram.findFirst({ where: { id: programId, userId } });
  if (!program) throw notFound('Program');
  return program;
}

export async function ownedWorkout(db: DbOrTx, userId: string, workoutId: string) {
  const workout = await db.programWorkout.findFirst({
    where: { id: workoutId, program: { userId } },
    include: { program: true },
  });
  if (!workout) throw notFound('Workout');
  return workout;
}

export async function ownedWorkoutExercise(db: DbOrTx, userId: string, id: string) {
  const item = await db.workoutExercise.findFirst({
    where: { id, workout: { program: { userId } } },
  });
  if (!item) throw notFound('Workout exercise');
  return item;
}

export async function ownedExercise(db: DbOrTx, userId: string, exerciseId: string) {
  const exercise = await db.exercise.findFirst({ where: { id: exerciseId, userId } });
  if (!exercise) throw notFound('Exercise');
  return exercise;
}

export async function ownedSession(db: DbOrTx, userId: string, sessionId: string) {
  const session = await db.workoutSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw notFound('Session');
  return session;
}

const ORDERED_TABLES = {
  ProgramWorkout: 'programId',
  WorkoutExercise: 'workoutId',
} as const;

/**
 * Rewrites positions to match `orderedIds` (0..n-1) without tripping the
 * UNIQUE(parent, position) constraint: first move everything to negative
 * positions, then assign the final ones in a single statement.
 * Must run inside a transaction.
 */
export async function applyOrder(
  tx: Tx,
  table: keyof typeof ORDERED_TABLES,
  parentId: string,
  orderedIds: string[],
) {
  const t = Prisma.raw(`"${table}"`);
  const parent = Prisma.raw(`"${ORDERED_TABLES[table]}"`);
  await tx.$executeRaw`UPDATE ${t} SET "position" = -1 - "position" WHERE ${parent} = ${parentId}::uuid`;
  if (orderedIds.length === 0) return;
  await tx.$executeRaw`
    UPDATE ${t} AS x SET "position" = (v.ord - 1)::int, "updatedAt" = now()
    FROM unnest(${orderedIds}::uuid[]) WITH ORDINALITY AS v(id, ord)
    WHERE x."id" = v.id AND x.${parent} = ${parentId}::uuid`;
}
