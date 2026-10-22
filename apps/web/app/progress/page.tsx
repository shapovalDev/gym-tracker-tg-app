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
import { count, t, type MsgKey } from '@/i18n';

// English keys, translated at render time.
const PERIOD_LABELS = {
  '30d': '30 days',
  '90d': '90 days',
  '1y': 'Year',
  all: 'All',
} as const satisfies Record<Period, MsgKey>;

type Metric = 'weight' | 'reps' | 'volume';
const METRICS: { value: Metric; label: MsgKey; unit: MsgKey; explain: MsgKey }[] = [
  {
    value: 'weight',
    label: 'Weight',
    unit: 'kg',
    explain: 'The heaviest weight among completed working sets in each workout.',
  },
  {
    value: 'reps',
    label: 'Reps',
    unit: 'reps',
    explain:
      'The best number of reps at the selected weight. Only sets with the same weight are compared.',
  },
  {
    value: 'volume',
    label: 'Volume',
    unit: 'kg',
    explain: 'The sum of weight × reps over all working sets of the exercise in a workout.',
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
        <PageHeader title={t('Progress')} />
        <EmptyState
          title={t('Nothing to show yet')}
          text={t('Charts are built from recorded sets. Add exercises and do your first workout.')}
          action={<LinkButton href="/exercises">{t('Go to exercises')}</LinkButton>}
        />
      </>
    );

  return (
    <>
      <PageHeader title={t('Progress')} />
      <Segmented
        label={t('Period')}
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p, label: t(PERIOD_LABELS[p]) }))}
      />

      {summary.data && (
        <Section title={t('All workouts in the period')}>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label={t('Workouts')}
              value={summary.data.completedWorkouts}
              sub={period !== 'all' && <Change pct={summary.data.changeWorkoutsPct} />}
            />
            <Stat
              label={t('Volume')}
              value={formatVolume(summary.data.volumeKg)}
              sub={period !== 'all' && <Change pct={summary.data.changeVolumePct} />}
            />
          </div>
        </Section>
      )}

      <Section title={t('Exercise')}>
        <Select
          label={t('Choose an exercise')}
          value={exerciseId ?? ''}
          onChange={(v) => router.replace(`/progress?exercise=${v}`)}
        >
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.archivedAt ? ` (${t('archived')})` : ''}
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
                aria-label={t('What to show on the chart')}
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
                  aria-label={t('Weight to compare reps at')}
                >
                  <span className="shrink-0 text-[14px] text-muted">{t('At weight')}</span>
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
                    ? t('No sets in this period')
                    : t('No sets for this chart')}
                </p>
              ) : chartPoints.length === 1 ? (
                <div className="py-8 text-center">
                  <p className="num text-[32px] font-semibold">
                    {formatWeight(chartPoints[0]!.value)} {t(meta.unit)}
                  </p>
                  <p className="text-[14px] text-muted">
                    {formatDate(chartPoints[0]!.date)}.{' '}
                    {t('The chart needs at least one more workout.')}
                  </p>
                </div>
              ) : (
                <ProgressChart points={chartPoints} unit={t(meta.unit)} label={t(meta.label)} />
              )}
              <p className="text-[13px] text-muted">{t(meta.explain)}</p>
              {chartPoints.length > 0 && (
                <button
                  type="button"
                  className="text-[14px] font-semibold text-primary"
                  onClick={() => setShowTable(!showTable)}
                  aria-expanded={showTable}
                >
                  {showTable ? t('Hide table') : t('Show as table')}
                </button>
              )}
              {showTable && (
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="py-1 font-medium">{t('Date')}</th>
                      <th className="py-1 text-right font-medium">{t(meta.label)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...chartPoints].reverse().map((p) => (
                      <tr key={p.date} className="border-t border-line">
                        <td className="py-2">{formatShortDate(p.date)}</td>
                        <td className="num py-2 text-right font-semibold">
                          {formatWeight(p.value)} {t(meta.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={t('Workouts with it')}
                value={a.summary.sessions}
                sub={count(a.summary.workingSets, 'set')}
              />
              <Stat
                label={t('Max weight in period')}
                value={bestWeightInPeriod !== null ? kg(bestWeightInPeriod) : '—'}
              />
            </div>
          </>
        ) : null}
      </Section>

      {a && (
        <Section title={t('Personal records')} hint={t('All time')}>
          <Card className="divide-y divide-line">
            <RecordRow
              label={t('Best working weight')}
              value={
                a.records.bestWeight
                  ? `${kg(a.records.bestWeight.weightKg)} × ${a.records.bestWeight.reps}`
                  : null
              }
              date={a.records.bestWeight?.date}
            />
            {metric === 'reps' && weight !== null && (
              <RecordRow
                label={t('Most reps at {weight}', { weight: kg(weight) })}
                value={
                  a.records.bestRepsAtWeight
                    ? t('{reps} reps', { reps: a.records.bestRepsAtWeight.reps })
                    : null
                }
                date={a.records.bestRepsAtWeight?.date}
              />
            )}
            <RecordRow
              label={t('Volume in one workout')}
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
