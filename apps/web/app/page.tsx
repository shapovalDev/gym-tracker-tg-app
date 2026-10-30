'use client';

import { weekdayOf } from '@gym/shared';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronRight, ListIcon, PlayIcon } from '@/components/icons';
import {
  DateBlock,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  Spinner,
} from '@/components/ui';
import { WeekStrip } from '@/features/home/week-strip';
import { WorkoutChooser } from '@/features/workout/workout-chooser';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { errorMessage } from '@/lib/api';
import { formatDuration, formatToday, formatVolume, weekdayLong } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { firstName } from '@/lib/telegram';
import { count, t, tn } from '@/i18n';

export default function HomePage() {
  const { data, isLoading, error, refetch } = useHome();
  const { start, pending } = useStartWorkout();
  const [choosing, setChoosing] = useState(false);
  const [name, setName] = useState<string>();
  useEffect(() => setName(firstName()), []);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const next = data.nextWorkout;
  return (
    <>
      <PageHeader
        title={name ? t('Hi, {name}', { name }) : t('Workouts')}
        subtitle={formatToday()}
      />

      <WeekStrip home={data} />

      {data.activeSession ? (
        <Island ghost={null}>
          <p className="eyebrow !text-island-muted">{t('Workout not finished')}</p>
          <p className="display text-[32px] leading-[1.02]">
            {data.activeSession.workoutName ?? t('Free workout')}
          </p>
          <IslandLink href="/workout">{t('Continue workout')}</IslandLink>
        </Island>
      ) : !data.activeProgram ? (
        <EmptyState
          title={t('Start with a program')}
          text={t(
            'A program is a set of workouts that repeat in a cycle: A, B, C… and A again. Create one and add exercises.',
          )}
          action={<LinkButton href="/programs/new">{t('Create program')}</LinkButton>}
        />
      ) : next ? (
        <Island ghost={String.fromCharCode(65 + (next.position % 26))}>
          <p className="eyebrow !text-island-muted">
            {next.weekday === null
              ? t('Up next in your program')
              : next.weekday === weekdayOf(new Date())
                ? t('Today in your program')
                : t('Next in your program: {day}', { day: weekdayLong(next.weekday) })}
          </p>
          <p className="display text-[32px] leading-[1.02]">{next.name}</p>
          {next.exerciseNames.length > 0 ? (
            <p className="text-[14px] leading-snug text-island-muted">
              {next.exerciseNames.slice(0, 3).join(' · ')}
              {next.exerciseNames.length > 3 &&
                ` · ${t('+{n} more', { n: next.exerciseNames.length - 3 })}`}
            </p>
          ) : (
            <p className="text-[14px] text-island-muted">
              {t('This workout has no exercises yet.')}
            </p>
          )}
          <div className="flex gap-2">
            {next.exerciseCount > 0 ? (
              <button
                type="button"
                disabled={pending}
                aria-busy={pending || undefined}
                onClick={() => start(next.id)}
                className="press display flex h-[54px] flex-1 items-center justify-center gap-2.5 rounded-[14px] bg-island-btn text-[20px] font-semibold tracking-[0.06em] text-on-island-btn disabled:opacity-60"
              >
                {pending ? <Spinner small /> : <PlayIcon />}
                {t('Start workout')}
              </button>
            ) : (
              <IslandLink href={`/programs/${data.activeProgram.id}`}>
                {t('Add exercises')}
              </IslandLink>
            )}
            <button
              type="button"
              aria-label={t('Choose another')}
              title={t('Choose another')}
              onClick={() => setChoosing(true)}
              className="press grid size-[54px] shrink-0 place-items-center rounded-[14px] border-2 border-on-island/25"
            >
              <ListIcon />
            </button>
          </div>
        </Island>
      ) : (
        <EmptyState
          title={t('The program has no workouts')}
          text={t('Add workouts to “{name}”.', { name: data.activeProgram.name })}
          action={
            <LinkButton href={`/programs/${data.activeProgram.id}`}>{t('Open program')}</LinkButton>
          }
        />
      )}

      <div className="grid grid-cols-2 border-y border-line">
        <div className="py-3">
          <div className="num text-[30px] leading-none font-semibold">
            {data.completedLast7Days}
          </div>
          <div className="mt-1.5 text-[13px] text-muted">
            {t('{workouts} this week', { workouts: tn(data.completedLast7Days, 'workout') })}
          </div>
        </div>
        <div className="border-l border-line py-3 pl-4">
          <div className="num text-[30px] leading-none font-semibold">
            {data.completedLast30Days}
          </div>
          <div className="mt-1.5 text-[13px] text-muted">{t('in 30 days')}</div>
        </div>
      </div>

      {data.lastSession && (
        <section className="space-y-2">
          <h2 className="eyebrow px-1">{t('Last workout')}</h2>
          <Link
            href={`/history/${data.lastSession.id}`}
            className="press flex items-center gap-3.5 rounded-[18px] border border-line bg-card p-3"
          >
            <DateBlock iso={data.lastSession.startedAt} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">
                {data.lastSession.workoutName ?? t('Free workout')}
              </span>
              <span className="block truncate text-[13px] text-muted">
                {formatDuration(data.lastSession.summary.durationSeconds)} ·{' '}
                {count(data.lastSession.summary.totalSets, 'set')} ·{' '}
                {formatVolume(data.lastSession.summary.volumeKg)}
              </span>
            </span>
            <span className="text-muted">
              <ChevronRight />
            </span>
          </Link>
        </section>
      )}

      {data.activeProgram && (
        <WorkoutChooser
          programId={data.activeProgram.id}
          open={choosing}
          onClose={() => setChoosing(false)}
          starting={pending}
          onStart={(id) => {
            setChoosing(false);
            void start(id);
          }}
        />
      )}
    </>
  );
}

/** The inverted hero surface with the workout letter in the background. */
function Island({ ghost, children }: { ghost: string | null; children: ReactNode }) {
  return (
    <div className="relative space-y-3.5 overflow-hidden rounded-[22px] bg-island p-5 text-on-island">
      {ghost && (
        <span
          aria-hidden
          className="display pointer-events-none absolute -top-3 right-3 text-[150px] leading-none text-island-ghost"
        >
          {ghost}
        </span>
      )}
      <div className="relative space-y-3.5">{children}</div>
    </div>
  );
}

function IslandLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="press display flex h-[54px] flex-1 items-center justify-center rounded-[14px] bg-island-btn text-[20px] font-semibold tracking-[0.06em] text-on-island-btn"
    >
      {children}
    </Link>
  );
}
