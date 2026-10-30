import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requireAuth } from './auth/middleware';
import { signInitData } from './auth/telegram';
import { getDb, type Db } from './db';
import { parseEnv, type Env } from './env';
import { clientDayMiddleware } from './http/client-day';
import { errorBody, handleError } from './http/errors';
import { ApiRouter } from './http/router';
import type { AppEnv } from './http/types';
import { registerRoutes } from './routes';
import { registerTelegramWebhook } from './telegram/bot';

export interface AppOptions {
  env?: Env;
  db?: Db;
}

/**
 * Builds the whole HTTP API. The same app runs inside Next.js (one deployment,
 * zero extra hosting cost) or standalone on Node (src/server.ts).
 */
export function createApp(options: AppOptions = {}) {
  const env = options.env ?? parseEnv();
  const db = options.db ?? getDb(env.DATABASE_URL);
  const V1 = '/api/v1';

  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'Route not found'), 404));
  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));
  if (env.CORS_ORIGIN)
    app.use(
      '/api/*',
      cors({
        origin: env.CORS_ORIGIN,
        allowHeaders: ['Authorization', 'Content-Type', 'X-Local-Date', 'X-Tz-Offset'],
      }),
    );
  app.use('/api/*', bodyLimit({ maxSize: 32 * 1024 }));
  app.use('*', async (c, next) => {
    c.set('env', env);
    c.set('db', db);
    await next();
  });
  app.use('/api/*', clientDayMiddleware);

  // ---- Public -------------------------------------------------------------
  app.get(`${V1}/health`, (c) => c.json({ ok: true }));
  registerTelegramWebhook(app, `${V1}/telegram/webhook`);
  const devAuth = env.ALLOW_DEV_AUTH && env.NODE_ENV !== 'production';
  if (devAuth) {
    // Dev only: initData signed with the real bot token -> normal verification path.
    app.get(`${V1}/dev/init-data`, (c) =>
      c.json({
        initData: signInitData(env.TELEGRAM_BOT_TOKEN, {
          id: env.DEV_TELEGRAM_USER_ID,
          first_name: 'Dev',
          username: 'dev_user',
        }),
      }),
    );
  }

  // ---- Protected ------------------------------------------------------------
  const router = new ApiRouter(app, V1);
  const publicPaths = new Set([`${V1}/health`, `${V1}/telegram/webhook`, `${V1}/openapi.json`]);
  if (devAuth) publicPaths.add(`${V1}/dev/init-data`);
  app.use(`${V1}/*`, (c, next) => (publicPaths.has(c.req.path) ? next() : requireAuth(c, next)));
  registerRoutes(router);

  const doc = router.openApiDocument({ title: 'Gym Tracker API', version: '1.0.0', serverUrl: V1 });
  const paths = doc.paths as Record<string, unknown>;
  paths['/health'] = {
    get: {
      tags: ['System'],
      summary: 'Health check',
      security: [],
      responses: { 200: { description: 'OK' } },
    },
  };
  paths['/telegram/webhook'] = {
    post: {
      tags: ['System'],
      summary: 'Telegram Bot API webhook (requires X-Telegram-Bot-Api-Secret-Token)',
      security: [],
      responses: { 200: { description: 'Processed' }, 401: { description: 'Bad secret' } },
    },
  };
  app.get(`${V1}/openapi.json`, (c) => c.json(doc));
  app.get('/api/docs', swaggerUI({ url: `${V1}/openapi.json` }));

  return app;
}

export type App = ReturnType<typeof createApp>;
