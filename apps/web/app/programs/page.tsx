'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronRight, PlusIcon } from '@/components/icons';
import {
  BottomBar,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  Segmented,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { usePrograms } from '@/lib/queries';
import { count, t } from '@/i18n';

export default function ProgramsPage() {
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const { data, isLoading, error, refetch } = usePrograms(tab === 'archived');
  const items = (data ?? []).filter((p) => (tab === 'archived' ? p.archivedAt : !p.archivedAt));

  return (
    <>
      <PageHeader
        title={t('Programs')}
        right={
          <Link
            href="/exercises"
            className="press mt-1 inline-flex h-10 items-center rounded-xl border border-line bg-card px-3 text-[15px] font-semibold"
          >
            {t('Exercises')}
          </Link>
        }
      />
      <Segmented
        label={t('Which programs to show')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: t('Mine') },
          { value: 'archived', label: t('Archive') },
        ]}
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        tab === 'active' ? (
          <EmptyState
            title={t('No programs yet')}
            text={t('Create a program and add workouts and exercises to it.')}
            action={<LinkButton href="/programs/new">{t('Create program')}</LinkButton>}
          />
        ) : (
          <EmptyState
            title={t('The archive is empty')}
            text={t('Programs you remove from the list end up here. Their history is kept.')}
          />
        )
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/programs/${p.id}`}
                className={`press flex items-center gap-3 rounded-[22px] border bg-card p-4 ${p.isActive ? 'border-primary' : 'border-line'}`}
              >
                <span className="min-w-0 flex-1">
                  {p.isActive && (
                    <span className="mb-1 block text-[13px] font-semibold text-primary">
                      {t('Active')}
                    </span>
                  )}
                  <span className="block truncate text-[18px] font-semibold">{p.name}</span>
                  <span className="block truncate text-[14px] text-muted">
                    {count(p.workoutCount, 'workout')}
                    {p.description ? `. ${p.description}` : ''}
                  </span>
                </span>
                <span className="text-muted">
                  <ChevronRight />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tab === 'active' && items.length > 0 && (
        <BottomBar>
          <LinkButton href="/programs/new" variant="secondary" className="flex-1">
            <PlusIcon /> {t('New program')}
          </LinkButton>
        </BottomBar>
      )}
    </>
  );
}
