import { beforeEach, describe, expect, it } from 'vitest';
import { client, createExercise, resetDb, type Client } from './helpers';

let c: Client;
beforeEach(async () => {
  await resetDb();
  c = client(1001);
});

describe('programs', () => {
  it('creates a program with an arbitrary number of workouts; first program is active', async () => {
    for (const n of [1, 4, 6]) {
      const r = await c.post('/programs', {
        name: `P${n}`,
        workouts: Array.from({ length: n }, (_, i) => `W${i}`),
      });
      expect(r.status).toBe(201);
      expect(r.body.workouts.map((w: any) => w.position)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
    }
    const list = await c.get('/programs');
    expect(list.body.items.filter((p: any) => p.isActive)).toHaveLength(1);
    expect(list.body.items.find((p: any) => p.isActive).name).toBe('P1');
  });

  it('puts scheduled workouts in calendar order and keeps one workout per day', async () => {
    const p = (
      await c.post('/programs', {
        name: 'Week',
        workouts: [
          { name: 'Legs', weekday: 4 },
          'Extra',
          { name: 'Chest', weekday: 0 },
          { name: 'Back', weekday: 2 },
        ],
      })
    ).body;
    expect(p.workouts.map((w: any) => [w.name, w.weekday, w.position])).toEqual([
      ['Chest', 0, 0],
      ['Back', 2, 1],
      ['Legs', 4, 2],
      ['Extra', null, 3],
    ]);

    const sameDay = await c.post('/programs', {
      name: 'Bad',
      workouts: [
        { name: 'A', weekday: 1 },
        { name: 'B', weekday: 1 },
      ],
    });
    expect(sameDay.status).toBe(400);

    const [chest, , legs, extra] = p.workouts;
    const taken = await c.patch(`/workouts/${extra.id}`, { name: 'Extra', weekday: 0 });
    expect(taken.status).toBe(409);
    const moved = await c.patch(`/workouts/${extra.id}`, { name: 'Extra', weekday: 5 });
    expect(moved.body.workouts.find((w: any) => w.id === extra.id).weekday).toBe(5);
    // renaming without a day keeps the day; null clears it
    const renamed = await c.patch(`/workouts/${legs.id}`, { name: 'Legs 2' });
    expect(renamed.body.workouts.find((w: any) => w.id === legs.id).weekday).toBe(4);
    const cleared = await c.patch(`/workouts/${chest.id}`, { name: 'Chest', weekday: null });
    expect(cleared.body.workouts.find((w: any) => w.id === chest.id).weekday).toBeNull();

    const copy = await c.post(`/programs/${p.id}/duplicate`);
    expect(copy.body.workouts.map((w: any) => w.weekday)).toEqual([null, 2, 4, 5]);
  });

  it("picks the next workout by the user's calendar day when days are pinned", async () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    const today = iso(now);
    const tomorrow = iso(new Date(now.getTime() + 86_400_000));
    const wd = (now.getUTCDay() + 6) % 7;
    const day = (n: number) => (wd + n) % 7;
    const dayOf = (date: string) => client(1001, { 'x-local-date': date, 'x-tz-offset': '0' });

    const p = (
      await c.post('/programs', {
        name: 'Week',
        workouts: [
          { name: 'Today', weekday: day(0) },
          { name: 'In two days', weekday: day(2) },
          'Unscheduled',
        ],
      })
    ).body;
    const byName = (n: string) => p.workouts.find((w: any) => w.name === n).id;
    expect((await dayOf(today).get(`/programs/${p.id}`)).body.nextWorkoutId).toBe(byName('Today'));
    // tomorrow is a rest day: the next planned day comes up
    expect((await dayOf(tomorrow).get(`/programs/${p.id}`)).body.nextWorkoutId).toBe(
      byName('In two days'),
    );

    // once something of the program is done today, today's slot is used up
    const exerciseId = await createExercise(c, 'Squat');
    await c.post(`/workouts/${byName('Unscheduled')}/exercises`, { exerciseId });
    const s = (await c.post('/sessions', { workoutId: byName('Unscheduled') })).body;
    await c.put(`/sessions/${s.id}/sets/${crypto.randomUUID()}`, {
      sessionExerciseId: s.exercises[0].id,
      setNumber: 1,
      weightKg: 50,
      reps: 5,
      status: 'completed',
    });
    await c.post(`/sessions/${s.id}/complete`, {});
    const home = (await dayOf(today).get('/me/home')).body;
    expect(home.nextWorkout.id).toBe(byName('In two days'));
    expect(home.nextWorkout.weekday).toBe(day(2));

    // a client clock far off is ignored (falls back to the UTC day)
    const bogus = await client(1001, { 'x-local-date': '1999-01-01', 'x-tz-offset': '0' }).get(
      `/programs/${p.id}`,
    );
    expect(bogus.body.nextWorkoutId).toBe(byName('In two days'));
  });

  it('edits, reorders, duplicates and deletes workouts', async () => {
    const p = (await c.post('/programs', { name: 'Split', workouts: ['A', 'B', 'C'] })).body;
    const [a, b, cc] = p.workouts;
    const reordered = await c.put(`/programs/${p.id}/workouts/order`, { ids: [cc.id, a.id, b.id] });
    expect(reordered.body.workouts.map((w: any) => w.name)).toEqual(['C', 'A', 'B']);

    const bad = await c.put(`/programs/${p.id}/workouts/order`, { ids: [a.id, b.id] });
    expect(bad.status).toBe(400);

    await c.patch(`/workouts/${a.id}`, { name: 'A2' });
    const dup = await c.post(`/workouts/${a.id}/duplicate`);
    expect(dup.body.workouts.map((w: any) => w.name)).toEqual(['C', 'A2', 'B', 'A2 (copy)']);

    const afterDelete = await c.del(`/workouts/${cc.id}`);
    expect(afterDelete.body.workouts.map((w: any) => [w.name, w.position])).toEqual([
      ['A2', 0],
      ['B', 1],
      ['A2 (copy)', 2],
    ]);
  });

  it('manages planned exercises within a workout', async () => {
    const bench = await createExercise(c, 'Жим лёжа');
    const fly = await createExercise(c, 'Разводка');
    const p = (await c.post('/programs', { name: 'P', workouts: ['A'] })).body;
    const w = p.workouts[0].id;
    await c.post(`/workouts/${w}/exercises`, {
      exerciseId: bench,
      plannedSets: 4,
      targetRepsMin: 6,
      targetRepsMax: 10,
    });
    const r = await c.post(`/workouts/${w}/exercises`, { exerciseId: fly });
    const [we1, we2] = r.body.workouts[0].exercises;
    expect(we1).toMatchObject({ plannedSets: 4, targetRepsMin: 6, targetRepsMax: 10, position: 0 });

    const re = await c.put(`/workouts/${w}/exercises/order`, { ids: [we2.id, we1.id] });
    expect(re.body.workouts[0].exercises.map((e: any) => e.exercise.name)).toEqual([
      'Разводка',
      'Жим лёжа',
    ]);

    const bad = await c.patch(`/workout-exercises/${we1.id}`, { targetRepsMin: 12 });
    expect(bad.status).toBe(400);
    const ok = await c.patch(`/workout-exercises/${we1.id}`, {
      plannedSets: 5,
      notes: 'пауза внизу',
    });
    expect(ok.body.workouts[0].exercises[1]).toMatchObject({
      plannedSets: 5,
      notes: 'пауза внизу',
    });

    const del = await c.del(`/workout-exercises/${we2.id}`);
    expect(del.body.workouts[0].exercises).toHaveLength(1);
    expect(del.body.workouts[0].exercises[0].position).toBe(0);
  });

  it('switches active program, archives and duplicates programs', async () => {
    const ex = await createExercise(c, 'Присед', 'quads');
    const p1 = (await c.post('/programs', { name: 'One', workouts: ['A'] })).body;
    await c.post(`/workouts/${p1.workouts[0].id}/exercises`, { exerciseId: ex, plannedSets: 3 });
    const p2 = (await c.post('/programs', { name: 'Two' })).body;
    expect(p2.isActive).toBe(false);

    await c.post(`/programs/${p2.id}/activate`);
    const list = (await c.get('/programs')).body.items;
    expect(list.find((p: any) => p.id === p2.id).isActive).toBe(true);
    expect(list.find((p: any) => p.id === p1.id).isActive).toBe(false);

    const copy = (await c.post(`/programs/${p1.id}/duplicate`)).body;
    expect(copy.name).toBe('One (copy)');
    const named = (await c.post(`/programs/${p1.id}/duplicate`, { name: 'One (копія)' })).body;
    expect(named.name).toBe('One (копія)');
    expect(copy.workouts[0].exercises[0]).toMatchObject({ exerciseId: ex, plannedSets: 3 });
    expect(copy.isActive).toBe(false);

    const archived = (await c.post(`/programs/${p2.id}/archive`)).body;
    expect(archived).toMatchObject({ isActive: false });
    expect(archived.archivedAt).not.toBeNull();
    expect((await c.get('/programs')).body.items.map((p: any) => p.id)).not.toContain(p2.id);
    expect((await c.get('/programs?archived=true')).body.items.map((p: any) => p.id)).toContain(
      p2.id,
    );
    expect((await c.post(`/programs/${p2.id}/activate`)).status).toBe(409);
  });
});

describe('exercise library', () => {
  it('creates, searches, filters, edits and archives exercises', async () => {
    const id = await createExercise(c, 'Жим лёжа', 'chest');
    await createExercise(c, 'Тяга штанги', 'back');
    expect((await c.get('/exercises?search=жим')).body.items).toHaveLength(1);
    expect((await c.get('/exercises?muscleGroup=back')).body.items[0].name).toBe('Тяга штанги');

    const upd = await c.patch(`/exercises/${id}`, {
      name: 'Жим штанги лёжа',
      description: 'лопатки сведены',
    });
    expect(upd.body).toMatchObject({ name: 'Жим штанги лёжа', description: 'лопатки сведены' });

    await c.post(`/exercises/${id}/archive`);
    expect((await c.get('/exercises')).body.items).toHaveLength(1);
    expect((await c.get('/exercises?archived=true')).body.items).toHaveLength(2);

    const p = (await c.post('/programs', { name: 'P', workouts: ['A'] })).body;
    const add = await c.post(`/workouts/${p.workouts[0].id}/exercises`, { exerciseId: id });
    expect(add.status).toBe(409);
  });

  it('validates input', async () => {
    expect((await c.post('/exercises', { name: '' })).status).toBe(400);
    expect((await c.post('/exercises', { name: 'x', muscleGroup: 'wings' })).status).toBe(400);
    const r = await c.post('/exercises', { name: 'x'.repeat(101) });
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect((await c.get('/exercises/not-a-uuid')).status).toBe(400);
  });
});
