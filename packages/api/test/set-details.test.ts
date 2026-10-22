import { beforeEach, describe, expect, it } from 'vitest';
import { client, createExercise, db, resetDb, uuid, type Client } from './helpers';

let c: Client;
let bench: string;

beforeEach(async () => {
  await resetDb();
  c = client(5001);
  bench = await createExercise(c, 'Жим лёжа');
});

async function session(
  daysAgo: number,
  sets: { w: number; r: number; type?: 'warmup' | 'working'; note?: string }[],
  complete = true,
) {
  const s = (await c.post('/sessions', {})).body;
  const se = (await c.post(`/sessions/${s.id}/exercises`, { exerciseId: bench })).body.exercises[0]
    .id;
  for (const [i, x] of sets.entries()) {
    const r = await c.put(`/sessions/${s.id}/sets/${uuid()}`, {
      sessionExerciseId: se,
      setNumber: i + 1,
      weightKg: x.w,
      reps: x.r,
      status: 'completed',
      ...(x.type ? { setType: x.type } : {}),
      ...(x.note !== undefined ? { note: x.note } : {}),
    });
    expect(r.status).toBe(201);
  }
  if (complete) {
    await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
    const startedAt = new Date(Date.now() - daysAgo * 86400_000);
    await db.workoutSession.update({
      where: { id: s.id },
      data: { startedAt, completedAt: new Date(startedAt.getTime() + 3600_000) },
    });
  }
  return { sessionId: s.id, se };
}

describe('set type and comment', () => {
  it('stores warm-up type and a trimmed comment; defaults to a working set without comment', async () => {
    const { sessionId } = await session(
      0,
      [
        { w: 20, r: 15, type: 'warmup', note: '  разогрев  ' },
        { w: 60, r: 8 },
      ],
      false,
    );
    const sets = (await c.get(`/sessions/${sessionId}`)).body.exercises[0].sets;
    expect(sets.map((s: any) => [s.setType, s.note])).toEqual([
      ['warmup', 'разогрев'],
      ['working', null],
    ]);
  });

  it('rejects comments longer than 200 characters and unknown types', async () => {
    const { sessionId, se } = await session(0, [], false);
    const base = { sessionExerciseId: se, setNumber: 1, weightKg: 1, reps: 1, status: 'completed' };
    expect(
      (await c.put(`/sessions/${sessionId}/sets/${uuid()}`, { ...base, note: 'x'.repeat(201) }))
        .status,
    ).toBe(400);
    expect(
      (await c.put(`/sessions/${sessionId}/sets/${uuid()}`, { ...base, setType: 'dropset' }))
        .status,
    ).toBe(400);
  });

  it('excludes warm-ups from session summary, analytics and records', async () => {
    const { sessionId } = await session(1, [
      { w: 100, r: 10, type: 'warmup' },
      { w: 60, r: 8 },
    ]);
    const detail = (await c.get(`/sessions/${sessionId}`)).body;
    expect(detail.summary).toMatchObject({ totalSets: 1, warmupSets: 1, volumeKg: 480 });
    const a = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(a.records.bestWeight.weightKg).toBe(60);
    expect(a.summary).toMatchObject({ workingSets: 1, volumeKg: 480 });
    expect((await c.get('/analytics/summary?period=30d')).body).toMatchObject({
      totalSets: 1,
      volumeKg: 480,
    });
  });

  it('does not let warm-ups fill the planned sets when finishing', async () => {
    const p = (await c.post('/programs', { name: 'P', workouts: ['A'] })).body;
    await c.post(`/workouts/${p.workouts[0].id}/exercises`, { exerciseId: bench, plannedSets: 1 });
    const s = (await c.post('/sessions', { workoutId: p.workouts[0].id })).body;
    await c.put(`/sessions/${s.id}/sets/${uuid()}`, {
      sessionExerciseId: s.exercises[0].id,
      setNumber: 1,
      weightKg: 20,
      reps: 10,
      status: 'completed',
      setType: 'warmup',
    });
    expect((await c.post(`/sessions/${s.id}/complete`, {})).body.error.code).toBe(
      'INCOMPLETE_SESSION',
    );
  });

  it('"previous" skips sessions that only had warm-ups and carries types and comments', async () => {
    await session(3, [
      { w: 20, r: 15, type: 'warmup' },
      { w: 70, r: 6, note: 'со страховкой' },
    ]);
    await session(1, [{ w: 20, r: 15, type: 'warmup' }]);
    const now = (await c.post('/sessions', {})).body;
    const se = (await c.post(`/sessions/${now.id}/exercises`, { exerciseId: bench })).body
      .exercises[0];
    expect(se.previous.sets.map((s: any) => [s.setType, s.weightKg, s.note])).toEqual([
      ['warmup', 20, null],
      ['working', 70, 'со страховкой'],
    ]);
  });
});

describe('exercise history', () => {
  it('lists recent completed sessions newest first with all sets, honouring the limit', async () => {
    await session(10, [{ w: 50, r: 10 }]);
    await session(5, [
      { w: 20, r: 15, type: 'warmup' },
      { w: 55, r: 8, note: 'легко' },
    ]);
    await session(0, [{ w: 60, r: 5 }], false); // in progress: not history
    const h = (await c.get(`/exercises/${bench}/history`)).body.items;
    expect(h).toHaveLength(2);
    expect(h[0].sets.map((s: any) => [s.setType, s.weightKg, s.reps, s.note])).toEqual([
      ['warmup', 20, 15, null],
      ['working', 55, 8, 'легко'],
    ]);
    expect(h[1].sets[0].weightKg).toBe(50);
    expect((await c.get(`/exercises/${bench}/history?limit=1`)).body.items).toHaveLength(1);
  });

  it("is not available for another user's exercise", async () => {
    expect((await client(5002).get(`/exercises/${bench}/history`)).status).toBe(404);
  });
});
