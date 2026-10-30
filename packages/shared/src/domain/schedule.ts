/**
 * Weekly schedule of a program: a planned workout may be pinned to a day of the
 * week. Days are 0 = Monday … 6 = Sunday (ISO order, independent of locale).
 */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Day of the week of a date in local time, Monday-based. */
export const weekdayOf = (d: Date) => (d.getDay() + 6) % 7;

/**
 * Cycle order that follows the calendar: scheduled workouts by day, then the
 * unscheduled ones in their original order. Stable.
 */
export function orderBySchedule<T extends { weekday?: number | null }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, key: item.weekday ?? WEEKDAYS.length }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((x) => x.item);
}

/** True when no two items share a day. */
export const hasDistinctWeekdays = (items: readonly { weekday?: number | null }[]) => {
  const days = items.map((i) => i.weekday).filter((d): d is number => d != null);
  return new Set(days).size === days.length;
};

export interface WeekDay {
  weekday: number;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  isToday: boolean;
  /** Cycle position of a workout completed that day (the last one), or -1 for one outside the program. */
  donePosition: number | null;
  /** Cycle position of the workout planned for that day, if any. */
  plannedPosition: number | null;
}

const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The current Monday-to-Sunday week in the device's time zone, with what was
 * done and what is planned on each day.
 */
export function currentWeek(
  now: Date,
  done: readonly { startedAt: string; position: number | null }[],
  schedule: readonly { weekday: number; position: number }[],
): WeekDay[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekdayOf(now));
  const doneByDate = new Map<string, number>();
  for (const w of done) doneByDate.set(localDate(new Date(w.startedAt)), w.position ?? -1);
  const today = localDate(now);
  return WEEKDAYS.map((weekday) => {
    const date = localDate(
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weekday),
    );
    return {
      weekday,
      date,
      isToday: date === today,
      donePosition: doneByDate.get(date) ?? null,
      plannedPosition: schedule.find((s) => s.weekday === weekday)?.position ?? null,
    };
  });
}

/** A calendar day in the user's time zone, as UTC bounds [start, end). */
export interface LocalDay {
  weekday: number;
  start: Date;
  end: Date;
}

/**
 * @param date local calendar date, YYYY-MM-DD
 * @param offsetMinutes the zone's offset east of UTC (+120 for UTC+2)
 */
export function localDay(date: string, offsetMinutes: number): LocalDay {
  const [y, m, d] = date.split('-').map(Number);
  const midnightUtc = Date.UTC(y!, m! - 1, d!);
  const start = midnightUtc - offsetMinutes * 60_000;
  return {
    weekday: (new Date(midnightUtc).getUTCDay() + 6) % 7,
    start: new Date(start),
    end: new Date(start + 86_400_000),
  };
}

/**
 * Next workout by the calendar, for programs with pinned days: the workout of
 * the first planned day from today on. Today counts only while nothing of the
 * program was completed today (after that the next planned day comes up).
 * Returns null when no workout has a day: then the cycle decides.
 */
export function nextScheduledWorkoutId(
  workouts: readonly { id: string; weekday?: number | null }[],
  todayWeekday: number,
  doneToday: boolean,
): string | null {
  const byDay = new Map<number, string>();
  for (const w of workouts) if (w.weekday != null) byDay.set(w.weekday, w.id);
  if (byDay.size === 0) return null;
  // up to 7 days ahead: with one planned day done today, it comes back next week
  for (let i = doneToday ? 1 : 0; i <= WEEKDAYS.length; i++) {
    const id = byDay.get((todayWeekday + i) % WEEKDAYS.length);
    if (id) return id;
  }
  return null;
}
