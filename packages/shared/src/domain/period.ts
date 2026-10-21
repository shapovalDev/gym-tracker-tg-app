import type { Period } from '../constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '30d': 30, '90d': 90, '1y': 365 };

export interface DateRange {
  from: Date | null;
  to: Date;
}

/** Range for a period ending at `now`. `all` has no lower bound. */
export function periodRange(period: Period, now: Date = new Date()): DateRange {
  if (period === 'all') return { from: null, to: now };
  return { from: new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS), to: now };
}

/** The equivalent preceding period (same length, immediately before). `all` has none. */
export function previousPeriodRange(period: Period, now: Date = new Date()): DateRange | null {
  if (period === 'all') return null;
  const current = periodRange(period, now);
  const length = PERIOD_DAYS[period] * DAY_MS;
  return { from: new Date(current.from!.getTime() - length), to: current.from! };
}

/** Inclusive `from`, exclusive `to`. */
export function isInRange(date: Date, range: { from: Date | null; to: Date | null }): boolean {
  const t = date.getTime();
  if (range.from && t < range.from.getTime()) return false;
  if (range.to && t >= range.to.getTime()) return false;
  return true;
}

export function filterByDateRange<T>(
  items: readonly T[],
  getDate: (item: T) => Date,
  range: { from: Date | null; to: Date | null },
): T[] {
  return items.filter((item) => isInRange(getDate(item), range));
}

export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
}
