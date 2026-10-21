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
          <Link
            href="/exercises"
            className="press mt-1 inline-flex h-10 items-center rounded-xl border border-line bg-card px-3 text-[15px] font-semibold"
          >
            Упражнения
          </Link>
        }
      />
      <Segmented
        label="Какие программы показать"
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
            title="Программ пока нет"
            text="Создайте программу, добавьте в неё тренировки и упражнения."
            action={<LinkButton href="/programs/new">Создать программу</LinkButton>}
          />
        ) : (
          <EmptyState
            title="Архив пуст"
            text="Сюда попадают программы, которые вы убрали из списка. История по ним сохраняется."
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
                      Активная
                    </span>
                  )}
                  <span className="block truncate text-[18px] font-semibold">{p.name}</span>
                  <span className="block truncate text-[14px] text-muted">
                    {p.workoutCount}{' '}
                    {plural(p.workoutCount, 'тренировка', 'тренировки', 'тренировок')}
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
            <PlusIcon /> Новая программа
          </LinkButton>
        </BottomBar>
      )}
    </>
  );
}
