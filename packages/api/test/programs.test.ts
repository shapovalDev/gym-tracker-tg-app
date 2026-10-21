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

  it('edits, reorders, duplicates and deletes workouts', async () => {
    const p = (await c.post('/programs', { name: 'Split', workouts: ['A', 'B', 'C'] })).body;
    const [a, b, cc] = p.workouts;
    const reordered = await c.put(`/programs/${p.id}/workouts/order`, { ids: [cc.id, a.id, b.id] });
    expect(reordered.body.workouts.map((w: any) => w.name)).toEqual(['C', 'A', 'B']);

    const bad = await c.put(`/programs/${p.id}/workouts/order`, { ids: [a.id, b.id] });
    expect(bad.status).toBe(400);

    await c.patch(`/workouts/${a.id}`, { name: 'A2' });
    const dup = await c.post(`/workouts/${a.id}/duplicate`);
    expect(dup.body.workouts.map((w: any) => w.name)).toEqual(['C', 'A2', 'B', 'A2 (копия)']);

    const afterDelete = await c.del(`/workouts/${cc.id}`);
    expect(afterDelete.body.workouts.map((w: any) => [w.name, w.position])).toEqual([
      ['A2', 0],
      ['B', 1],
      ['A2 (копия)', 2],
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
    expect(copy.name).toBe('One (копия)');
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
