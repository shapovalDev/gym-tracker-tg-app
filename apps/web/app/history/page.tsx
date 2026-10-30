'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SessionListItemDto } from '@gym/shared';
import {
  Button,
  Chip,
  DateBlock,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PageLoader,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDuration, formatTime, formatVolume } from '@/lib/format';
import { useHistory } from '@/lib/queries';
import { count, intlLocale, t } from '@/i18n';

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
        className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
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
        <div className="space-y-5">
          {byMonth(items).map((g) => (
            <section key={g.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h2 className="display text-[20px] leading-none font-semibold">{g.title}</h2>
                <span className="text-[13px] text-muted">{count(g.items.length, 'workout')}</span>
              </div>
              <ul className="space-y-2">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/history/${s.id}`}
                      className="press flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                    >
                      <DateBlock iso={s.startedAt} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[16px] font-semibold">
                            {s.workoutName ?? t('Free workout')}
                          </span>
                          <span className="shrink-0 text-[13px] text-muted">
                            {formatTime(s.startedAt)}
                          </span>
                        </span>
                        {s.exerciseNames.length > 0 && (
                          <span className="block truncate text-[13px] text-muted">
                            {s.exerciseNames.join(', ')}
                          </span>
                        )}
                        <span className="num mt-1.5 flex flex-wrap items-center gap-x-2 text-[15px] font-semibold">
                          <span>{formatDuration(s.summary.durationSeconds)}</span>
                          <span aria-hidden className="text-muted">
                            ·
                          </span>
                          <span>{count(s.summary.totalSets, 'set')}</span>
                          <span aria-hidden className="text-muted">
                            ·
                          </span>
                          <span>{formatVolume(s.summary.volumeKg)}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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

/** Groups the (newest-first) list by calendar month, in local time. */
function byMonth(items: SessionListItemDto[]) {
  const fmt = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' });
  const thisYear = new Date().getFullYear();
  const groups: { key: string; title: string; items: SessionListItemDto[] }[] = [];
  for (const s of items) {
    const d = new Date(s.startedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    let g = groups.at(-1);
    if (g?.key !== key) {
      const title =
        d.getFullYear() === thisYear
          ? new Intl.DateTimeFormat(intlLocale(), { month: 'long' }).format(d)
          : fmt.format(d);
      g = { key, title: title.charAt(0).toUpperCase() + title.slice(1), items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }
  return groups;
}
