import { formatWeight } from '@gym/shared';

const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
const dateYearFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });
const weekdayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  return d.getFullYear() === now.getFullYear() ? dateFmt.format(d) : dateYearFmt.format(d);
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const formatShortDate = (iso: string) => shortFmt.format(new Date(iso));
export const formatWeekday = (iso: string) => weekdayFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const kg = (w: number) => `${formatWeight(w)} кг`;

export function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1).replace('.', ',')} т`;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v)} кг`;
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
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
          ? `до ${max}`
          : null;
  if (plannedSets && reps) return `${plannedSets} × ${reps}`;
  if (plannedSets) return `${plannedSets} ${plural(plannedSets, 'подход', 'подхода', 'подходов')}`;
  if (reps) return `${reps} повт.`;
  return null;
}
