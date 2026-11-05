import { describe, expect, it } from 'vitest';
import {
  distinctWorkingWeights,
  epleyE1rm,
  isWorkingSet,
  percentChange,
  personalRecords,
  sessionPoints,
  summarizeSession,
  volumeKg,
  type MetricSet,
} from '../src';

const d1 = new Date('2026-01-01T10:00:00Z');
const d2 = new Date('2026-01-05T10:00:00Z');
const set = (p: Partial<MetricSet>): MetricSet => ({
  sessionId: 's1',
  date: d1,
  weightKg: 40,
  reps: 10,
  status: 'completed',
  ...p,
});

describe('volume', () => {
  it('sums weight × reps for completed sets only', () => {
    const sets = [
      set({ weightKg: 40, reps: 12 }),
      set({ weightKg: 45, reps: 10 }),
      set({ weightKg: 45, reps: 9 }),
      set({ weightKg: 50, reps: 6 }),
      set({ weightKg: 100, reps: 5, status: 'skipped' }),
    ];
    expect(volumeKg(sets)).toBe(40 * 12 + 45 * 10 + 45 * 9 + 50 * 6);
  });
  it('is exact for decimal weights', () => {
    expect(volumeKg([set({ weightKg: 22.5, reps: 3 }), set({ weightKg: 0.1, reps: 3 })])).toBe(
      67.8,
    );
  });
  it('ignores completed sets with zero reps', () => {
    expect(volumeKg([set({ reps: 0 })])).toBe(0);
    expect(isWorkingSet({ status: 'completed', reps: 0 })).toBe(false);
  });
});

describe('epleyE1rm', () => {
  it('applies weight × (1 + reps/30)', () => {
    expect(epleyE1rm(100, 10)).toBe(133.33);
    expect(epleyE1rm(60, 3)).toBe(66);
  });
  it('is not computed for invalid or non-comparable sets', () => {
    expect(epleyE1rm(0, 10)).toBeNull();
    expect(epleyE1rm(100, 0)).toBeNull();
    expect(epleyE1rm(100, 25)).toBeNull();
    expect(epleyE1rm(-5, 5)).toBeNull();
  });
});

describe('sessionPoints', () => {
  const sets = [
    set({ sessionId: 's2', date: d2, weightKg: 50, reps: 8 }),
    set({ sessionId: 's1', weightKg: 40, reps: 12 }),
    set({ sessionId: 's1', weightKg: 45, reps: 10 }),
    set({ sessionId: 's3', date: d2, status: 'skipped' }),
  ];
  it('creates one point per session with working sets, sorted by date, no gap filling', () => {
    const points = sessionPoints(sets, 45);
    expect(points.map((p) => p.sessionId)).toEqual(['s1', 's2']);
    expect(points[0]).toMatchObject({
      maxWeightKg: 45,
      totalReps: 22,
      volumeKg: 930,
      workingSets: 2,
      repsAtWeight: 10,
    });
    expect(points[1]!.repsAtWeight).toBeNull();
  });
});

describe('personalRecords', () => {
  it('finds best weight, e1RM, reps at weight and session volume', () => {
    const sets = [
      set({ sessionId: 's1', date: d1, weightKg: 100, reps: 5 }),
      set({ sessionId: 's1', date: d1, weightKg: 80, reps: 12 }),
      set({ sessionId: 's2', date: d2, weightKg: 100, reps: 6 }),
      set({ sessionId: 's2', date: d2, weightKg: 120, reps: 1, status: 'skipped' }),
    ];
    const r = personalRecords(sets, 100);
    expect(r.bestWeight).toMatchObject({ weightKg: 100, reps: 6, sessionId: 's2' });
    expect(r.bestE1rm).toMatchObject({ value: 120, sessionId: 's2' });
    expect(r.bestRepsAtWeight).toMatchObject({ value: 6, sessionId: 's2' });
    expect(r.bestSessionVolume).toMatchObject({ value: 1460, sessionId: 's1' });
  });
  it('returns empty records without data', () => {
    expect(personalRecords([])).toEqual({
      bestWeight: null,
      bestE1rm: null,
      bestRepsAtWeight: null,
      bestReps: null,
      leastWeight: null,
      longestDuration: null,
      bestSessionVolume: null,
    });
  });
});

describe('helpers', () => {
  it('lists distinct working weights descending', () => {
    expect(
      distinctWorkingWeights([
        set({ weightKg: 40 }),
        set({ weightKg: 42.5 }),
        set({ weightKg: 40 }),
      ]),
    ).toEqual([42.5, 40]);
  });
  it('computes percent change', () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(null, 5)).toBeNull();
  });
});

describe('summarizeSession', () => {
  it('summarizes duration, exercises, sets and volume', () => {
    const s = summarizeSession({
      startedAt: new Date('2026-01-01T10:00:00Z'),
      completedAt: new Date('2026-01-01T11:05:30Z'),
      exercises: [
        { sets: [set({ weightKg: 40, reps: 10 }), set({ status: 'skipped', reps: 0 })] },
        { sets: [] },
      ],
    });
    expect(s).toEqual({
      durationSeconds: 3930,
      exercisesCompleted: 1,
      totalSets: 1,
      skippedSets: 1,
      warmupSets: 0,
      volumeKg: 400,
    });
  });
  it('has no duration for unfinished or cancelled-without-finish sessions', () => {
    expect(
      summarizeSession({ startedAt: d1, completedAt: null, exercises: [] }).durationSeconds,
    ).toBeNull();
  });
});

describe('warm-up sets', () => {
  const warm = (p: Partial<MetricSet>) => set({ setType: 'warmup', ...p });
  it('are never working sets', () => {
    expect(isWorkingSet({ status: 'completed', reps: 10, setType: 'warmup' })).toBe(false);
    expect(isWorkingSet({ status: 'completed', reps: 10 })).toBe(true);
  });
  it('are excluded from volume, points and records', () => {
    const sets = [warm({ weightKg: 100, reps: 10 }), set({ weightKg: 50, reps: 10 })];
    expect(volumeKg(sets)).toBe(500);
    expect(sessionPoints(sets)[0]).toMatchObject({ maxWeightKg: 50, workingSets: 1 });
    expect(personalRecords(sets).bestWeight?.weightKg).toBe(50);
    expect(personalRecords([warm({ weightKg: 100 })]).bestWeight).toBeNull();
  });
  it('are counted separately in the session summary', () => {
    const s = summarizeSession({
      startedAt: d1,
      completedAt: d2,
      exercises: [{ sets: [warm({ weightKg: 20, reps: 15 }), set({ weightKg: 60, reps: 8 })] }],
    });
    expect(s).toMatchObject({ totalSets: 1, warmupSets: 1, volumeKg: 480, exercisesCompleted: 1 });
  });
});

describe('tracking types', () => {
  it('counts a timed set as working and keeps it out of volume', () => {
    const plank = set({ weightKg: 0, reps: 0, durationSec: 60, trackingType: 'duration' });
    expect(isWorkingSet(plank)).toBe(true);
    expect(isWorkingSet({ ...plank, durationSec: 0 })).toBe(false);
    expect(isWorkingSet({ ...plank, setType: 'warmup' })).toBe(false);
    expect(volumeKg([plank, set({ weightKg: 10, reps: 0, durationSec: 30 })])).toBe(0);
  });

  it('excludes counterweights and extra body-weight load from volume and e1RM', () => {
    const sets = [
      set({ weightKg: 30, reps: 8, trackingType: 'assisted' }),
      set({ weightKg: 10, reps: 6, trackingType: 'bodyweight' }),
      set({ weightKg: 50, reps: 5 }),
    ];
    expect(volumeKg(sets)).toBe(250);
    const [p] = sessionPoints(sets.slice(0, 2));
    expect(p!.bestE1rmKg).toBeNull();
    expect(personalRecords(sets.slice(0, 2)).bestE1rm).toBeNull();
    expect(
      summarizeSession({
        startedAt: d1,
        completedAt: d2,
        exercises: [{ trackingType: 'assisted', sets: [sets[0]!] }, { sets: [sets[2]!] }],
      }).volumeKg,
    ).toBe(250);
  });

  it('records the smallest counterweight, most reps and longest hold', () => {
    const assisted = [
      set({ sessionId: 'a', weightKg: 40, reps: 8, trackingType: 'assisted' }),
      set({ sessionId: 'b', date: d2, weightKg: 25, reps: 6, trackingType: 'assisted' }),
      set({ sessionId: 'b', date: d2, weightKg: 25, reps: 7, trackingType: 'assisted' }),
    ];
    const r = personalRecords(assisted);
    expect(r.leastWeight).toMatchObject({ weightKg: 25, reps: 7, sessionId: 'b' });
    expect(r.bestReps).toMatchObject({ reps: 8, sessionId: 'a' });
    const points = sessionPoints(assisted);
    expect(points.map((p) => [p.minWeightKg, p.maxReps])).toEqual([
      [40, 8],
      [25, 7],
    ]);

    const holds = [
      set({ reps: 0, weightKg: 0, durationSec: 45, trackingType: 'duration' }),
      set({ reps: 0, weightKg: 0, durationSec: 70, date: d2, sessionId: 's2' }),
    ];
    expect(personalRecords(holds).longestDuration).toMatchObject({ value: 70, sessionId: 's2' });
    expect(sessionPoints(holds).map((p) => p.maxDurationSec)).toEqual([45, 70]);
  });
});

describe('duration input', () => {
  it('parses colons, dots, commas and bare seconds; formats back', async () => {
    const { parseDurationInput, formatSeconds } = await import('../src');
    expect(['1:30', '1.30', '1,30', '90', ' 0:05 ', '1:02:05'].map(parseDurationInput)).toEqual([
      90, 90, 90, 90, 5, 3725,
    ]);
    expect(['', 'abc', '1:75', '1:2:3:4', '99999'].map(parseDurationInput)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    expect([75, 5, 3725, 0].map(formatSeconds)).toEqual(['1:15', '0:05', '1:02:05', '0:00']);
  });
});
