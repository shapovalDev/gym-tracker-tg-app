'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { formatClock } from '@/lib/format';
import { useOutbox } from '@/lib/outbox';
import { useActiveSession } from '@/lib/queries';
import { backButton } from '@/lib/telegram';
import { dismissToast, useToasts } from '@/lib/toast';
import { t } from '@/i18n';
import { cx } from './ui';

// Labels are translated at render time (the locale can change at runtime).
const TABS = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/programs', label: 'Programs', icon: ListIcon },
  { href: '/history', label: 'History', icon: ClockIcon },
  { href: '/progress', label: 'Progress', icon: ChartIcon },
  { href: '/settings', label: 'More', icon: DotsIcon },
] as const;

const isTabRoot = (p: string) => TABS.some((tab) => tab.href === p);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inWorkout = pathname.startsWith('/workout');
  const { data: session } = useActiveSession();
  useTelegramBackButton(!isTabRoot(pathname));

  // Height of everything fixed at the bottom; pages and BottomBar offset by it.
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-h', '60px');
  }, []);

  return (
    <div
      className="mx-auto min-h-dvh max-w-lg"
      style={{ paddingTop: 'calc(8px + var(--safe-top))' }}
    >
      {/* The workout can be left at any time; this banner leads back to it. */}
      {session && !inWorkout && (
        <ActiveSessionBanner name={session.workoutName} startedAt={session.startedAt} />
      )}
      <main
        className="space-y-6 px-4"
        style={{ paddingBottom: 'calc(var(--nav-h, 60px) + 104px + var(--safe-bottom))' }}
      >
        {children}
      </main>
      <nav
        aria-label={t('Main navigation')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        <TabBar pathname={pathname} workoutActive={!!session} />
      </nav>
      <SyncIndicator />
      <Toasts />
    </div>
  );
}

function TabBar({ pathname, workoutActive }: { pathname: string; workoutActive: boolean }) {
  return (
    <ul className="mx-auto flex max-w-lg">
      {TABS.map((tab) => {
        const active =
          tab.href === '/'
            ? pathname === '/' || (workoutActive && pathname.startsWith('/workout'))
            : pathname.startsWith(tab.href) ||
              (tab.href === '/programs' && pathname.startsWith('/exercises'));
        return (
          <li key={tab.href} className="flex-1">
            <Link
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
                active ? 'text-nav-active' : 'text-muted',
              )}
            >
              <span
                className={cx(
                  'grid h-[30px] w-[54px] place-items-center rounded-full transition-colors',
                  active && 'bg-nav-pill',
                )}
              >
                <tab.icon />
              </span>
              {t(tab.label)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sticky reminder on every page while a workout is running. */
function ActiveSessionBanner({ name, startedAt }: { name: string | null; startedAt: string }) {
  const elapsed = useElapsed(startedAt);
  return (
    <div className="sticky z-30 px-4 pb-2" style={{ top: 'calc(4px + var(--safe-top))' }}>
      <Link
        href="/workout"
        className="press flex items-center justify-between gap-3 rounded-2xl bg-island py-2.5 pr-2.5 pl-4 text-on-island shadow-lg"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-current" />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-[0.12em] text-island-muted uppercase">
              {t('Workout in progress')}
            </span>
            <span className="block truncate text-[15px] font-semibold">
              {name ?? t('Free workout')}{' '}
              <span className="num font-medium">· {formatClock(elapsed)}</span>
            </span>
          </span>
        </span>
        <span className="display shrink-0 rounded-xl bg-island-btn px-3 py-2 text-[15px] font-semibold tracking-[0.04em] text-on-island-btn">
          {t('Continue')}
        </span>
      </Link>
    </div>
  );
}

export function useElapsed(startedAt: string | undefined | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
}

function SyncIndicator() {
  const { queue, lastError } = useOutbox();
  if (queue.length === 0) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 z-40 mx-auto w-fit rounded-full bg-skip-soft px-3 py-1 text-[13px] font-semibold text-skip shadow"
      style={{ top: 'calc(6px + var(--safe-top))' }}
    >
      {lastError === 'offline' ? t('Offline.') : t('Saving…')}{' '}
      {t('{n} not sent', { n: queue.length })}
    </div>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] mx-auto max-w-lg space-y-2 px-4"
      style={{ bottom: 'calc(var(--nav-h, 60px) + 88px + var(--safe-bottom))' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'anim-pop pointer-events-auto flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium shadow-lg',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-island text-on-island',
          )}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 font-bold underline decoration-2 underline-offset-4"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Shows Telegram's native back button on nested screens. */
function useTelegramBackButton(visible: boolean) {
  const router = useRouter();
  useEffect(() => {
    const btn = backButton();
    if (!btn) return;
    const onBack = () => router.back();
    if (visible) {
      btn.show();
      btn.onClick(onBack);
    } else btn.hide();
    return () => btn.offClick(onBack);
  }, [visible, router]);
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
function HomeIcon() {
  return <Icon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
}
function ListIcon() {
  return <Icon d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />;
}
function ClockIcon() {
  return <Icon d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />;
}
function ChartIcon() {
  return <Icon d="M3 3v18h18M7 15l4-4 3 3 5-6" />;
}
function DotsIcon() {
  return <Icon d="M5 12h.01M12 12h.01M19 12h.01" />;
}
