import { DURATION_MAX_SEC } from '../constants';

/**
 * Time of a timed set as typed by the user: "1:30", "1.30" or "1,30" (mobile
 * numeric keyboards have no colon) mean 1 min 30 s; "1:02:05" adds hours; a
 * bare number is seconds ("45"). Returns null for anything else or out of range.
 */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim().replace(/[.,]/g, ':');
  if (!/^\d{1,5}(:\d{1,2}){0,2}$/.test(s)) return null;
  const parts = s.split(':').map(Number);
  if (parts.slice(1).some((p) => p > 59)) return null;
  const sec = parts.reduce((acc, p) => acc * 60 + p, 0);
  return sec <= DURATION_MAX_SEC ? sec : null;
}

/** 75 → "1:15", 5 → "0:05", 3725 → "1:02:05". */
export function formatSeconds(total: number): string {
  const sec = Math.max(0, Math.round(total));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
