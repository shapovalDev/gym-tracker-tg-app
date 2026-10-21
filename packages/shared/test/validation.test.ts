import { describe, expect, it } from 'vitest';
import {
  filterByDateRange,
  parseWeightInput,
  periodRange,
  previousPeriodRange,
  roundWeightKg,
  setUpsertSchema,
  workoutExerciseCreateSchema,
} from '../src';

const base = {
  sessionExerciseId: '6f1c1d0e-8d2a-4b8e-9a51-1b1c2d3e4f50',
  setNumber: 1,
  weightKg: 22.5,
  reps: 10,
  status: 'completed' as const,
};

describe('set validation', () => {
  it('accepts a valid completed set with decimal weight', () => {
    expect(setUpsertSchema.parse(base).weightKg).toBe(22.5);
  });
  it('rounds weight to 0.01 kg', () => {
    expect(setUpsertSchema.parse({ ...base, weightKg: 22.555 }).weightKg).toBe(22.56);
    expect(roundWeightKg(1.005)).toBe(1.01);
  });
  it('rejects negative values', () => {
    expect(setUpsertSchema.safeParse({ ...base, weightKg: -1 }).success).toBe(false);
    expect(setUpsertSchema.safeParse({ ...base, reps: -1 }).success).toBe(false);
  });
  it('rejects fractional reps', () => {
    expect(setUpsertSchema.safeParse({ ...base, reps: 2.5 }).success).toBe(false);
  });
  it('requires at least one rep for a completed set', () => {
    expect(setUpsertSchema.safeParse({ ...base, reps: 0 }).success).toBe(false);
    expect(setUpsertSchema.safeParse({ ...base, reps: 0, status: 'skipped' }).success).toBe(true);
  });
  it('rejects unrealistic weights', () => {
    expect(setUpsertSchema.safeParse({ ...base, weightKg: 1000.01 }).success).toBe(false);
  });
  it('validates target rep ranges', () => {
    const exerciseId = base.sessionExerciseId;
    expect(
      workoutExerciseCreateSchema.safeParse({ exerciseId, targetRepsMin: 12, targetRepsMax: 8 })
        .success,
    ).toBe(false);
    expect(
      workoutExerciseCreateSchema.safeParse({ exerciseId, targetRepsMin: 8, targetRepsMax: 12 })
        .success,
    ).toBe(true);
  });
});

describe('parseWeightInput', () => {
  it('parses comma and dot decimals', () => {
    expect(parseWeightInput('22,5')).toBe(22.5);
    expect(parseWeightInput('40')).toBe(40);
  });
  it('rejects invalid input', () => {
    expect(parseWeightInput('')).toBeNull();
    expect(parseWeightInput('-5')).toBeNull();
    expect(parseWeightInput('abc')).toBeNull();
    expect(parseWeightInput('2000')).toBeNull();
  });
});

describe('date ranges', () => {
  const now = new Date('2026-04-01T00:00:00Z');
  it('computes period and previous period', () => {
    const r = periodRange('30d', now);
    expect(r.from?.toISOString()).toBe('2026-03-02T00:00:00.000Z');
    const p = previousPeriodRange('30d', now)!;
    expect(p.to.toISOString()).toBe('2026-03-02T00:00:00.000Z');
    expect(p.from?.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(previousPeriodRange('all', now)).toBeNull();
    expect(periodRange('all', now).from).toBeNull();
  });
  it('filters items by inclusive-from / exclusive-to range', () => {
    const items = ['2026-03-01', '2026-03-02', '2026-03-15', '2026-04-01'].map(
      (d) => new Date(`${d}T00:00:00Z`),
    );
    const out = filterByDateRange(items, (d) => d, periodRange('30d', now));
    expect(out.map((d) => d.toISOString().slice(0, 10))).toEqual(['2026-03-02', '2026-03-15']);
  });
});
