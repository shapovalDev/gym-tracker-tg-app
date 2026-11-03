'use client';

import type { MeDto } from '@gym/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { meKey } from '@/i18n/provider';
import { t } from '@/i18n';
import { ApiError, http } from '@/lib/api';
import { Spinner } from './ui';

export const isForbidden = (e: unknown) => e instanceof ApiError && e.code === 'FORBIDDEN';

/**
 * Mounts the app only once the server has accepted this Telegram user.
 * Users outside `ALLOWED_TELEGRAM_IDS` get a dead-end screen: no navigation,
 * no buttons, nothing to tap. Other errors (offline, 5xx) still let the app
 * render so pages can show their own retry states.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { isPending, error } = useQuery({
    queryKey: meKey,
    queryFn: () => http.get<MeDto>('/me'),
    staleTime: Infinity,
  });
  if (isForbidden(error)) return <AccessDenied />;
  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }
  return <>{children}</>;
}

export function AccessDenied() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center select-none">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-12 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </svg>
      <h1 role="alert" className="display text-[30px] leading-[1.05]">
        {t('This app is private')}
      </h1>
      <p className="max-w-[300px] text-[16px] text-muted">
        {t('Access is limited to invited users. Ask the owner to add your Telegram account.')}
      </p>
    </main>
  );
}
