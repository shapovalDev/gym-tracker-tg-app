import { beforeEach, describe, expect, it } from 'vitest';
import { client, createExercise, resetDb, uuid, type Client } from './helpers';

let c: Client;

beforeEach(async () => {
  await resetDb();
  c = client(6001);
});

async function exercise(name: string, trackingType?: string) {
  const r = await c.post('/exercises', { name, ...(trackingType ? { trackingType } : {}) });
  expect(r.status).toBe(201);
  return r.body.id as string;
}

/** Starts a free workout with one exercise and returns a helper to record sets. */
async function workout(exerciseId: string) {
  const s = (await c.post('/sessions', {})).body;
  const se = (await c.post(`/sessions/${s.id}/exercises`, { exerciseId })).body.exercises.at(-1)
    .id as string;
  let n = 0;
  const put = (body: Record<string, unknown>) =>
    c.put(`/sessions/${s.id}/sets/${uuid()}`, {
      sessionExerciseId: se,
      setNumber: ++n,
      status: 'completed',
      weightKg: 0,
      reps: 0,
      ...body,
    });
  const complete = () => c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
  return { sessionId: s.id as string, put, complete };
}

describe('exercise tracking type', () => {
  it('defaults to weight × reps and keeps the type on a PATCH that does not mention it', async () => {
    const bench = await createExercise(c, 'Bench');
    expect((await c.get(`/exercises/${bench}`)).body.trackingType).toBe('weight_reps');
    const plank = await exercise('Plank', 'duration');
    const r = await c.patch(`/exercises/${plank}`, { name: 'Side plank' });
    expect(r.body).toMatchObject({ name: 'Side plank', trackingType: 'duration' });
  });

  it('switches freely between rep-based types, even with recorded sets', async () => {
    const id = await exercise('Gravitron');
    const w = await workout(id);
    expect((await w.put({ weightKg: 30, reps: 8 })).status).toBe(201);
    const r = await c.patch(`/exercises/${id}`, { trackingType: 'assisted' });
    expect(r.status).toBe(200);
    expect((await c.get(`/sessions/${w.sessionId}`)).body.exercises[0].trackingType).toBe(
      'assisted',
    );
  });

  it('blocks switching to or from a timed type once sets exist', async () => {
    const id = await exercise('Hang');
    expect((await c.patch(`/exercises/${id}`, { trackingType: 'duration' })).status).toBe(200);
    expect((await c.patch(`/exercises/${id}`, { trackingType: 'bodyweight' })).status).toBe(200);
    const w = await workout(id);
    await w.put({ reps: 10 });
    const r = await c.patch(`/exercises/${id}`, { trackingType: 'duration' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('TRACKING_TYPE_LOCKED');
  });
});

describe('timed sets', () => {
  it('store seconds, clear reps, and require time for a completed set', async () => {
    const plank = await exercise('Plank', 'duration');
    const w = await workout(plank);
    const ok = await w.put({ durationSec: 75, reps: 12, weightKg: 10 });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ durationSec: 75, reps: 0, weightKg: 10 });

    const noTime = await w.put({ reps: 12 });
    expect(noTime.status).toBe(400);
    expect(noTime.body.error.details[0].path).toBe('durationSec');
    expect((await w.put({ status: 'skipped' })).status).toBe(201);
  });

  it('ignore seconds sent for a rep-based exercise and still require reps', async () => {
    const bench = await createExercise(c, 'Bench');
    const w = await workout(bench);
    const r = await w.put({ weightKg: 50, reps: 5, durationSec: 30 });
    expect(r.body).toMatchObject({ reps: 5, durationSec: null });
    const noReps = await w.put({ weightKg: 50, durationSec: 30 });
    expect(noReps.status).toBe(400);
    expect(noReps.body.error.details[0].path).toBe('reps');
  });

  it('feed the exercise analytics and the "last time" result', async () => {
    const plank = await exercise('Plank', 'duration');
    const first = await workout(plank);
    await first.put({ durationSec: 45 });
    await first.put({ durationSec: 60 });
    await first.complete();

    const a = (await c.get(`/analytics/exercises/${plank}?period=all`)).body;
    expect(a.exercise.trackingType).toBe('duration');
    expect(a.points[0]).toMatchObject({ maxDurationSec: 60, workingSets: 2, volumeKg: 0 });
    expect(a.records.longestDuration).toMatchObject({ value: 60 });

    const next = await workout(plank);
    const s = (await c.get(`/sessions/${next.sessionId}`)).body;
    expect(s.exercises[0].previous.sets.map((x: { durationSec: number }) => x.durationSec)).toEqual(
      [45, 60],
    );
  });
});

describe('volume', () => {
  it('counts only weight × reps exercises', async () => {
    const bench = await createExercise(c, 'Bench');
    const gravitron = await exercise('Gravitron', 'assisted');
    const pullUps = await exercise('Pull-ups', 'bodyweight');
    const w = await workout(bench);
    await w.put({ weightKg: 50, reps: 10 });
    await c.post(`/sessions/${w.sessionId}/exercises`, { exerciseId: gravitron });
    await c.post(`/sessions/${w.sessionId}/exercises`, { exerciseId: pullUps });
    const s = (await c.get(`/sessions/${w.sessionId}`)).body;
    for (const [i, weightKg] of [
      [1, 30],
      [2, 10],
    ] as const) {
      await c.put(`/sessions/${w.sessionId}/sets/${uuid()}`, {
        sessionExerciseId: s.exercises[i].id,
        setNumber: 1,
        weightKg,
        reps: 8,
        status: 'completed',
      });
    }
    const done = (await w.complete()).body;
    expect(done.summary).toMatchObject({ volumeKg: 500, totalSets: 3 });
    expect((await c.get('/analytics/summary?period=30d')).body.volumeKg).toBe(500);
  });
});
