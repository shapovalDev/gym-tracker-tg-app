import type { MiddlewareHandler } from 'hono';
import type { Db } from '../db';
import { Prisma } from '../generated/prisma/client';
import { errorBody } from '../http/errors';
import type { AppEnv } from '../http/types';
import { verifyInitData } from './telegram';

// telegramId -> userId. Bounded; avoids an upsert on every request.
const userCache = new Map<string, string>();
const CACHE_LIMIT = 5000;

/**
 * Every protected request carries `Authorization: tma <initData>`.
 * The Telegram user id is taken *only* from verified initData — never from
 * query/body parameters.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.get('env');
  const header = c.req.header('authorization') ?? '';
  const [scheme, ...rest] = header.split(' ');
  const raw = scheme?.toLowerCase() === 'tma' ? rest.join(' ') : null;
  const result = verifyInitData(raw, env.TELEGRAM_BOT_TOKEN, {
    maxAgeSeconds: env.INIT_DATA_MAX_AGE_SECONDS,
  });
  if (!result.ok) {
    return c.json(
      errorBody('UNAUTHORIZED', `Telegram authentication failed (${result.reason})`),
      401,
    );
  }
  const telegramId = BigInt(result.user.id);
  const cacheKey = telegramId.toString();
  let userId = userCache.get(cacheKey);
  if (!userId) {
    userId = await findOrCreateUser(c.get('db'), telegramId);
    if (userCache.size >= CACHE_LIMIT) userCache.clear();
    userCache.set(cacheKey, userId);
  }
  c.set('userId', userId);
  c.set('telegramId', telegramId);
  await next();
};

/**
 * Prisma's upsert is not atomic: the first app launch fires several requests
 * at once and all of them may try to INSERT. The loser of the unique-index
 * race simply reads the winner's row.
 */
async function findOrCreateUser(db: Db, telegramId: bigint): Promise<string> {
  const existing = await db.user.findUnique({ where: { telegramId }, select: { id: true } });
  if (existing) return existing.id;
  try {
    return (await db.user.create({ data: { telegramId }, select: { id: true } })).id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return (await db.user.findUniqueOrThrow({ where: { telegramId }, select: { id: true } })).id;
    }
    throw err;
  }
}

/** For tests: user rows may be deleted between runs. */
export function clearUserCache() {
  userCache.clear();
}
