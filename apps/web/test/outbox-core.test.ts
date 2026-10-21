import type { SessionDto } from '@gym/shared';
import { describe, expect, it } from 'vitest';
import { applyPending, backoffMs, enqueue, isPendingSet, type OutboxOp } from '@/lib/outbox-core';

const body = (setNumber: number, weightKg = 40, reps = 10) => ({
  sessionExerciseId: 'se1',
  setNumber,
  weightKg,
  reps,
  status: 'completed' as const,
});
const put = (setId: string, n: number, w?: number): OutboxOp => ({
  kind: 'putSet',
  sessionId: 's1',
  setId,
  body: body(n, w),
  queuedAt: 1,
});
const del = (setId: string): OutboxOp => ({
  kind: 'deleteSet',
  sessionId: 's1',
  setId,
  queuedAt: 2,
});

const session: SessionDto = {
  id: 's1',
  status: 'in_progress',
  programId: null,
  workoutId: null,
  programName: null,
  workoutName: 'A',
  startedAt: '2026-01-01T10:00:00Z',
  completedAt: null,
  summary: {
    durationSeconds: null,
    exercisesCompleted: 0,
    totalSets: 0,
    skippedSets: 0,
    volumeKg: 0,
  },
  exercises: [
    {
      id: 'se1',
      exerciseId: 'e1',
      name: 'Жим',
      muscleGroup: null,
      position: 0,
      plannedSets: 3,
      targetRepsMin: null,
      targetRepsMax: null,
      notes: null,
      previous: null,
      sets: [
        {
          id: 'a',
          sessionExerciseId: 'se1',
          setNumber: 1,
          weightKg: 40,
          reps: 10,
          status: 'completed',
          updatedAt: '',
        },
      ],
    },
  ],
};

describe('outbox queue', () => {
  it('collapses pending ops for the same set to the latest intent', () => {
    let q = enqueue([], put('x', 1, 40));
    q = enqueue(q, put('y', 2));
    q = enqueue(q, put('x', 1, 45));
    expect(q.map((o) => o.setId)).toEqual(['y', 'x']);
    expect((q[1] as Extract<OutboxOp, { kind: 'putSet' }>).body.weightKg).toBe(45);
    q = enqueue(q, del('x'));
    expect(q.map((o) => [o.kind, o.setId])).toEqual([
      ['putSet', 'y'],
      ['deleteSet', 'x'],
    ]);
  });

  it('keeps the in-flight head untouched', () => {
    const q = enqueue([put('x', 1, 40)], put('x', 1, 50), true);
    expect(q).toHaveLength(2);
  });

  it('backs off exponentially up to 30s', () => {
    expect(backoffMs(0)).toBe(1000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(30000);
  });
});

describe('applyPending', () => {
  it('shows queued sets optimistically and marks them pending', () => {
    const view = applyPending(session, [put('b', 2, 42.5)]);
    const sets = view.exercises[0]!.sets;
    expect(sets.map((s) => [s.id, s.weightKg])).toEqual([
      ['a', 40],
      ['b', 42.5],
    ]);
    expect(isPendingSet(sets[1]!)).toBe(true);
    expect(isPendingSet(sets[0]!)).toBe(false);
  });
  it('applies edits and deletions with renumbering', () => {
    expect(applyPending(session, [put('a', 1, 50)]).exercises[0]!.sets[0]!.weightKg).toBe(50);
    const view = applyPending(session, [put('b', 2), del('a')]);
    expect(view.exercises[0]!.sets.map((s) => [s.id, s.setNumber])).toEqual([['b', 1]]);
  });
  it('ignores ops of other sessions', () => {
    expect(applyPending(session, [{ ...put('z', 2), sessionId: 'other' }])).toBe(session);
  });
});
