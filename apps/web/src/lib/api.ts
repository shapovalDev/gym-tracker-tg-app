import type { ApiError as ApiErrorBody } from '@gym/shared';
import { t, type MsgKey } from '@/i18n';
import { getInitData } from './telegram';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Request never reached the server (offline, DNS, timeout). Safe to retry. */
export class NetworkError extends Error {}

export const isRetryable = (e: unknown) =>
  e instanceof NetworkError || (e instanceof ApiError && (e.status >= 500 || e.status === 429));

const BASE = '/api/v1';

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const initData = await getInitData();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        authorization: `tma ${initData}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : 'Network error');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON (e.g. proxy error page) */
  }
  if (!res.ok) {
    const err = (json as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }
  return json as T;
}

export const http = {
  get: <T>(p: string) => api<T>('GET', p),
  post: <T>(p: string, b: unknown = {}) => api<T>('POST', p, b),
  put: <T>(p: string, b: unknown) => api<T>('PUT', p, b),
  patch: <T>(p: string, b: unknown) => api<T>('PATCH', p, b),
  del: <T = void>(p: string) => api<T>('DELETE', p),
};

export function errorMessage(e: unknown): string {
  if (e instanceof NetworkError) return t('No connection to the server');
  if (e instanceof ApiError) {
    if (e.status === 401) return t('Could not sign in with Telegram');
    if (e.code === 'VALIDATION_ERROR') return t('Check the entered data');
    const known: Partial<Record<string, MsgKey>> = {
      SESSION_IN_PROGRESS: 'Finish or cancel the current workout first',
      SESSION_CANCELLED: 'This workout was cancelled and can no longer be changed',
      EXERCISE_ARCHIVED: 'Archived exercises cannot be added',
      PROGRAM_ARCHIVED: 'Restore the program from the archive first',
      TOO_MANY_SETS: 'Too many sets for one exercise',
      NOT_FOUND: 'Not found. It may have been deleted.',
    };
    const key = known[e.code];
    return key ? t(key) : t('Something went wrong');
  }
  if (e instanceof Error && e.message === 'NOT_IN_TELEGRAM')
    return t('Open the app from the Telegram bot');
  return t('Something went wrong');
}
