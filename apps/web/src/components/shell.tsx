'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { formatClock } from '@/lib/format';
import { useOutbox } from '@/lib/outbox';
import { useActiveSession } from '@/lib/queries';
import { backButton } from '@/lib/telegram';
import { dismissToast, useToasts } from '@/lib/toast';
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
  const { data: session } = useActiveSession();
  const showSessionBar = !inWorkout && !!session;
  useTelegramBackButton(!isTabRoot(pathname));

  // Height of everything fixed at the bottom; pages and BottomBar offset by it.
  useEffect(() => {
    const nav = inWorkout ? 0 : showSessionBar ? 60 + 56 : 60;
    document.documentElement.style.setProperty('--nav-h', `${nav}px`);
  }, [inWorkout, showSessionBar]);

  return (
    <div
      className="mx-auto min-h-dvh max-w-lg"
      style={{ paddingTop: 'calc(8px + var(--safe-top))' }}
    >
      <main
        className="space-y-6 px-4"
        style={{ paddingBottom: 'calc(var(--nav-h, 60px) + 104px + var(--safe-bottom))' }}
      >
        {children}
      </main>
      {!inWorkout && (
        <nav
          aria-label="Основная навигация"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          {session && <ActiveSessionBar name={session.workoutName} startedAt={session.startedAt} />}
          <TabBar pathname={pathname} />
        </nav>
      )}
      <SyncIndicator />
      <Toasts />
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <ul className="mx-auto flex max-w-lg">
      {TABS.map((t) => {
        const active =
          t.href === '/'
            ? pathname === '/'
            : pathname.startsWith(t.href) ||
              (t.href === '/programs' && pathname.startsWith('/exercises'));
        return (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold',
                active ? 'text-primary' : 'text-muted',
              )}
            >
              <t.icon />
              {t.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveSessionBar({ name, startedAt }: { name: string | null; startedAt: string }) {
  const elapsed = useElapsed(startedAt);
  return (
    <Link
      href="/workout"
      className="press flex h-14 items-center justify-between gap-3 bg-primary px-4 text-on-primary"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70 motion-reduce:hidden" />
          <span className="relative inline-flex size-2.5 rounded-full bg-white" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">
            {name ?? 'Свободная тренировка'}
          </span>
          <span className="num block text-[12px] opacity-85">идёт {formatClock(elapsed)}</span>
        </span>
      </span>
      <span className="shrink-0 rounded-xl bg-white/20 px-3 py-1.5 text-[14px] font-semibold">
        Вернуться
      </span>
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
      className="fixed inset-x-0 z-40 mx-auto w-fit rounded-full bg-skip-soft px-3 py-1 text-[13px] font-semibold text-skip shadow"
      style={{ top: 'calc(6px + var(--safe-top))' }}
    >
      {lastError === 'offline' ? 'Нет сети. ' : 'Сохраняю… '}
      {queue.length} не отправлено
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
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-card',
          )}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 font-semibold text-primary-soft underline-offset-2 hover:underline"
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
