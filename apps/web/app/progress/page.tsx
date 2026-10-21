'use client';

import { formatWeight, PERIODS, type Period, type SessionPoint } from '@gym/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useMemo, useState } from 'react';
import {
  Change,
  Chip,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  Section,
  Segmented,
  Stat,
} from '@/components/ui';
import { ProgressChart } from '@/features/progress/progress-chart';
import { errorMessage } from '@/lib/api';
import { formatDate, formatShortDate, formatVolume, kg } from '@/lib/format';
import { useExerciseAnalytics, useExercises, useSummary } from '@/lib/queries';

const PERIOD_LABELS: Record<Period, string> = {
  '30d': '30 дн',
  '90d': '90 дн',
  '1y': 'Год',
  all: 'Всё',
};

type Metric = 'weight' | 'reps' | 'volume' | 'e1rm';
const METRICS: { value: Metric; label: string; unit: string; explain: string }[] = [
  {
    value: 'e1rm',
    label: 'e1RM',
    unit: 'кг',
    explain:
      'Расчётный максимум на 1 повтор по формуле Эпли: вес × (1 + повторы / 30). Это оценка, а не реально поднятый вес. Считается для подходов с весом > 0 и 1–12 повторами.',
  },
  {
    value: 'weight',
    label: 'Вес',
    unit: 'кг',
    explain: 'Максимальный вес среди выполненных подходов на каждой тренировке.',
  },
  {
    value: 'reps',
    label: 'Повторы',
    unit: 'повт.',
    explain:
      'Лучшее число повторений с выбранным весом — сравниваются только сопоставимые подходы.',
  },
  {
    value: 'volume',
    label: 'Объём',
    unit: 'кг',
    explain: 'Тоннаж: сумма вес × повторы по всем выполненным подходам упражнения за тренировку.',
  },
];

function valueOf(p: SessionPoint, m: Metric): number | null {
  if (m === 'weight') return p.maxWeightKg;
  if (m === 'reps') return p.repsAtWeight;
  if (m === 'volume') return p.volumeKg;
  return p.bestE1rmKg;
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
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [weight, setWeight] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const { data: exercises, isLoading: exLoading } = useExercises({ archived: true });
  const exerciseId = params.get('exercise') ?? exercises?.[0]?.id ?? null;
  const analytics = useExerciseAnalytics(exerciseId, period, metric === 'reps' ? weight : null);
  const summary = useSummary(period);
  const selectId = useId();
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

  if (exLoading) return <PageLoader />;
  if (!exercises || exercises.length === 0)
    return (
      <>
        <PageHeader title="Прогресс" />
        <EmptyState
          icon="📈"
          title="Пока нечего показать"
          text="Добавьте упражнения и проведите первую тренировку — графики строятся по реальным подходам."
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
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Тренировок"
            value={summary.data.completedWorkouts}
            sub={<Change pct={summary.data.changeWorkoutsPct} />}
          />
          <Stat label="Подходов" value={summary.data.totalSets} />
          <Stat
            label="Объём"
            value={<span className="text-lg">{formatVolume(summary.data.volumeKg)}</span>}
            sub={<Change pct={summary.data.changeVolumePct} />}
          />
        </div>
      )}
      {period !== 'all' && (
        <p className="-mt-3 px-1 text-xs text-muted">
          ↑↓ — изменение относительно предыдущего такого же периода.
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor={selectId} className="block px-1 text-[13px] font-medium text-muted">
          Упражнение
        </label>
        <select
          id={selectId}
          value={exerciseId ?? ''}
          onChange={(e) => router.replace(`/progress?exercise=${e.target.value}`)}
          className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-[16px] font-semibold text-text"
        >
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.archivedAt ? ' (архив)' : ''}
            </option>
          ))}
        </select>
      </div>

      {analytics.isLoading ? (
        <PageLoader />
      ) : analytics.error ? (
        <ErrorState message={errorMessage(analytics.error)} onRetry={() => analytics.refetch()} />
      ) : a ? (
        <>
          <div className="space-y-3 rounded-3xl bg-surface p-4">
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1"
              role="group"
              aria-label="Метрика"
            >
              {METRICS.map((m) => (
                <Chip key={m.value} active={metric === m.value} onClick={() => setMetric(m.value)}>
                  {m.label}
                </Chip>
              ))}
            </div>
            {metric === 'reps' && a.availableWeights.length > 0 && (
              <div
                className="-mx-1 flex gap-2 overflow-x-auto px-1"
                role="group"
                aria-label="Вес для сравнения повторов"
              >
                {a.availableWeights.map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={weight === w}
                    onClick={() => setWeight(w)}
                    className={`num h-8 shrink-0 rounded-full px-3 text-sm font-semibold ${weight === w ? 'bg-text text-surface' : 'bg-surface-2'}`}
                  >
                    {formatWeight(w)} кг
                  </button>
                ))}
              </div>
            )}
            {chartPoints.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">
                {a.points.length === 0
                  ? 'Нет завершённых подходов за этот период'
                  : 'Нет подходящих подходов для этой метрики'}
              </p>
            ) : chartPoints.length === 1 ? (
              <div className="py-8 text-center">
                <p className="num text-3xl font-bold">
                  {formatWeight(chartPoints[0]!.value)} {meta.unit}
                </p>
                <p className="text-sm text-muted">
                  {formatDate(chartPoints[0]!.date)} · для графика нужно больше одной тренировки
                </p>
              </div>
            ) : (
              <ProgressChart points={chartPoints} unit={meta.unit} label={meta.label} />
            )}
            <p className="text-xs text-muted">{meta.explain}</p>
            {chartPoints.length > 0 && (
              <button
                type="button"
                className="text-sm font-medium text-link"
                onClick={() => setShowTable(!showTable)}
                aria-expanded={showTable}
              >
                {showTable ? 'Скрыть таблицу' : 'Показать таблицей'}
              </button>
            )}
            {showTable && (
              <table className="num w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-medium">Дата</th>
                    <th className="py-1 text-right font-medium">{meta.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartPoints].reverse().map((p) => (
                    <tr key={p.date} className="border-t border-border">
                      <td className="py-1.5">{formatShortDate(p.date)}</td>
                      <td className="py-1.5 text-right font-semibold">
                        {formatWeight(p.value)} {meta.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Тренировок с упражнением" value={a.summary.sessions} />
            <Stat label="Рабочих подходов" value={a.summary.workingSets} />
            <Stat
              label="Объём за период"
              value={<span className="text-lg">{formatVolume(a.summary.volumeKg)}</span>}
              sub={<Change pct={a.summary.changeVolumePct} />}
            />
            <Stat
              label="Лучший e1RM"
              value={
                a.summary.bestE1rmKg !== null ? (
                  <span className="text-lg">≈ {kg(a.summary.bestE1rmKg)}</span>
                ) : (
                  '—'
                )
              }
              sub={<Change pct={a.summary.changeE1rmPct} />}
            />
          </div>

          <Section title="Личные рекорды · за всё время">
            <div className="divide-y divide-border overflow-hidden rounded-3xl bg-surface">
              <RecordRow
                label="Лучший рабочий вес"
                value={
                  a.records.bestWeight
                    ? `${kg(a.records.bestWeight.weightKg)} × ${a.records.bestWeight.reps}`
                    : null
                }
                date={a.records.bestWeight?.date}
              />
              <RecordRow
                label="Расчётный 1ПМ (e1RM, оценка)"
                value={a.records.bestE1rm ? `≈ ${kg(a.records.bestE1rm.value)}` : null}
                sub={
                  a.records.bestE1rm
                    ? `${kg(a.records.bestE1rm.weightKg)} × ${a.records.bestE1rm.reps}`
                    : undefined
                }
                date={a.records.bestE1rm?.date}
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
                  a.records.bestSessionVolume
                    ? formatVolume(a.records.bestSessionVolume.value)
                    : null
                }
                date={a.records.bestSessionVolume?.date}
              />
            </div>
          </Section>
        </>
      ) : null}
    </>
  );
}

function RecordRow({
  label,
  value,
  sub,
  date,
}: {
  label: string;
  value: string | null;
  sub?: string;
  date?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {date && (
          <span className="text-xs text-muted">
            {formatDate(date)}
            {sub ? ` · ${sub}` : ''}
          </span>
        )}
      </span>
      <span className="num shrink-0 font-bold">{value ?? '—'}</span>
    </div>
  );
}
