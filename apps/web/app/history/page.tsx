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
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
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
          icon="📅"
          title={range === 'all' ? 'Пока нет тренировок' : 'Нет тренировок за период'}
          text={range === 'all' ? 'Завершённые тренировки появятся здесь.' : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/history/${s.id}`} className="press block rounded-3xl bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-semibold">
                    {s.workoutName ?? 'Свободная тренировка'}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {formatDate(s.startedAt)}, {formatTime(s.startedAt)}
                  </span>
                </div>
                {s.programName && <p className="text-xs text-muted">{s.programName}</p>}
                <p className="mt-1 text-sm text-muted">
                  {formatDuration(s.summary.durationSeconds)} · {s.summary.totalSets}{' '}
                  {plural(s.summary.totalSets, 'подход', 'подхода', 'подходов')} ·{' '}
                  {formatVolume(s.summary.volumeKg)}
                </p>
                {s.exerciseNames.length > 0 && (
                  <p className="mt-1 truncate text-sm">{s.exerciseNames.join(' · ')}</p>
                )}
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
