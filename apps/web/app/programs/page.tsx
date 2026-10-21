'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  PageLoader,
  Segmented,
} from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { plural } from '@/lib/format';
import { usePrograms } from '@/lib/queries';

export default function ProgramsPage() {
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const { data, isLoading, error, refetch } = usePrograms(tab === 'archived');
  const items = (data ?? []).filter((p) => (tab === 'archived' ? p.archivedAt : !p.archivedAt));

  return (
    <>
      <PageHeader
        title="Программы"
        right={
          <Link href="/exercises" className="pb-1 text-[15px] font-medium text-link">
            Упражнения
          </Link>
        }
      />
      <Segmented
        label="Фильтр программ"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Мои' },
          { value: 'archived', label: 'Архив' },
        ]}
      />
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        tab === 'active' ? (
          <EmptyState
            icon="📋"
            title="Программ пока нет"
            text="Создайте программу и добавьте в неё тренировки."
            action={<LinkButton href="/programs/new">Создать программу</LinkButton>}
          />
        ) : (
          <EmptyState icon="🗄️" title="Архив пуст" />
        )
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/programs/${p.id}`} className="press block rounded-3xl bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-lg font-semibold">{p.name}</span>
                  {p.isActive && (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                      Активна
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {p.workoutCount}{' '}
                  {plural(p.workoutCount, 'тренировка', 'тренировки', 'тренировок')}
                  {p.description ? ` · ${p.description}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tab === 'active' && items.length > 0 && (
        <LinkButton href="/programs/new" variant="secondary" className="w-full">
          + Новая программа
        </LinkButton>
      )}
    </>
  );
}
