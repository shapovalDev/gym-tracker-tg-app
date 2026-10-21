import { beforeEach, describe, expect, it } from 'vitest';
import { client, createExercise, db, resetDb, uuid, type Client } from './helpers';

let c: Client;
let bench: string;
let row: string;
let program: any;

beforeEach(async () => {
  await resetDb();
  c = client(2001);
  bench = await createExercise(c, 'Жим лёжа');
  row = await createExercise(c, 'Тяга', 'back');
  program = (await c.post('/programs', { name: 'ABCD', workouts: ['A', 'B', 'C', 'D'] })).body;
  await c.post(`/workouts/${program.workouts[0].id}/exercises`, {
    exerciseId: bench,
    plannedSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 12,
  });
  await c.post(`/workouts/${program.workouts[0].id}/exercises`, {
    exerciseId: row,
    plannedSets: 2,
  });
});

const putSet = (sessionId: string, setId: string, body: object) =>
  c.put(`/sessions/${sessionId}/sets/${setId}`, body);

async function startA() {
  const r = await c.post('/sessions', { workoutId: program.workouts[0].id });
  expect(r.status).toBe(201);
  return r.body;
}

describe('workout sessions', () => {
  it('starts a session with a snapshot of planned exercises', async () => {
    const s = await startA();
    expect(s.status).toBe('in_progress');
    expect(s.workoutName).toBe('A');
    expect(s.exercises.map((e: any) => [e.name, e.plannedSets])).toEqual([
      ['Жим лёжа', 3],
      ['Тяга', 2],
    ]);
  });

  it('restores the active session and allows only one at a time', async () => {
    const s = await startA();
    const active = await c.get('/sessions/active');
    expect(active.body.session.id).toBe(s.id);
    const second = await c.post('/sessions', { workoutId: program.workouts[1].id });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({
      code: 'SESSION_IN_PROGRESS',
      details: { sessionId: s.id },
    });
  });

  it('is idempotent when the start request is retried with the same id', async () => {
    const id = uuid();
    const a = await c.post('/sessions', { id, workoutId: program.workouts[0].id });
    const b = await c.post('/sessions', { id, workoutId: program.workouts[0].id });
    expect(a.body.id).toBe(id);
    expect(b.body.id).toBe(id);
    expect(await db.workoutSession.count()).toBe(1);
  });

  it('saves multiple sets with decimal weights; retried PUT never duplicates', async () => {
    const s = await startA();
    const se = s.exercises[0].id;
    const sets = [
      [40, 12],
      [45, 10],
      [45, 9],
      [22.5, 6],
    ];
    const ids = sets.map(() => uuid());
    for (const [i, [w, r]] of sets.entries()) {
      const res = await putSet(s.id, ids[i]!, {
        sessionExerciseId: se,
        setNumber: i + 1,
        weightKg: w,
        reps: r,
        status: 'completed',
      });
      expect(res.status).toBe(201);
    }
    // network retry of the last request
    const retry = await putSet(s.id, ids[3]!, {
      sessionExerciseId: se,
      setNumber: 4,
      weightKg: 22.5,
      reps: 6,
      status: 'completed',
    });
    expect(retry.status).toBe(200);
    // concurrent duplicates
    await Promise.all(
      [1, 2, 3].map(() =>
        putSet(s.id, ids[0]!, {
          sessionExerciseId: se,
          setNumber: 1,
          weightKg: 40,
          reps: 12,
          status: 'completed',
        }),
      ),
    );

    const detail = (await c.get(`/sessions/${s.id}`)).body;
    expect(detail.exercises[0].sets.map((x: any) => [x.weightKg, x.reps])).toEqual(sets);
    expect(await db.exerciseSet.count()).toBe(4);
  });

  it('edits and deletes sets; deletion renumbers and is idempotent', async () => {
    const s = await startA();
    const se = s.exercises[0].id;
    const [a, b, cc] = [uuid(), uuid(), uuid()];
    await putSet(s.id, a, {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 40,
      reps: 10,
      status: 'completed',
    });
    await putSet(s.id, b, {
      sessionExerciseId: se,
      setNumber: 2,
      weightKg: 40,
      reps: 10,
      status: 'completed',
    });
    await putSet(s.id, cc, {
      sessionExerciseId: se,
      setNumber: 3,
      weightKg: 40,
      reps: 8,
      status: 'completed',
    });
    await putSet(s.id, b, {
      sessionExerciseId: se,
      setNumber: 2,
      weightKg: 42.5,
      reps: 9,
      status: 'completed',
    });
    expect((await c.del(`/sessions/${s.id}/sets/${a}`)).status).toBe(204);
    expect((await c.del(`/sessions/${s.id}/sets/${a}`)).status).toBe(204);
    const detail = (await c.get(`/sessions/${s.id}`)).body;
    expect(detail.exercises[0].sets.map((x: any) => [x.setNumber, x.weightKg, x.reps])).toEqual([
      [1, 42.5, 9],
      [2, 40, 8],
    ]);
  });

  it('appends a new set whose number is already taken instead of duplicating it', async () => {
    const s = await startA();
    const se = s.exercises[0].id;
    await putSet(s.id, uuid(), {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 40,
      reps: 10,
      status: 'completed',
    });
    const r = await putSet(s.id, uuid(), {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 45,
      reps: 8,
      status: 'completed',
    });
    expect(r.body.setNumber).toBe(2);
  });

  it('validates sets', async () => {
    const s = await startA();
    const se = s.exercises[0].id;
    const base = {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 40,
      reps: 10,
      status: 'completed',
    };
    expect((await putSet(s.id, uuid(), { ...base, weightKg: -5 })).status).toBe(400);
    expect((await putSet(s.id, uuid(), { ...base, reps: 0 })).status).toBe(400);
    expect((await putSet(s.id, uuid(), { ...base, reps: 1.5 })).status).toBe(400);
    expect((await putSet(s.id, uuid(), { ...base, reps: 0, status: 'skipped' })).status).toBe(201);
    expect((await putSet(s.id, uuid(), { ...base, sessionExerciseId: uuid() })).status).toBe(404);
  });

  it('adds and removes exercises in an active session', async () => {
    const extra = await createExercise(c, 'Отжимания');
    const s = await startA();
    const id = uuid();
    const r1 = await c.post(`/sessions/${s.id}/exercises`, { id, exerciseId: extra });
    const r2 = await c.post(`/sessions/${s.id}/exercises`, { id, exerciseId: extra });
    expect(r1.body.exercises).toHaveLength(3);
    expect(r2.body.exercises).toHaveLength(3);
    const removed = await c.del(`/sessions/${s.id}/exercises/${id}`);
    expect(removed.body.exercises).toHaveLength(2);
  });

  it('requires confirmation to complete with unfinished sets and returns a summary', async () => {
    const s = await startA();
    const se = s.exercises[0].id;
    await putSet(s.id, uuid(), {
      sessionExerciseId: se,
      setNumber: 1,
      weightKg: 50,
      reps: 10,
      status: 'completed',
    });
    await putSet(s.id, uuid(), {
      sessionExerciseId: se,
      setNumber: 2,
      weightKg: 50,
      reps: 0,
      status: 'skipped',
    });
    const blocked = await c.post(`/sessions/${s.id}/complete`, {});
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('INCOMPLETE_SESSION');
    const done = await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('completed');
    expect(done.body.summary).toMatchObject({
      exercisesCompleted: 1,
      totalSets: 1,
      skippedSets: 1,
      volumeKg: 500,
    });
    expect(done.body.summary.durationSeconds).toBeGreaterThanOrEqual(0);
    // retry is idempotent
    expect((await c.post(`/sessions/${s.id}/complete`, {})).status).toBe(200);
    expect((await c.get('/sessions/active')).body.session).toBeNull();
  });

  it('cancels without counting as completed and blocks further edits', async () => {
    const s = await startA();
    const cancelled = await c.post(`/sessions/${s.id}/cancel`);
    expect(cancelled.body.status).toBe('cancelled');
    expect((await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true })).status).toBe(
      409,
    );
    const se = s.exercises[0].id;
    expect(
      (
        await putSet(s.id, uuid(), {
          sessionExerciseId: se,
          setNumber: 1,
          weightKg: 1,
          reps: 1,
          status: 'completed',
        })
      ).status,
    ).toBe(409);
    const home = (await c.get('/me/home')).body;
    expect(home.completedLast7Days).toBe(0);
    expect(home.nextWorkout.name).toBe('A'); // cycle did not advance
    expect((await c.get('/sessions')).body.items).toHaveLength(0);
    expect((await c.get('/sessions?status=cancelled')).body.items).toHaveLength(1);
  });

  it('shows previous results for an exercise', async () => {
    const s1 = await startA();
    await putSet(s1.id, uuid(), {
      sessionExerciseId: s1.exercises[0].id,
      setNumber: 1,
      weightKg: 60,
      reps: 8,
      status: 'completed',
    });
    await c.post(`/sessions/${s1.id}/complete`, { confirmIncomplete: true });
    const s2 = await startA();
    expect(s2.exercises[0].previous).toMatchObject({
      sessionId: s1.id,
      sets: [{ weightKg: 60, reps: 8 }],
    });
    expect(s2.exercises[1].previous).toBeNull();
  });

  it('keeps history intact when the plan or exercise names change', async () => {
    const s = await startA();
    await putSet(s.id, uuid(), {
      sessionExerciseId: s.exercises[0].id,
      setNumber: 1,
      weightKg: 60,
      reps: 8,
      status: 'completed',
    });
    await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
    await c.patch(`/exercises/${bench}`, { name: 'Жим (новое имя)' });
    await c.del(`/workouts/${program.workouts[0].id}`);
    await c.post(`/programs/${program.id}/archive`);
    const detail = (await c.get(`/sessions/${s.id}`)).body;
    expect(detail.workoutName).toBe('A');
    expect(detail.workoutId).toBeNull();
    expect(detail.exercises[0]).toMatchObject({ name: 'Жим лёжа', exerciseId: bench });
    expect(detail.exercises[0].sets).toHaveLength(1);
    const stats = (await c.get(`/analytics/exercises/${bench}?period=all`)).body;
    expect(stats.points).toHaveLength(1);
  });
});

describe('workout cycle', () => {
  it('advances A→B→C→D→A, ignores cancelled sessions, follows manual choice', async () => {
    const next = async () => (await c.get('/me/home')).body.nextWorkout?.name;
    const finish = async (workoutIndex: number) => {
      const s = (await c.post('/sessions', { workoutId: program.workouts[workoutIndex].id })).body;
      await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
    };
    expect(await next()).toBe('A');
    await finish(0);
    expect(await next()).toBe('B');
    const s = (await c.post('/sessions', { workoutId: program.workouts[1].id })).body;
    await c.post(`/sessions/${s.id}/cancel`);
    expect(await next()).toBe('B');
    await finish(1);
    await finish(2);
    expect(await next()).toBe('D');
    await finish(3);
    expect(await next()).toBe('A');
    // manual pick: do C now → next is D
    await finish(2);
    expect(await next()).toBe('D');
  });

  it('restarts from the first workout if the last completed one is deleted; keeps per-program position', async () => {
    const finish = async (workoutId: string) => {
      const s = (await c.post('/sessions', { workoutId })).body;
      await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
    };
    await finish(program.workouts[0].id);
    await finish(program.workouts[1].id);
    let p = (await c.get(`/programs/${program.id}`)).body;
    expect(p.nextWorkoutId).toBe(program.workouts[2].id);

    const other = (await c.post('/programs', { name: 'Other', workouts: ['X', 'Y'] })).body;
    await c.post(`/programs/${other.id}/activate`);
    expect((await c.get('/me/home')).body.nextWorkout.name).toBe('X');
    await c.post(`/programs/${program.id}/activate`);
    expect((await c.get('/me/home')).body.nextWorkout.name).toBe('C');

    await c.del(`/workouts/${program.workouts[1].id}`);
    p = (await c.get(`/programs/${program.id}`)).body;
    expect(p.nextWorkoutId).toBe(program.workouts[0].id);
  });
});

describe('history', () => {
  it('lists completed sessions with pagination and date filtering, and deletes', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = (await c.post('/sessions', { workoutId: program.workouts[i % 4].id })).body;
      await c.post(`/sessions/${s.id}/complete`, { confirmIncomplete: true });
      ids.push(s.id);
    }
    // spread them in time: session i started i*10 days ago
    for (const [i, id] of ids.entries()) {
      const startedAt = new Date(Date.now() - i * 10 * 86400_000);
      await db.workoutSession.update({
        where: { id },
        data: { startedAt, completedAt: new Date(startedAt.getTime() + 3600_000) },
      });
    }
    const p1 = (await c.get('/sessions?limit=2')).body;
    expect(p1.items.map((s: any) => s.id)).toEqual([ids[0], ids[1]]);
    const p2 = (await c.get(`/sessions?limit=2&cursor=${p1.nextCursor}`)).body;
    expect(p2.items.map((s: any) => s.id)).toEqual([ids[2], ids[3]]);
    const p3 = (await c.get(`/sessions?limit=2&cursor=${p2.nextCursor}`)).body;
    expect(p3.nextCursor).toBeNull();
    expect(p3.items[0].summary.durationSeconds).toBe(3600);

    const from = new Date(Date.now() - 25 * 86400_000).toISOString();
    const to = new Date(Date.now() - 5 * 86400_000).toISOString();
    const filtered = (
      await c.get(`/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    ).body;
    expect(filtered.items.map((s: any) => s.id)).toEqual([ids[1], ids[2]]);

    expect((await c.del(`/sessions/${ids[0]}`)).status).toBe(204);
    expect((await c.get(`/sessions/${ids[0]}`)).status).toBe(404);
  });
});
