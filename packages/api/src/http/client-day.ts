import { AsyncLocalStorage } from 'node:async_hooks';
import { localDay, type LocalDay } from '@gym/shared';
import type { MiddlewareHandler } from 'hono';

/**
 * The user's "today". The server runs in UTC, but which workout is planned for
 * today depends on the user's calendar day, so the client sends its local date
 * and UTC offset with every request (X-Local-Date: YYYY-MM-DD, X-Tz-Offset:
 * minutes east of UTC). Missing or invalid headers fall back to the UTC day.
 */
const storage = new AsyncLocalStorage<LocalDay>();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OFFSET = 14 * 60;
const DAY_MS = 86_400_000;

export function parseClientDay(
  date: string | undefined,
  offset: string | undefined,
  now = new Date(),
): LocalDay {
  const minutes = Number(offset);
  if (date && DATE.test(date) && Number.isInteger(minutes) && Math.abs(minutes) <= MAX_OFFSET) {
    const day = localDay(date, minutes);
    // a client clock off by more than a day is not trusted
    if (
      !Number.isNaN(day.start.getTime()) &&
      Math.abs(day.start.getTime() - now.getTime()) < 2 * DAY_MS
    )
      return day;
  }
  return localDay(now.toISOString().slice(0, 10), 0);
}

export const clientDayMiddleware: MiddlewareHandler = (c, next) =>
  storage.run(parseClientDay(c.req.header('x-local-date'), c.req.header('x-tz-offset')), next);

/** Today in the time zone of the current request's user (UTC outside a request). */
export const clientToday = (): LocalDay =>
  storage.getStore() ?? parseClientDay(undefined, undefined);
