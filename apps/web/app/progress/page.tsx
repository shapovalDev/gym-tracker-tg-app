'use client';

import { formatWeight, PERIODS, type Period, type SessionPoint } from '@gym/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Change,
  Chip,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  Section,
  Segmented,
  Select,
  Stat,
  cx,
} from '@/components/ui';
import { ProgressChart } from '@/features/progress/progress-chart';
import { errorMessage } from '@/lib/api';
import { formatDate, formatShortDate, formatVolume, kg } from '@/lib/format';
import { useExerciseAnalytics, useExercises, useSummary } from '@/lib/queries';

const PERIOD_LABELS: Record<Period, string> = {
  '30d': '30 дней',
  '90d': '90 дней',
  '1y': 'Год',
  all: 'Всё',
};

type Metric = 'weight' | 'reps' | 'volume';
const METRICS: { value: Metric; label: string; unit: string; explain: string }[] = [
  {
    value: 'weight',
    label: 'Вес',
    unit: 'кг',
    explain: 'Самый большой вес среди выполненных подходов на каждой тренировке.',
  },
  {
    value: 'reps',
    label: 'Повторы',
    unit: 'повт.',
    explain:
      'Лучшее число повторений с выбранным весом. Сравниваются только подходы с одинаковым весом.',
  },
  {
    value: 'volume',
    label: 'Объём',
    unit: 'кг',
    explain: 'Сумма «вес × повторы» по всем выполненным подходам упражнения за тренировку.',
  },
];

function valueOf(p: SessionPoint, m: Metric): number | null {
  if (m === 'weight') return p.maxWeightKg;
  if (m === 'reps') return p.repsAtWeight;
  return p.volumeKg;
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Progress />
    </Suspense>
  );
}

function Progress() {
  const router = useRouter();
  const params = useSearchParams();
  const [period, setPeriod] = useState<Period>('90d');
  const [metric, setMetric] = useState<Metric>('weight');
  const [weight, setWeight] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const { data: exercises, isLoading: exLoading } = useExercises({ archived: true });
  const exerciseId = params.get('exercise') ?? exercises?.[0]?.id ?? null;
  const analytics = useExerciseAnalytics(exerciseId, period, metric === 'reps' ? weight : null);
  const summary = useSummary(period);
  const a = analytics.data;

  // Default the "reps at weight" selector to the heaviest weight in range.
  useEffect(() => {
    if (metric !== 'reps' || !a) return;
    if (weight === null || !a.availableWeights.includes(weight))
      setWeight(a.availableWeights[0] ?? null);
  }, [metric, a, weight]);

  const meta = METRICS.find((m) => m.value === metric)!;
  const chartPoints = useMemo(
    () =>
      (a?.points ?? []).flatMap((p) => {
        const v = valueOf(p, metric);
        return v === null ? [] : [{ date: p.date, value: v }];
      }),
    [a, metric],
  );
  const bestWeightInPeriod = a?.points.length
    ? Math.max(...a.points.map((p) => p.maxWeightKg))
    : null;

  if (exLoading) return <PageLoader />;
  if (!exercises || exercises.length === 0)
    return (
      <>
        <PageHeader title="Прогресс" />
        <EmptyState
          title="Пока нечего показать"
          text="Графики строятся по записанным подходам. Добавьте упражнения и проведите первую тренировку."
          action={<LinkButton href="/exercises">К упражнениям</LinkButton>}
        />
      </>
    );

  return (
    <>
      <PageHeader title="Прогресс" />
      <Segmented
        label="Период"
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p] }))}
      />

      {summary.data && (
        <Section title="Все тренировки за период">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Тренировок"
              value={summary.data.completedWorkouts}
              sub={period !== 'all' && <Change pct={summary.data.changeWorkoutsPct} />}
            />
            <Stat
              label="Объём"
              value={formatVolume(summary.data.volumeKg)}
              sub={period !== 'all' && <Change pct={summary.data.changeVolumePct} />}
            />
          </div>
        </Section>
      )}

      <Section title="Упражнение">
        <Select
          label="Выберите упражнение"
          value={exerciseId ?? ''}
          onChange={(v) => router.replace(`/progress?exercise=${v}`)}
        >
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.archivedAt ? ' (архив)' : ''}
            </option>
          ))}
        </Select>

        {analytics.isLoading ? (
          <PageLoader />
        ) : analytics.error ? (
          <ErrorState message={errorMessage(analytics.error)} onRetry={() => analytics.refetch()} />
        ) : a ? (
          <>
            <Card className="space-y-3 p-4">
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1"
                role="group"
                aria-label="Что показать на графике"
              >
                {METRICS.map((m) => (
                  <Chip
                    key={m.value}
                    active={metric === m.value}
                    onClick={() => setMetric(m.value)}
                  >
                    {m.label}
                  </Chip>
                ))}
              </div>
              {metric === 'reps' && a.availableWeights.length > 0 && (
                <div
                  className="-mx-1 flex items-center gap-2 overflow-x-auto px-1"
                  role="group"
                  aria-label="Вес для сравнения повторов"
                >
                  <span className="shrink-0 text-[14px] text-muted">С весом</span>
                  {a.availableWeights.map((w) => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={weight === w}
                      onClick={() => setWeight(w)}
                      className={cx(
                        'num h-9 shrink-0 rounded-full px-3 text-[14px] font-semibold',
                        weight === w ? 'bg-ink text-card' : 'bg-inset',
                      )}
                    >
                      {formatWeight(w)}
                    </button>
                  ))}
                </div>
              )}
              {chartPoints.length === 0 ? (
                <p className="py-12 text-center text-[15px] text-muted">
                  {a.points.length === 0
                    ? 'За этот период подходов нет'
                    : 'Нет подходов для этого графика'}
                </p>
              ) : chartPoints.length === 1 ? (
                <div className="py-8 text-center">
                  <p className="num text-[32px] font-semibold">
                    {formatWeight(chartPoints[0]!.value)} {meta.unit}
                  </p>
                  <p className="text-[14px] text-muted">
                    {formatDate(chartPoints[0]!.date)}. Для графика нужна ещё хотя бы одна
                    тренировка.
                  </p>
                </div>
              ) : (
                <ProgressChart points={chartPoints} unit={meta.unit} label={meta.label} />
              )}
              <p className="text-[13px] text-muted">{meta.explain}</p>
              {chartPoints.length > 0 && (
                <button
                  type="button"
                  className="text-[14px] font-semibold text-primary"
                  onClick={() => setShowTable(!showTable)}
                  aria-expanded={showTable}
                >
                  {showTable ? 'Скрыть таблицу' : 'Показать таблицей'}
                </button>
              )}
              {showTable && (
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 font-medium">Дата</th>
                      <th className="py-1 text-right font-medium">{meta.label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...chartPoints].reverse().map((p) => (
                      <tr key={p.date} className="border-t border-line">
                        <td className="py-2">{formatShortDate(p.date)}</td>
                        <td className="num py-2 text-right font-semibold">
                          {formatWeight(p.value)} {meta.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Тренировок с ним"
                value={a.summary.sessions}
                sub={`${a.summary.workingSets} подходов`}
              />
              <Stat
                label="Макс. вес за период"
                value={bestWeightInPeriod !== null ? kg(bestWeightInPeriod) : '—'}
              />
            </div>
          </>
        ) : null}
      </Section>

      {a && (
        <Section title="Личные рекорды" hint="За всё время">
          <Card className="divide-y divide-line">
            <RecordRow
              label="Лучший рабочий вес"
              value={
                a.records.bestWeight
                  ? `${kg(a.records.bestWeight.weightKg)} × ${a.records.bestWeight.reps}`
                  : null
              }
              date={a.records.bestWeight?.date}
            />
            {metric === 'reps' && weight !== null && (
              <RecordRow
                label={`Больше всего повторов с ${kg(weight)}`}
                value={
                  a.records.bestRepsAtWeight ? `${a.records.bestRepsAtWeight.reps} повт.` : null
                }
                date={a.records.bestRepsAtWeight?.date}
              />
            )}
            <RecordRow
              label="Объём за тренировку"
              value={
                a.records.bestSessionVolume ? formatVolume(a.records.bestSessionVolume.value) : null
              }
              date={a.records.bestSessionVolume?.date}
            />
          </Card>
        </Section>
      )}
    </>
  );
}

function RecordRow({ label, value, date }: { label: string; value: string | null; date?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="min-w-0">
        <span className="block text-[15px]">{label}</span>
        {date && <span className="text-[13px] text-muted">{formatDate(date)}</span>}
      </span>
      <span className="num shrink-0 text-[17px] font-semibold">{value ?? '—'}</span>
    </div>
  );
}
