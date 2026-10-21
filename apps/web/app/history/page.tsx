'use client';

import Link from 'next/link';
import { useState } from 'react';
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
import { formatDate, formatDuration, formatTime, formatVolume, plural } from '@/lib/format';
import { useHistory } from '@/lib/queries';

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
  const filter =
    range === 'custom'
      ? { from: from ? dayStart(from) : undefined, to: to ? dayEnd(to) : undefined }
      : range === 'all'
        ? {}
        : { from: new Date(Date.now() - Number(range) * 86400000).toISOString() };
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useHistory(filter);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="История" />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Период">
        {(
          [
            ['all', 'Всё время'],
            ['30', '30 дней'],
            ['90', '90 дней'],
            ['custom', 'Период…'],
          ] as const
        ).map(([v, l]) => (
          <Chip key={v} active={range === v} onClick={() => setRange(v)}>
            {l}
          </Chip>
        ))}
      </div>
      {range === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="С"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Field
            label="По"
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
          title={range === 'all' ? 'Пока нет тренировок' : 'За этот период тренировок нет'}
          text={
            range === 'all' ? 'Здесь появятся завершённые тренировки.' : 'Выберите другой период.'
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
                    {s.workoutName ?? 'Свободная тренировка'}
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
                  <span>
                    {s.summary.totalSets}{' '}
                    {plural(s.summary.totalSets, 'подход', 'подхода', 'подходов')}
                  </span>
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
          Показать ещё
        </Button>
      )}
    </>
  );
}
