import { formatWeight } from '@gym/shared';
import { count, intlLocale, t } from '@/i18n';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(), opts);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return t('Today');
  if (days === 1) return t('Yesterday');
  return fmt(
    d.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' },
  ).format(d);
}

export const formatShortDate = (iso: string) =>
  fmt({ day: '2-digit', month: '2-digit' }).format(new Date(iso));
export const formatTime = (iso: string) =>
  fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const formatToday = () =>
  fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? t('{h} h {m} min', { h, m }) : t('{m} min', { m });
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const kg = (w: number) => `${formatWeight(w)} ${t('kg')}`;

export function formatVolume(v: number): string {
  if (v >= 10000)
    return `${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 }).format(v / 1000)} ${t('t')}`;
  return `${new Intl.NumberFormat(intlLocale(), { maximumFractionDigits: 1 }).format(v)} ${t('kg')}`;
}

export function targetLabel(
  plannedSets: number | null,
  min: number | null,
  max: number | null,
): string | null {
  const reps =
    min && max
      ? min === max
        ? `${min}`
        : `${min}–${max}`
      : min
        ? `${min}+`
        : max
          ? t('up to {n}', { n: max })
          : null;
  if (plannedSets && reps) return `${plannedSets} × ${reps}`;
  if (plannedSets) return count(plannedSets, 'set');
  if (reps) return t('{reps} reps', { reps });
  return null;
}

export const muscleLabel = (g: string) =>
  t(
    (
      {
        chest: 'Chest',
        back: 'Back',
        shoulders: 'Shoulders',
        biceps: 'Biceps',
        triceps: 'Triceps',
        forearms: 'Forearms',
        abs: 'Abs',
        quads: 'Quads',
        hamstrings: 'Hamstrings',
        glutes: 'Glutes',
        calves: 'Calves',
        full_body: 'Full body',
        cardio: 'Cardio',
        other: 'Other',
      } as const
    )[g as 'chest'] ?? 'Other',
  );

// 1 Jan 2024 was a Monday: weekday n (0 = Monday) is that date + n days.
const weekdayDate = (n: number) => new Date(2024, 0, 1 + n, 12);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "Пн", "Mon". */
export const weekdayShort = (n: number) =>
  capitalize(
    new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' })
      .format(weekdayDate(n))
      .replace('.', ''),
  );
/** "Понеділок", "Monday". */
export const weekdayLong = (n: number) =>
  capitalize(new Intl.DateTimeFormat(intlLocale(), { weekday: 'long' }).format(weekdayDate(n)));
