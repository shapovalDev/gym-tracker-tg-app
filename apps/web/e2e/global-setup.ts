import { execSync } from 'node:child_process';
import path from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';

export default async function globalSetup() {
  config({ path: path.join(import.meta.dirname, '../../../.env'), quiet: true });
  const url = process.env.E2E_DATABASE_URL!;
  const dbName = new URL(url).pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  await client.end();
  execSync('pnpm --filter @gym/api exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: url },
    cwd: path.join(import.meta.dirname, '../../..'),
  });
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  await db.query(
    'TRUNCATE "ExerciseSet", "SessionExercise", "WorkoutSession", "WorkoutExercise", "ProgramWorkout", "TrainingProgram", "Exercise", "User" CASCADE',
  );
  await db.end();
}
