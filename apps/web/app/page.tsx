'use client';

import Link from 'next/link';
import {
  Button,
  Card,
  Change,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  Section,
  Stat,
} from '@/components/ui';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDuration, formatVolume, kg, plural } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { firstName } from '@/lib/telegram';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { data, isLoading, error, refetch } = useHome();
  const { start, pending } = useStartWorkout();
  const [name, setName] = useState<string>();
  useEffect(() => setName(firstName()), []);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader
        title={name ? `Привет, ${name}` : 'Тренировки'}
        subtitle={new Intl.DateTimeFormat('ru-RU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
      />

      {data.activeSession ? (
        <Card className="space-y-3 bg-accent text-on-accent">
          <div>
            <p className="text-sm opacity-80">Незавершённая тренировка</p>
            <p className="text-xl font-bold">
              {data.activeSession.workoutName ?? 'Свободная тренировка'}
            </p>
          </div>
          <LinkButton
            href="/workout"
            variant="secondary"
            className="w-full !bg-white/20 !text-on-accent"
          >
            Продолжить
          </LinkButton>
        </Card>
      ) : !data.activeProgram ? (
        <EmptyState
          icon="🏋️"
          title="Создайте первую программу"
          text="Программа — это цикл тренировок (например, A → B → C → D), который повторяется по кругу."
          action={<LinkButton href="/programs/new">Создать программу</LinkButton>}
        />
      ) : (
        <Card className="space-y-4">
          <div>
            <p className="text-[13px] font-medium text-muted">{data.activeProgram.name}</p>
            {data.nextWorkout ? (
              <>
                <p className="text-[13px] text-muted">Следующая тренировка</p>
                <p className="mt-1 text-2xl font-bold">{data.nextWorkout.name}</p>
                <p className="text-sm text-muted">
                  {data.nextWorkout.exerciseCount}{' '}
                  {plural(data.nextWorkout.exerciseCount, 'упражнение', 'упражнения', 'упражнений')}
                </p>
              </>
            ) : (
              <p className="mt-1 text-lg font-semibold">В программе пока нет тренировок</p>
            )}
          </div>
          {data.nextWorkout ? (
            <div className="space-y-2">
              <Button block size="lg" loading={pending} onClick={() => start(data.nextWorkout!.id)}>
                Начать тренировку
              </Button>
              <Link
                href={`/programs/${data.activeProgram.id}`}
                className="block py-1 text-center text-sm font-medium text-link"
              >
                Выбрать другую тренировку
              </Link>
            </div>
          ) : (
            <LinkButton href={`/programs/${data.activeProgram.id}`} className="w-full">
              Добавить тренировки
            </LinkButton>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="За 7 дней"
          value={data.completedLast7Days}
          sub={plural(data.completedLast7Days, 'тренировка', 'тренировки', 'тренировок')}
        />
        <Stat
          label="За 30 дней"
          value={data.completedLast30Days}
          sub={plural(data.completedLast30Days, 'тренировка', 'тренировки', 'тренировок')}
        />
      </div>

      {data.lastSession && (
        <Section title="Последняя тренировка">
          <Link
            href={`/history/${data.lastSession.id}`}
            className="press block rounded-3xl bg-surface p-4"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">
                {data.lastSession.workoutName ?? 'Свободная тренировка'}
              </span>
              <span className="text-sm text-muted">{formatDate(data.lastSession.startedAt)}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatDuration(data.lastSession.summary.durationSeconds)} ·{' '}
              {data.lastSession.summary.totalSets}{' '}
              {plural(data.lastSession.summary.totalSets, 'подход', 'подхода', 'подходов')} ·{' '}
              {formatVolume(data.lastSession.summary.volumeKg)}
            </p>
          </Link>
        </Section>
      )}

      {data.highlights.length > 0 && (
        <Section
          title="Прогресс"
          action={
            <Link href="/progress" className="text-sm font-medium text-link">
              Все
            </Link>
          }
        >
          <div className="divide-y divide-border overflow-hidden rounded-3xl bg-surface">
            {data.highlights.map((h) => (
              <Link
                key={h.exerciseId}
                href={`/progress?exercise=${h.exerciseId}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.name}</span>
                  <span className="text-xs text-muted">
                    {formatDate(h.lastDate)} · макс. {kg(h.lastMaxWeightKg)}
                    {h.lastBestE1rmKg !== null && ` · e1RM ≈ ${kg(h.lastBestE1rmKg)}`}
                  </span>
                </span>
                <Change pct={h.changeE1rmPct} />
              </Link>
            ))}
          </div>
          <p className="px-1 text-xs text-muted">
            Изменение расчётного 1ПМ (e1RM) относительно предыдущей тренировки.
          </p>
        </Section>
      )}
    </>
  );
}
