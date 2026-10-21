import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  PUBLIC_APP_URL: z.url().default('http://localhost:3000'),
  INIT_DATA_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 3600),
  ALLOW_DEV_AUTH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DEV_TELEGRAM_USER_ID: z.coerce.number().int().positive().default(100000001),
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid server environment: ${fields}`);
  }
  const env = result.data;
  // Test/dev authentication must never be reachable in production.
  if (env.NODE_ENV === 'production' && env.ALLOW_DEV_AUTH) {
    throw new Error('ALLOW_DEV_AUTH=true is forbidden when NODE_ENV=production');
  }
  return env;
}
