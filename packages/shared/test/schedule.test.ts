import { describe, expect, it } from 'vitest';
import {
  currentWeek,
  hasDistinctWeekdays,
  localDay,
  nextScheduledWorkoutId,
  orderBySchedule,
  programCreateSchema,
  weekdayOf,
} from '../src';

describe('schedule', () => {
  it('orders scheduled workouts by day, unscheduled ones after, stable', () => {
    const items = [
      { name: 'Fri', weekday: 4 },
      { name: 'Free 1', weekday: null },
      { name: 'Mon', weekday: 0 },
      { name: 'Free 2' },
      { name: 'Wed', weekday: 2 },
    ];
    expect(orderBySchedule(items).map((w) => w.name)).toEqual([
      'Mon',
      'Wed',
      'Fri',
      'Free 1',
      'Free 2',
    ]);
  });

  it('detects two workouts on the same day', () => {
    expect(hasDistinctWeekdays([{ weekday: 1 }, { weekday: null }, { weekday: null }])).toBe(true);
    expect(hasDistinctWeekdays([{ weekday: 1 }, { weekday: 1 }])).toBe(false);
  });

  it('uses Monday-based days', () => {
    expect(weekdayOf(new Date(2026, 9, 26))).toBe(0); // Monday
    expect(weekdayOf(new Date(2026, 10, 1))).toBe(6); // Sunday
  });

  it('accepts plain names and scheduled workouts, rejects duplicate days', () => {
    const ok = programCreateSchema.parse({ name: 'P', workouts: ['A', { name: 'B', weekday: 3 }] });
    expect(ok.workouts).toEqual([
      { name: 'A', weekday: null },
      { name: 'B', weekday: 3 },
    ]);
    const dup = programCreateSchema.safeParse({
      name: 'P',
      workouts: [
        { name: 'A', weekday: 3 },
        { name: 'B', weekday: 3 },
      ],
    });
    expect(dup.success).toBe(false);
    expect(
      programCreateSchema.safeParse({ name: 'P', workouts: [{ name: 'A', weekday: 7 }] }).success,
    ).toBe(false);
  });
});

describe('currentWeek', () => {
  it('builds Monday..Sunday with done and planned days', () => {
    const now = new Date(2026, 9, 30, 12); // Friday 30 Oct 2026
    const week = currentWeek(
      now,
      [
        { startedAt: new Date(2026, 9, 25, 19).toISOString(), position: 1 }, // previous Sunday: outside
        { startedAt: new Date(2026, 9, 26, 19).toISOString(), position: 0 }, // Monday
        { startedAt: new Date(2026, 9, 28, 8).toISOString(), position: null }, // Wednesday, free workout
      ],
      [
        { weekday: 0, position: 0 },
        { weekday: 4, position: 2 },
      ],
    );
    expect(week.map((d) => d.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(week.map((d) => d.donePosition)).toEqual([0, null, -1, null, null, null, null]);
    expect(week.map((d) => d.plannedPosition)).toEqual([0, null, null, null, 2, null, null]);
    expect(week.findIndex((d) => d.isToday)).toBe(4);
  });
});

describe('next workout by the calendar', () => {
  const w = [
    { id: 'mon', weekday: 0 },
    { id: 'wed', weekday: 2 },
    { id: 'fri', weekday: 4 },
    { id: 'free', weekday: null },
  ];

  it("picks today's workout until something is done today", () => {
    expect(nextScheduledWorkoutId(w, 2, false)).toBe('wed');
    expect(nextScheduledWorkoutId(w, 2, true)).toBe('fri');
  });

  it('skips rest days and wraps to next week', () => {
    expect(nextScheduledWorkoutId(w, 1, false)).toBe('wed'); // Tuesday
    expect(nextScheduledWorkoutId(w, 5, false)).toBe('mon'); // Saturday
    expect(nextScheduledWorkoutId([{ id: 'only', weekday: 3 }], 3, true)).toBe('only');
  });

  it('returns null without a schedule', () => {
    expect(nextScheduledWorkoutId([{ id: 'a' }, { id: 'b', weekday: null }], 0, false)).toBeNull();
  });

  it('turns a local date into UTC bounds', () => {
    const kyiv = localDay('2026-10-30', 120);
    expect(kyiv.weekday).toBe(4);
    expect(kyiv.start.toISOString()).toBe('2026-10-29T22:00:00.000Z');
    expect(kyiv.end.toISOString()).toBe('2026-10-30T22:00:00.000Z');
    expect(localDay('2026-11-01', -300).start.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
});
