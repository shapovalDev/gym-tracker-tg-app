'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlayIcon } from '@/components/icons';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  PlateBadge,
  Section,
} from '@/components/ui';
import { WorkoutChooser } from '@/features/workout/workout-chooser';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDuration, formatVolume, plural } from '@/lib/format';
import { useHome } from '@/lib/queries';
import { firstName } from '@/lib/telegram';

const today = () =>
  new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  );

export default function HomePage() {
  const { data, isLoading, error, refetch } = useHome();
  const { start, pending } = useStartWorkout();
  const [choosing, setChoosing] = useState(false);
  const [name, setName] = useState<string>();
  useEffect(() => setName(firstName()), []);

  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  return (
    <>
      <PageHeader title={name ? `Привет, ${name}` : 'Тренировки'} subtitle={today()} />

      {data.activeSession ? (
        <Card className="space-y-4 border-primary p-5">
          <div>
            <p className="text-[14px] font-medium text-primary">Тренировка не завершена</p>
            <p className="mt-1 text-[22px] leading-tight font-semibold">
              {data.activeSession.workoutName ?? 'Свободная тренировка'}
            </p>
          </div>
          <LinkButton href="/workout" size="lg" className="w-full">
            Продолжить тренировку
          </LinkButton>
        </Card>
      ) : !data.activeProgram ? (
        <EmptyState
          title="Начните с программы"
          text="Программа — это тренировки, которые идут по кругу: A, B, C… и снова A. Создайте её и добавьте упражнения."
          action={<LinkButton href="/programs/new">Создать программу</LinkButton>}
        />
      ) : data.nextWorkout ? (
        <Card className="overflow-hidden">
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <PlateBadge index={data.nextWorkout.position} size="lg" />
              <div className="min-w-0">
                <p className="text-[14px] text-muted">Сегодня по программе</p>
                <p className="text-[22px] leading-tight font-semibold">{data.nextWorkout.name}</p>
              </div>
            </div>
            {data.nextWorkout.exerciseNames.length > 0 ? (
              <ol className="space-y-1.5 text-[15px]">
                {data.nextWorkout.exerciseNames.map((n, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="num w-5 shrink-0 text-right text-muted">{i + 1}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[15px] text-muted">В этой тренировке пока нет упражнений.</p>
            )}
          </div>
          <div className="space-y-2 border-t border-line bg-inset p-4">
            {data.nextWorkout.exerciseCount > 0 ? (
              <Button block size="lg" loading={pending} onClick={() => start(data.nextWorkout!.id)}>
                <PlayIcon /> Начать тренировку
              </Button>
            ) : (
              <LinkButton href={`/programs/${data.activeProgram.id}`} size="lg" className="w-full">
                Добавить упражнения
              </LinkButton>
            )}
            <Button block variant="ghost" onClick={() => setChoosing(true)}>
              Выбрать другую
            </Button>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="В программе нет тренировок"
          text={`Добавьте тренировки в «${data.activeProgram.name}».`}
          action={
            <LinkButton href={`/programs/${data.activeProgram.id}`}>Открыть программу</LinkButton>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="num text-[30px] leading-none font-semibold">
            {data.completedLast7Days}
          </div>
          <div className="mt-1.5 text-[14px] text-muted">
            {plural(data.completedLast7Days, 'тренировка', 'тренировки', 'тренировок')} за неделю
          </div>
        </Card>
        <Card className="p-4">
          <div className="num text-[30px] leading-none font-semibold">
            {data.completedLast30Days}
          </div>
          <div className="mt-1.5 text-[14px] text-muted">за 30 дней</div>
        </Card>
      </div>

      {data.lastSession && (
        <Section title="Прошлая тренировка">
          <Link
            href={`/history/${data.lastSession.id}`}
            className="press block rounded-[22px] border border-line bg-card p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold">
                {data.lastSession.workoutName ?? 'Свободная тренировка'}
              </span>
              <span className="shrink-0 text-[14px] text-muted">
                {formatDate(data.lastSession.startedAt)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[14px]">
              <Metric
                value={formatDuration(data.lastSession.summary.durationSeconds)}
                label="время"
              />
              <Metric
                value={String(data.lastSession.summary.totalSets)}
                label={plural(data.lastSession.summary.totalSets, 'подход', 'подхода', 'подходов')}
              />
              <Metric value={formatVolume(data.lastSession.summary.volumeKg)} label="объём" />
            </div>
          </Link>
        </Section>
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

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-inset px-3 py-2">
      <div className="num text-[16px] font-semibold">{value}</div>
      <div className="text-[12px] text-muted">{label}</div>
    </div>
  );
}
