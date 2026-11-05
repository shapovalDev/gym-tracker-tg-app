export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
  'cardio',
  'other',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** UI languages. */
export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];

export const SESSION_STATUSES = ['in_progress', 'completed', 'cancelled'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SET_STATUSES = ['completed', 'skipped'] as const;
export type SetStatus = (typeof SET_STATUSES)[number];

/** Warm-up sets are shown but never counted in statistics. */
export const SET_TYPES = ['working', 'warmup'] as const;
export type SetType = (typeof SET_TYPES)[number];
export const SET_NOTE_MAX = 200;

/**
 * How an exercise is measured. The three rep-based types share storage
 * (weightKg + reps) and differ only in meaning of the weight:
 * - weight_reps: the load (bench press);
 * - bodyweight:  extra load on top of body weight, 0 = none (pull-ups);
 * - assisted:    the machine's counterweight, less is better (gravitron);
 * - duration:    time in durationSec, weightKg = extra load (plank).
 */
export const TRACKING_TYPES = ['weight_reps', 'bodyweight', 'assisted', 'duration'] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];
/** Longest timed set: 3 hours. */
export const DURATION_MAX_SEC = 3 * 3600;

export const PERIODS = ['30d', '90d', '1y', 'all'] as const;
export type Period = (typeof PERIODS)[number];

/** Weight rules (kg). Stored as NUMERIC(6,2). */
export const WEIGHT_MIN_KG = 0;
export const WEIGHT_MAX_KG = 1000;
export const REPS_MAX = 1000;
export const MAX_SETS_PER_EXERCISE = 50;
export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 2000;
