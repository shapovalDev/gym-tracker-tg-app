import { beforeEach, describe, expect, it } from 'vitest';
import { client, createExercise, db, resetDb, uuid, type Client } from './helpers';

let c: Client;
let bench: string;

beforeEach(async () => {
  await resetDb();
  c = client(3001);
  bench = await createExercise(c, 'Жим лёжа');
});

async function recordSession(daysAgo: number, sets: [number, number][], exerciseId = bench) {
  const s = (await c.post('/sessions', {})).body;
  const withEx = (await c.post(`/sessions/${s.id}/exercises`, { exerciseId })).body;
  const se = withEx.exercises[0].id;
  const setIds: string[] = [];
  for (const [i, [w, r]] of sets.entries()) {
    const id = uuid();
    setIds.push(id);
    await c.put(`/sessions/${s.id}/sets/${id}`, {
      sessionExerciseId: se,
      setNumber: i + 1,
      weightKg: w,
      reps: r,
      status: 'completed',
    });
  }
  await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
  const startedAt = new Date(Date.now() - daysAgo * 86400_000);
  await db.workoutSession.update({
    where: { id: s.id },
    data: { startedAt, completedAt: new Date(startedAt.getTime() + 3000_000) },
  });
  return { sessionId: s.id, se, setIds };
}

describe('exercise analytics', () => {
  it('returns an empty but valid response without history', async () => {
    const r = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(r.points).toEqual([]);
    expect(r.records.bestWeight).toBeNull();
    expect(r.summary.sessions).toBe(0);
  });

  it('builds time series from recorded sets only, one point per session', async () => {
    await recordSession(40, [[50, 10]]);
    await recordSession(10, [
      [60, 8],
      [60, 7],
    ]);
    await recordSession(2, [
      [62.5, 6],
      [60, 9],
    ]);
    const r = (await c.get(`/analytics/exercises/${bench}?period=30d&weightKg=60`)).body;
    expect(r.points).toHaveLength(2);
    expect(r.points.map((p: any) => p.maxWeightKg)).toEqual([60, 62.5]);
    expect(r.points.map((p: any) => p.repsAtWeight)).toEqual([8, 9]);
    expect(r.points[0].volumeKg).toBe(900);
    expect(r.summary.volumeKg).toBe(900 + 375 + 540);
    expect(r.availableWeights).toEqual([62.5, 60]);
    // all-time records
    expect(r.records.bestWeight).toMatchObject({ weightKg: 62.5, reps: 6 });
    expect(r.records.bestRepsAtWeight).toMatchObject({ value: 9 });
    expect(r.records.bestE1rm.value).toBe(78); // 60 × (1 + 9/30)
    // previous 30 days had 50×10 → e1RM 66.67
    expect(r.summary.previousBestE1rmKg).toBe(66.67);
    expect(r.summary.changeE1rmPct).toBe(17);

    const all = (await c.get(`/analytics/exercises/${bench}?period=all`)).body;
    expect(all.points).toHaveLength(3);
    expect(all.summary.changeE1rmPct).toBeNull();
  });

  it('recalculates after editing or deleting results', async () => {
    const { sessionId, se, setIds } = await recordSession(1, [
      [100, 5],
      [80, 10],
    ]);
    let r = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(r.records.bestWeight.weightKg).toBe(100);

    await c.put(`/sessions/${sessionId}/sets/${setIds[0]}`, {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 90,
      reps: 5,
      status: 'completed',
    });
    r = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(r.records.bestWeight.weightKg).toBe(90);
    expect(r.summary.volumeKg).toBe(450 + 800);

    await c.del(`/sessions/${sessionId}/sets/${setIds[0]}`);
    r = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(r.summary.volumeKg).toBe(800);

    await c.del(`/sessions/${sessionId}`);
    r = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(r.points).toEqual([]);
    expect((await c.get('/analytics/summary?period=30d')).body.completedWorkouts).toBe(0);
  });

  it('does not merge different exercises with identical names', async () => {
    const twin = await createExercise(c, 'Жим лёжа');
    await recordSession(1, [[100, 5]], twin);
    await recordSession(1, [[50, 5]]);
    const r = (await c.get(`/analytics/exercises/${bench}?period=30d`)).body;
    expect(r.points).toHaveLength(1);
    expect(r.records.bestWeight.weightKg).toBe(50);
  });

  it('excludes in-progress and cancelled sessions', async () => {
    const s = (await c.post('/sessions', {})).body;
    const se = (await c.post(`/sessions/${s.id}/exercises`, { exerciseId: bench })).body
      .exercises[0].id;
    await c.put(`/sessions/${s.id}/sets/${uuid()}`, {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 200,
      reps: 1,
      status: 'completed',
    });
    expect((await c.get(`/analytics/exercises/${bench}?period=all`)).body.points).toEqual([]);
    await c.post(`/sessions/${s.id}/cancel`);
    expect(
      (await c.get(`/analytics/exercises/${bench}?period=all`)).body.records.bestWeight,
    ).toBeNull();
  });
});

describe('summary and home', () => {
  it('computes totals and change vs previous period', async () => {
    await recordSession(45, [[50, 10]]); // previous 30d window
    await recordSession(5, [
      [50, 10],
      [50, 10],
    ]);
    await recordSession(3, [[60, 5]]);
    const s = (await c.get('/analytics/summary?period=30d')).body;
    expect(s).toMatchObject({ completedWorkouts: 2, totalSets: 3, volumeKg: 1300 });
    expect(s.previous).toMatchObject({ completedWorkouts: 1, totalSets: 1, volumeKg: 500 });
    expect(s.changeVolumePct).toBe(160);

    const home = (await c.get('/me/home')).body;
    expect(home.completedLast7Days).toBe(2);
    expect(home.completedLast30Days).toBe(2);
    expect(home.lastSession.summary.volumeKg).toBe(300);
    expect(home.highlights[0]).toMatchObject({ exerciseId: bench, lastMaxWeightKg: 60 });
    expect(home.activeProgram).toBeNull();
  });
});
