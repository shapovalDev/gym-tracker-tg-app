import { beforeAll, describe, expect, it } from 'vitest';
import { client, createExercise, resetDb, uuid, type Client } from './helpers';

let alice: Client;
let bob: Client;
const a: Record<string, string> = {};

beforeAll(async () => {
  await resetDb();
  alice = client(4001);
  bob = client(4002);
  a.exercise = await createExercise(alice, 'Alice exercise');
  const p = (await alice.post('/programs', { name: 'Alice', workouts: ['A'] })).body;
  a.program = p.id;
  a.workout = p.workouts[0].id;
  a.we = (
    await alice.post(`/workouts/${a.workout}/exercises`, { exerciseId: a.exercise })
  ).body.workouts[0].exercises[0].id;
  const s = (await alice.post('/sessions', { workoutId: a.workout })).body;
  a.session = s.id;
  a.se = s.exercises[0].id;
  a.set = uuid();
  await alice.put(`/sessions/${a.session}/sets/${a.set}`, {
    sessionExerciseId: a.se,
    setNumber: 1,
    weightKg: 10,
    reps: 10,
    status: 'completed',
  });
});

describe('data isolation between users', () => {
  it("hides other users' data from lists", async () => {
    expect((await bob.get('/exercises')).body.items).toEqual([]);
    expect((await bob.get('/programs')).body.items).toEqual([]);
    expect((await bob.get('/sessions/active')).body.session).toBeNull();
    expect((await bob.get('/sessions?status=all')).body.items).toEqual([]);
  });

  it('returns 404 for every direct access by id', async () => {
    const attempts = [
      bob.get(`/exercises/${a.exercise}`),
      bob.patch(`/exercises/${a.exercise}`, { name: 'hacked' }),
      bob.post(`/exercises/${a.exercise}/archive`),
      bob.get(`/programs/${a.program}`),
      bob.patch(`/programs/${a.program}`, { name: 'hacked' }),
      bob.post(`/programs/${a.program}/activate`),
      bob.post(`/programs/${a.program}/duplicate`),
      bob.post(`/programs/${a.program}/workouts`, { name: 'x' }),
      bob.patch(`/workouts/${a.workout}`, { name: 'x' }),
      bob.del(`/workouts/${a.workout}`),
      bob.post(`/workouts/${a.workout}/exercises`, { exerciseId: a.exercise }),
      bob.patch(`/workout-exercises/${a.we}`, { plannedSets: 9 }),
      bob.del(`/workout-exercises/${a.we}`),
      bob.post('/sessions', { workoutId: a.workout }),
      bob.get(`/sessions/${a.session}`),
      bob.post(`/sessions/${a.session}/complete`, { confirmIncomplete: true }),
      bob.post(`/sessions/${a.session}/cancel`),
      bob.post(`/sessions/${a.session}/exercises`, { exerciseId: a.exercise }),
      bob.put(`/sessions/${a.session}/sets/${a.set}`, {
        sessionExerciseId: a.se,
        setNumber: 1,
        weightKg: 999,
        reps: 1,
        status: 'completed',
      }),
      bob.del(`/sessions/${a.session}/sets/${a.set}`),
      bob.del(`/sessions/${a.session}`),
      bob.get(`/analytics/exercises/${a.exercise}`),
    ];
    const results = await Promise.all(attempts);
    expect(results.map((r) => r.status)).toEqual(results.map(() => 404));
  });

  it("cannot attach someone else's exercise or overwrite their set through own session", async () => {
    const mine = await createExercise(bob, 'Bob exercise');
    const s = (await bob.post('/sessions', {})).body;
    expect((await bob.post(`/sessions/${s.id}/exercises`, { exerciseId: a.exercise })).status).toBe(
      404,
    );
    const se = (await bob.post(`/sessions/${s.id}/exercises`, { exerciseId: mine })).body
      .exercises[0].id;
    // reuse Alice's set id inside Bob's session
    const r = await bob.put(`/sessions/${s.id}/sets/${a.set}`, {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 1,
      reps: 1,
      status: 'completed',
    });
    expect(r.status).toBe(404);
    // Alice's data is unchanged
    const detail = (await alice.get(`/sessions/${a.session}`)).body;
    expect(detail.exercises[0].sets[0]).toMatchObject({ weightKg: 10, reps: 10 });
  });
});
