import { formatSeconds, formatWeight, type TrackingType } from '@gym/shared';
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

/** Fields of a recorded set needed to show its result. */
export interface SetResult {
  weightKg: number;
  reps: number;
  durationSec?: number | null;
}

/**
 * The result of a completed set in the exercise's terms:
 * "50 kg × 8", "+10 kg × 8" / "8 reps", "−30 kg × 8" (counterweight), "1:15 · +10 kg".
 * `compact` drops units for dense rows ("50×8", "−30×8", "1:15").
 */
export function formatSetResult(s: SetResult, type: TrackingType, compact = false): string {
  const w = formatWeight(s.weightKg);
  const load = compact ? w : `${w} ${t('kg')}`;
  const times = compact ? '×' : ' × ';
  switch (type) {
    case 'duration': {
      const time = formatSeconds(s.durationSec ?? 0);
      if (s.weightKg <= 0) return time;
      return compact ? `${time}+${w}` : `${time} · +${load}`;
    }
    case 'bodyweight':
      if (s.weightKg <= 0) return compact ? String(s.reps) : t('{reps} reps', { reps: s.reps });
      return `+${load}${times}${s.reps}`;
    case 'assisted':
      return `${s.weightKg > 0 ? '−' : ''}${load}${times}${s.reps}`;
    default:
      return `${load}${times}${s.reps}`;
  }
}

export function targetLabel(
  plannedSets: number | null,
  min: number | null,
  max: number | null,
  /** Timed exercises keep their target in seconds. */
  type: TrackingType = 'weight_reps',
): string | null {
  if (type === 'duration') {
    const range =
      min && max
        ? min === max
          ? formatSeconds(min)
          : `${formatSeconds(min)}–${formatSeconds(max)}`
        : min
          ? `${formatSeconds(min)}+`
          : max
            ? t('up to {n}', { n: formatSeconds(max) })
            : null;
    if (plannedSets && range) return `${plannedSets} × ${range}`;
    if (plannedSets) return count(plannedSets, 'set');
    return range;
  }
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

// English keys, translated at render time.
export const TRACKING_LABELS = {
  weight_reps: 'Weight × reps',
  bodyweight: 'Body weight',
  assisted: 'Assisted (counterweight)',
  duration: 'For time',
} as const;

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
