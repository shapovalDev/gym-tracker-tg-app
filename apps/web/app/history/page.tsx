'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PageLoader,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDuration, formatTime, formatVolume } from '@/lib/format';
import { useHistory } from '@/lib/queries';
import { count, t } from '@/i18n';

type Range = 'all' | '30' | '90' | 'custom';

/** <input type="date"> value (local day) -> ISO bounds [from, to). */
function dayStart(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toISOString();
}
function dayEnd(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d! + 1).toISOString();
}

export default function HistoryPage() {
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // The filter is part of the query key, so it must not change between renders:
  // "last N days" starts at local midnight instead of "now minus N days" (which
  // produced a new key — and a new request — on every render).
  const filter = useMemo(() => {
    if (range === 'custom')
      return { from: from ? dayStart(from) : undefined, to: to ? dayEnd(to) : undefined };
    if (range === 'all') return {};
    const d = new Date();
    return {
      from: new Date(d.getFullYear(), d.getMonth(), d.getDate() - Number(range) + 1).toISOString(),
    };
  }, [range, from, to]);
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useHistory(filter);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title={t('History')} />
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        role="group"
        aria-label={t('Period')}
      >
        {(
          [
            ['all', t('All time')],
            ['30', t('30 days')],
            ['90', t('90 days')],
            ['custom', t('Custom…')],
          ] as const
        ).map(([v, l]) => (
          <Chip key={v} active={range === v} onClick={() => setRange(v)}>
            {l}
          </Chip>
        ))}
      </div>
      {range === 'custom' && (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Field
            label={t('From')}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Field
            label={t('To')}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      )}

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={range === 'all' ? t('No workouts yet') : t('No workouts in this period')}
          text={
            range === 'all' ? t('Finished workouts will appear here.') : t('Choose another period.')
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((s) => (
            <li key={s.id}>
              <Link
                href={`/history/${s.id}`}
                className="press block rounded-[22px] border border-line bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[17px] font-semibold">
                    {s.workoutName ?? t('Free workout')}
                  </span>
                  <span className="shrink-0 text-[14px] text-muted">
                    {formatDate(s.startedAt)}, {formatTime(s.startedAt)}
                  </span>
                </div>
                {s.exerciseNames.length > 0 && (
                  <p className="mt-1 line-clamp-2 text-[14px] text-muted">
                    {s.exerciseNames.join(', ')}
                  </p>
                )}
                <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                  <span>{formatDuration(s.summary.durationSeconds)}</span>
                  <span>{count(s.summary.totalSets, 'set')}</span>
                  <span>{formatVolume(s.summary.volumeKg)}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hasNextPage && (
        <Button
          block
          variant="secondary"
          loading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {t('Show more')}
        </Button>
      )}
    </>
  );
}
