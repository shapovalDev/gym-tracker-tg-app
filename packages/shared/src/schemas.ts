import { z } from 'zod';
import {
  DESCRIPTION_MAX,
  MAX_SETS_PER_EXERCISE,
  MUSCLE_GROUPS,
  NAME_MAX,
  PERIODS,
  REPS_MAX,
  SESSION_STATUSES,
  SET_STATUSES,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from './constants';
import { roundWeightKg } from './domain/weight';

/** Request validation schemas shared by the API (enforcement) and the web app (forms). */

export const idSchema = z.uuid();
const name = z.string().trim().min(1, 'Required').max(NAME_MAX);
const optionalText = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX)
  .nullish()
  .transform((v) => (v ? v : null));

export const muscleGroupSchema = z.enum(MUSCLE_GROUPS);
export const sessionStatusSchema = z.enum(SESSION_STATUSES);
export const setStatusSchema = z.enum(SET_STATUSES);
export const periodSchema = z.enum(PERIODS);

export const weightKgSchema = z
  .number()
  .min(WEIGHT_MIN_KG, 'Weight cannot be negative')
  .max(WEIGHT_MAX_KG)
  .transform(roundWeightKg);
export const repsSchema = z.number().int('Reps must be a whole number').min(0).max(REPS_MAX);

// ---- Exercises -------------------------------------------------------------
export const exerciseCreateSchema = z.object({
  name,
  muscleGroup: muscleGroupSchema.nullish().transform((v) => v ?? null),
  description: optionalText,
});
export const exerciseUpdateSchema = exerciseCreateSchema.partial();
export const exerciseListQuerySchema = z.object({
  search: z.string().trim().max(NAME_MAX).optional(),
  muscleGroup: muscleGroupSchema.optional(),
  archived: z.enum(['true', 'false']).optional(),
});

// ---- Programs --------------------------------------------------------------
export const programCreateSchema = z.object({
  name,
  description: optionalText,
  /** Optional initial workouts, e.g. ["A", "B", "C", "D"]. Any count is allowed. */
  workouts: z.array(name).max(50).optional(),
});
export const programUpdateSchema = z.object({
  name: name.optional(),
  description: optionalText.optional(),
});
export const programListQuerySchema = z.object({ archived: z.enum(['true', 'false']).optional() });

export const workoutCreateSchema = z.object({ name });
export const workoutUpdateSchema = z.object({ name });
export const reorderSchema = z.object({ ids: z.array(idSchema).min(1).max(200) });

const plannedFields = {
  plannedSets: z
    .number()
    .int()
    .min(1)
    .max(MAX_SETS_PER_EXERCISE)
    .nullish()
    .transform((v) => v ?? null),
  targetRepsMin: z
    .number()
    .int()
    .min(1)
    .max(REPS_MAX)
    .nullish()
    .transform((v) => v ?? null),
  targetRepsMax: z
    .number()
    .int()
    .min(1)
    .max(REPS_MAX)
    .nullish()
    .transform((v) => v ?? null),
  notes: optionalText,
};
const repRangeValid = (v: { targetRepsMin?: number | null; targetRepsMax?: number | null }) =>
  v.targetRepsMin == null || v.targetRepsMax == null || v.targetRepsMin <= v.targetRepsMax;
const repRangeMessage = {
  message: 'Minimum reps must not exceed maximum reps',
  path: ['targetRepsMax'],
};

export const workoutExerciseCreateSchema = z
  .object({ exerciseId: idSchema, ...plannedFields })
  .refine(repRangeValid, repRangeMessage);
export const workoutExerciseUpdateSchema = z
  .object({
    plannedSets: plannedFields.plannedSets.optional(),
    targetRepsMin: plannedFields.targetRepsMin.optional(),
    targetRepsMax: plannedFields.targetRepsMax.optional(),
    notes: plannedFields.notes.optional(),
  })
  .refine(repRangeValid, repRangeMessage);

// ---- Sessions --------------------------------------------------------------
export const sessionStartSchema = z.object({
  /** Client-generated id makes "start" idempotent on retries. */
  id: idSchema.optional(),
  /** Omit for a free workout not linked to a program. */
  workoutId: idSchema.nullish(),
});
export const sessionExerciseAddSchema = z.object({ id: idSchema.optional(), exerciseId: idSchema });
export const sessionCompleteSchema = z.object({
  /** Confirms completion even if some planned sets are not recorded. */
  confirmIncomplete: z.boolean().optional(),
});

/** PUT /sessions/:sessionId/sets/:setId — create-or-replace, safe to retry. */
export const setUpsertSchema = z
  .object({
    sessionExerciseId: idSchema,
    setNumber: z.number().int().min(1).max(MAX_SETS_PER_EXERCISE),
    weightKg: weightKgSchema,
    reps: repsSchema,
    status: setStatusSchema,
  })
  .refine((s) => s.status !== 'completed' || s.reps >= 1, {
    message: 'A completed set needs at least 1 repetition',
    path: ['reps'],
  });

export const sessionListQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(['completed', 'cancelled', 'all']).optional(),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// ---- Analytics -------------------------------------------------------------
export const analyticsQuerySchema = z.object({
  period: periodSchema.default('90d'),
  weightKg: z.coerce.number().min(0).max(WEIGHT_MAX_KG).optional(),
});
export const summaryQuerySchema = z.object({ period: periodSchema.default('30d') });

export type ExerciseCreateInput = z.input<typeof exerciseCreateSchema>;
export type ExerciseUpdateInput = z.input<typeof exerciseUpdateSchema>;
export type ProgramCreateInput = z.input<typeof programCreateSchema>;
export type ProgramUpdateInput = z.input<typeof programUpdateSchema>;
export type WorkoutExerciseCreateInput = z.input<typeof workoutExerciseCreateSchema>;
export type WorkoutExerciseUpdateInput = z.input<typeof workoutExerciseUpdateSchema>;
export type SetUpsertInput = z.input<typeof setUpsertSchema>;
export type SessionListQuery = z.input<typeof sessionListQuerySchema>;
