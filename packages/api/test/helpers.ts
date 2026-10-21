import { config } from 'dotenv';
import { clearUserCache } from '../src/auth/middleware';
import { signInitData } from '../src/auth/telegram';
import { createApp } from '../src/app';
import { createDb } from '../src/db';
import { parseEnv } from '../src/env';

config({ path: '../../.env', quiet: true });

export const BOT_TOKEN = '123456789:TEST-token-for-integration-tests';

function testUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const u = new URL(process.env.DATABASE_URL!);
  u.pathname = `/${u.pathname.slice(1)}_test`;
  return u.toString();
}

export const env = parseEnv({
  NODE_ENV: 'test',
  DATABASE_URL: testUrl(),
  TELEGRAM_BOT_TOKEN: BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET: 'hook-secret',
  PUBLIC_APP_URL: 'https://example.test',
  ALLOW_DEV_AUTH: 'false',
});
export const db = createDb(env.DATABASE_URL);
export const app = createApp({ env, db });

export async function resetDb() {
  clearUserCache();
  await db.$executeRawUnsafe(
    'TRUNCATE "ExerciseSet", "SessionExercise", "WorkoutSession", "WorkoutExercise", "ProgramWorkout", "TrainingProgram", "Exercise", "User" CASCADE',
  );
}

export function authFor(telegramId: number) {
  return `tma ${signInitData(BOT_TOKEN, { id: telegramId, first_name: 'T' })}`;
}

export interface Res<T = any> {
  status: number;
  body: T;
}

/** Tiny client bound to one Telegram user. */
export function client(telegramId: number) {
  const auth = authFor(telegramId);
  const call = async <T = any>(method: string, path: string, body?: unknown): Promise<Res<T>> => {
    const res = await app.request(`/api/v1${path}`, {
      method,
      headers: {
        authorization: auth,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return {
    get: <T = any>(p: string) => call<T>('GET', p),
    post: <T = any>(p: string, b: unknown = {}) => call<T>('POST', p, b),
    put: <T = any>(p: string, b: unknown) => call<T>('PUT', p, b),
    patch: <T = any>(p: string, b: unknown) => call<T>('PATCH', p, b),
    del: <T = any>(p: string) => call<T>('DELETE', p),
  };
}
export type Client = ReturnType<typeof client>;

export async function createExercise(c: Client, name: string, muscleGroup = 'chest') {
  const r = await c.post('/exercises', { name, muscleGroup });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return r.body.id as string;
}

export const uuid = () => crypto.randomUUID();
