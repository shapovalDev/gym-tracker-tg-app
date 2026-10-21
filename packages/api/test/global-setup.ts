import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';

/**
 * Integration tests run against a real PostgreSQL database `<db>_test`
 * (created on the server from DATABASE_URL) with all migrations applied.
 * Override with TEST_DATABASE_URL.
 */
export default async function setup() {
  config({ path: '../../.env', quiet: true });
  const base = process.env.DATABASE_URL;
  if (!base && !process.env.TEST_DATABASE_URL)
    throw new Error('DATABASE_URL is required for integration tests');
  const url = process.env.TEST_DATABASE_URL ?? deriveTestUrl(base!);
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  await client.end();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: url },
  });
  process.env.TEST_DATABASE_URL = url;
}

function deriveTestUrl(base: string) {
  const u = new URL(base);
  u.pathname = `${u.pathname.slice(1)}_test`.replace(/^/, '/');
  return u.toString();
}
