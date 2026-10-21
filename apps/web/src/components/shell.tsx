'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useOutbox } from '@/lib/outbox';
import { useActiveSession } from '@/lib/queries';
import { backButton } from '@/lib/telegram';
import { useToasts } from '@/lib/toast';
import { formatClock } from '@/lib/format';
import { cx } from './ui';

const TABS = [
  { href: '/', label: 'Главная', icon: HomeIcon },
  { href: '/programs', label: 'Программы', icon: ListIcon },
  { href: '/history', label: 'История', icon: ClockIcon },
  { href: '/progress', label: 'Прогресс', icon: ChartIcon },
  { href: '/settings', label: 'Ещё', icon: DotsIcon },
];

const isTabRoot = (p: string) => TABS.some((t) => t.href === p);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inWorkout = pathname.startsWith('/workout');
  useTelegramBackButton(!isTabRoot(pathname));
  return (
    <div
      className="mx-auto min-h-dvh max-w-lg"
      style={{ paddingTop: 'calc(8px + var(--safe-top))' }}
    >
      <main
        className="space-y-5 px-4"
        style={{
          paddingBottom: inWorkout
            ? 'calc(24px + var(--safe-bottom))'
            : 'calc(140px + var(--safe-bottom))',
        }}
      >
        {children}
      </main>
      {!inWorkout && <ActiveSessionBar />}
      {!inWorkout && <TabBar pathname={pathname} />}
      <SyncIndicator />
      <Toasts />
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-accent' : 'text-muted',
                )}
              >
                <t.icon />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveSessionBar() {
  const { data: session } = useActiveSession();
  const elapsed = useElapsed(session?.startedAt);
  if (!session) return null;
  return (
    <Link
      href="/workout"
      className="press fixed inset-x-3 z-30 mx-auto flex max-w-[calc(32rem-24px)] items-center justify-between rounded-2xl bg-accent px-4 py-3 text-on-accent shadow-lg"
      style={{ bottom: 'calc(64px + var(--safe-bottom))' }}
    >
      <span className="min-w-0">
        <span className="block text-xs opacity-80">
          Тренировка идёт · <span className="num">{formatClock(elapsed)}</span>
        </span>
        <span className="block truncate font-semibold">
          {session.workoutName ?? 'Свободная тренировка'}
        </span>
      </span>
      <span className="font-semibold">Продолжить →</span>
    </Link>
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
      className="fixed inset-x-0 z-40 mx-auto w-fit rounded-full bg-warning px-3 py-1 text-xs font-semibold text-black shadow"
      style={{ top: 'calc(6px + var(--safe-top))' }}
    >
      {lastError === 'offline' ? 'Нет сети · ' : 'Сохранение · '}
      {queue.length} не отправлено
    </div>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto max-w-lg space-y-2 px-4"
      style={{ paddingTop: 'calc(36px + var(--safe-top))' }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'anim-in rounded-2xl px-4 py-3 text-sm font-medium shadow-lg',
            t.tone === 'error'
              ? 'bg-danger text-white'
              : t.tone === 'success'
                ? 'bg-success text-white'
                : 'bg-text text-surface',
          )}
        >
          {t.text}
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
