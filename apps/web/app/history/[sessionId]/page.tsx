'use client';

import type { SessionDto, SetDto } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Button,
  ConfirmSheet,
  ErrorState,
  PageHeader,
  PageLoader,
  Section,
  Stat,
} from '@/components/ui';
import { SetEntry, type SetEntryValue } from '@/features/workout/set-entry';
import { SetRow } from '@/features/workout/set-list';
import { errorMessage, http } from '@/lib/api';
import { formatDate, formatDuration, formatTime, formatVolume } from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { queryKeys, useSession } from '@/lib/queries';

const STATS = [['home'], ['history'], ['analytics'], ['summary']];

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: s, isLoading, error, refetch } = useSession(sessionId);
  const [editing, setEditing] = useState<{ set: SetDto | null; exerciseId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingSet, setDeletingSet] = useState<SetDto | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
  const saveSet = useApiMutation(
    ({
      v,
      set,
      exerciseId,
      number,
    }: {
      v: SetEntryValue;
      set: SetDto | null;
      exerciseId: string;
      number: number;
    }) =>
      http.put(`/sessions/${sessionId}/sets/${set?.id ?? crypto.randomUUID()}`, {
        sessionExerciseId: exerciseId,
        setNumber: set?.setNumber ?? number,
        weightKg: v.weightKg,
        reps: v.reps,
        status: v.status,
      }),
    {
      invalidate: STATS,
      success: 'Сохранено',
      onSuccess: () => {
        setEditing(null);
        void refresh();
      },
    },
  );
  const removeSet = useApiMutation(
    (set: SetDto) => http.del(`/sessions/${sessionId}/sets/${set.id}`),
    {
      invalidate: STATS,
      onSuccess: () => {
        setDeletingSet(null);
        void refresh();
      },
    },
  );
  const removeSession = useApiMutation(() => http.del(`/sessions/${sessionId}`), {
    invalidate: STATS,
    success: 'Тренировка удалена',
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.session(sessionId) });
      router.replace('/history');
    },
  });

  if (isLoading) return <PageLoader />;
  if (error || !s) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;
  const editable = s.status !== 'cancelled';

  return (
    <>
      <PageHeader
        title={s.workoutName ?? 'Свободная тренировка'}
        subtitle={`${formatDate(s.startedAt)}, ${formatTime(s.startedAt)}${s.programName ? `, ${s.programName}` : ''}`}
      />
      {s.status === 'cancelled' && (
        <p className="rounded-2xl bg-skip-soft px-4 py-3 text-[15px]">
          Тренировка была отменена и не учитывается в статистике.
        </p>
      )}
      <SummaryGrid s={s} />
      {s.exercises.map((e) => (
        <Section key={e.id} title={e.name}>
          <ul className="space-y-2">
            {e.sets.map((set) =>
              editing?.set?.id === set.id ? (
                <li key={set.id}>
                  <SetEntry
                    key={`edit-${set.id}`}
                    setNumber={set.setNumber}
                    initial={set}
                    submitLabel="Сохранить"
                    onCancel={() => setEditing(null)}
                    onSubmit={(v) =>
                      saveSet.mutate({ v, set, exerciseId: e.id, number: set.setNumber })
                    }
                  />
                </li>
              ) : (
                <SetRow
                  key={set.id}
                  set={set}
                  onEdit={editable ? () => setEditing({ set, exerciseId: e.id }) : undefined}
                  onDelete={editable ? () => setDeletingSet(set) : undefined}
                />
              ),
            )}
            {e.sets.length === 0 && (
              <li className="px-1 text-[14px] text-muted">Подходы не записаны</li>
            )}
          </ul>
          {editable &&
            (editing && !editing.set && editing.exerciseId === e.id ? (
              <SetEntry
                key={`add-${e.id}`}
                setNumber={e.sets.length + 1}
                suggestion={e.sets.at(-1)}
                submitLabel="Добавить"
                onCancel={() => setEditing(null)}
                onSubmit={(v) =>
                  saveSet.mutate({ v, set: null, exerciseId: e.id, number: e.sets.length + 1 })
                }
              />
            ) : (
              <Button
                size="sm"
                variant="soft"
                onClick={() => setEditing({ set: null, exerciseId: e.id })}
              >
                Добавить подход
              </Button>
            ))}
        </Section>
      ))}
      <p className="px-1 text-[13px] text-muted">
        Нажмите на подход, чтобы исправить вес или повторы. Статистика пересчитается сразу.
      </p>
      <Button block variant="danger" onClick={() => setDeleting(true)}>
        Удалить тренировку
      </Button>
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Удалить тренировку?"
        text="Все подходы будут удалены, статистика пересчитается. Это действие нельзя отменить."
        confirmLabel="Удалить"
        danger
        loading={removeSession.isPending}
        onConfirm={() => removeSession.mutate(undefined)}
      />
      <ConfirmSheet
        open={!!deletingSet}
        onClose={() => setDeletingSet(null)}
        title={`Удалить подход ${deletingSet?.setNumber ?? ''}?`}
        confirmLabel="Удалить"
        danger
        loading={removeSet.isPending}
        onConfirm={() => deletingSet && removeSet.mutate(deletingSet)}
      />
    </>
  );
}

function SummaryGrid({ s }: { s: SessionDto }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Общая длительность" value={formatDuration(s.summary.durationSeconds)} />
      <Stat label="Объём" value={formatVolume(s.summary.volumeKg)} />
      <Stat label="Упражнений" value={s.summary.exercisesCompleted} />
      <Stat
        label="Подходов"
        value={s.summary.totalSets}
        sub={s.summary.skippedSets ? `пропущено: ${s.summary.skippedSets}` : undefined}
      />
    </div>
  );
}
