'use client';

import {
  formatSeconds,
  formatWeight,
  PERIODS,
  type Period,
  type PersonalRecords,
  type RecordEntry,
  type SessionPoint,
  type TrackingType,
} from '@gym/shared';
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
import { formatDate, formatSetResult, formatShortDate, formatVolume, kg } from '@/lib/format';
import { useExerciseAnalytics, useExercises, useSummary } from '@/lib/queries';
import { count, t, type MsgKey } from '@/i18n';

// English keys, translated at render time.
const PERIOD_LABELS = {
  '30d': '30 days',
  '90d': '90 days',
  '1y': 'Year',
  all: 'All',
} as const satisfies Record<Period, MsgKey>;

type Metric = 'weight' | 'reps' | 'volume' | 'maxReps' | 'extra' | 'assist' | 'time';
interface MetricDef {
  value: Metric;
  label: MsgKey;
  /** Empty for time, which is formatted as "1:15". */
  unit: MsgKey | null;
  explain: MsgKey;
  of: (p: SessionPoint) => number | null;
}
const M: Record<Metric, MetricDef> = {
  weight: {
    value: 'weight',
    label: 'Weight',
    unit: 'kg',
    explain: 'The heaviest weight among completed working sets in each workout.',
    of: (p) => p.maxWeightKg,
  },
  reps: {
    value: 'reps',
    label: 'Reps',
    unit: 'reps',
    explain:
      'The best number of reps at the selected weight. Only sets with the same weight are compared.',
    of: (p) => p.repsAtWeight,
  },
  volume: {
    value: 'volume',
    label: 'Volume',
    unit: 'kg',
    explain: 'The sum of weight × reps over all working sets of the exercise in a workout.',
    of: (p) => p.volumeKg,
  },
  maxReps: {
    value: 'maxReps',
    label: 'Reps',
    unit: 'reps',
    explain: 'The most reps in one working set in each workout.',
    of: (p) => p.maxReps,
  },
  extra: {
    value: 'extra',
    label: 'Extra weight',
    unit: 'kg',
    explain: 'The heaviest extra weight in each workout.',
    of: (p) => p.maxWeightKg,
  },
  assist: {
    value: 'assist',
    label: 'Counterweight',
    unit: 'kg',
    explain:
      'The smallest counterweight in each workout. Less help means more strength, so the chart goes up as it drops.',
    of: (p) => p.minWeightKg,
  },
  time: {
    value: 'time',
    label: 'Time',
    unit: null,
    explain: 'The longest working set in each workout.',
    of: (p) => p.maxDurationSec,
  },
};
/** Charts that make sense for each way of tracking; the first is the default. */
const METRICS_BY_TYPE: Record<TrackingType, MetricDef[]> = {
  weight_reps: [M.weight, M.reps, M.volume],
  bodyweight: [M.maxReps, M.extra],
  assisted: [M.assist, M.reps],
  duration: [M.time, M.extra],
};
const formatMetric = (m: MetricDef, v: number) =>
  m.unit === null ? formatSeconds(v) : `${formatWeight(v)} ${t(m.unit)}`;

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
  const [chosenMetric, setMetric] = useState<Metric>('weight');
  const [weight, setWeight] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const { data: exercises, isLoading: exLoading } = useExercises({ archived: true });
  const exerciseId = params.get('exercise') ?? exercises?.[0]?.id ?? null;
  const type: TrackingType =
    exercises?.find((e) => e.id === exerciseId)?.trackingType ?? 'weight_reps';
  const metrics = METRICS_BY_TYPE[type];
  const meta = metrics.find((m) => m.value === chosenMetric) ?? metrics[0]!;
  const metric = meta.value;
  const analytics = useExerciseAnalytics(exerciseId, period, metric === 'reps' ? weight : null);
  const summary = useSummary(period);
  const a = analytics.data;

  // Default the "reps at weight" selector to the heaviest weight in range.
  useEffect(() => {
    if (metric !== 'reps' || !a) return;
    if (weight === null || !a.availableWeights.includes(weight))
      setWeight(a.availableWeights[0] ?? null);
  }, [metric, a, weight]);

  const chartPoints = useMemo(
    () =>
      (a?.points ?? []).flatMap((p) => {
        const v = meta.of(p);
        return v === null ? [] : [{ date: p.date, value: v }];
      }),
    [a, meta],
  );
  // The headline "best in period" in the exercise's own terms.
  const bestInPeriod = (() => {
    const ps = a?.points ?? [];
    if (ps.length === 0) return null;
    switch (type) {
      case 'bodyweight':
        return {
          label: t('Most reps in period'),
          value: String(Math.max(...ps.map((p) => p.maxReps))),
        };
      case 'assisted':
        return {
          label: t('Least counterweight in period'),
          value: kg(Math.min(...ps.map((p) => p.minWeightKg))),
        };
      case 'duration':
        return {
          label: t('Longest in period'),
          value: formatSeconds(Math.max(...ps.map((p) => p.maxDurationSec ?? 0))),
        };
      default:
        return {
          label: t('Max weight in period'),
          value: kg(Math.max(...ps.map((p) => p.maxWeightKg))),
        };
    }
  })();

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
                className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1"
                role="group"
                aria-label={t('What to show on the chart')}
              >
                {metrics.map((m) => (
                  <Chip
                    key={m.value}
                    active={metric === m.value}
                    onClick={() => setMetric(m.value)}
                  >
                    {t(m.label)}
                  </Chip>
                ))}
              </div>
              {metric === 'reps' && a.availableWeights.length > 0 && (
                <div
                  className="scroll-row -mx-1 flex items-center gap-2 overflow-x-auto px-1"
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
                    {formatMetric(meta, chartPoints[0]!.value)}
                  </p>
                  <p className="text-[14px] text-muted">
                    {formatDate(chartPoints[0]!.date)}.{' '}
                    {t('The chart needs at least one more workout.')}
                  </p>
                </div>
              ) : (
                <ProgressChart
                  points={chartPoints}
                  unit={meta.unit ? t(meta.unit) : ''}
                  label={t(meta.label)}
                  format={meta.unit === null ? formatSeconds : undefined}
                  invert={metric === 'assist'}
                />
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
                          {formatMetric(meta, p.value)}
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
                label={bestInPeriod?.label ?? t('Best in period')}
                value={bestInPeriod?.value ?? '—'}
              />
            </div>
          </>
        ) : null}
      </Section>

      {a && (
        <Section title={t('Personal records')} hint={t('All time')}>
          <Card className="divide-y divide-line">
            {records(a.records, type).map((r) => (
              <RecordRow key={r.label} label={r.label} value={r.value} date={r.date} />
            ))}
            {metric === 'reps' && weight !== null && (
              <RecordRow
                label={
                  type === 'assisted'
                    ? t('Most reps with {weight} counterweight', { weight: kg(weight) })
                    : t('Most reps at {weight}', { weight: kg(weight) })
                }
                value={
                  a.records.bestRepsAtWeight
                    ? t('{reps} reps', { reps: a.records.bestRepsAtWeight.reps })
                    : null
                }
                date={a.records.bestRepsAtWeight?.date}
              />
            )}
            {type === 'weight_reps' && (
              <RecordRow
                label={t('Volume in one workout')}
                value={
                  a.records.bestSessionVolume
                    ? formatVolume(a.records.bestSessionVolume.value)
                    : null
                }
                date={a.records.bestSessionVolume?.date}
              />
            )}
          </Card>
        </Section>
      )}
    </>
  );
}

/** All-time records that make sense for the way the exercise is tracked. */
function records(
  r: PersonalRecords,
  type: TrackingType,
): { label: string; value: string | null; date?: string }[] {
  const row = (label: string, e: RecordEntry | null, text?: (e: RecordEntry) => string) => ({
    label,
    value: e ? (text ? text(e) : formatSetResult(e, type)) : null,
    date: e?.date,
  });
  switch (type) {
    case 'bodyweight':
      return [
        row(t('Most reps in one set'), r.bestReps),
        row(t('Heaviest extra weight'), r.bestWeight),
      ];
    case 'assisted':
      return [row(t('Least counterweight'), r.leastWeight)];
    case 'duration':
      return [
        row(t('Longest set'), r.longestDuration),
        row(t('Heaviest extra weight'), r.bestWeight),
      ];
    default:
      return [row(t('Best working weight'), r.bestWeight)];
  }
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
