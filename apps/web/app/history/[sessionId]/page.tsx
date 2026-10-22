'use client';

import { setLabels, setsOfType, type SessionDto, type SetDto } from '@gym/shared';
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
import { t } from '@/i18n';

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
        setType: v.setType,
        note: v.note,
        reps: v.reps,
        status: v.status,
      }),
    {
      invalidate: STATS,
      success: t('Saved'),
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
    success: t('Workout deleted'),
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
        title={s.workoutName ?? t('Free workout')}
        subtitle={`${formatDate(s.startedAt)}, ${formatTime(s.startedAt)}${s.programName ? `, ${s.programName}` : ''}`}
      />
      {s.status === 'cancelled' && (
        <p className="rounded-2xl bg-skip-soft px-4 py-3 text-[15px]">
          {t('This workout was cancelled and is not counted in statistics.')}
        </p>
      )}
      <SummaryGrid s={s} />
      {s.exercises.map((e) => {
        const labels = setLabels(e.sets, t('W'));
        return (
          <Section key={e.id} title={e.name}>
            <ul className="space-y-2">
              {e.sets.map((set) =>
                editing?.set?.id === set.id ? (
                  <li key={set.id}>
                    <SetEntry
                      key={`edit-${set.id}`}
                      title={t('Edit: {name}', {
                        name:
                          set.setType === 'warmup'
                            ? t('Warm-up {n}', { n: (labels.get(set) ?? '').replace(/^\D+/, '') })
                            : t('Set {n}', { n: labels.get(set) ?? '' }),
                      })}
                      initial={set}
                      submitLabel={t('Save')}
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
                    label={labels.get(set) ?? ''}
                    onEdit={editable ? () => setEditing({ set, exerciseId: e.id }) : undefined}
                    onDelete={editable ? () => setDeletingSet(set) : undefined}
                  />
                ),
              )}
              {e.sets.length === 0 && (
                <li className="px-1 text-[14px] text-muted">{t('No sets recorded')}</li>
              )}
            </ul>
            {editable &&
              (editing && !editing.set && editing.exerciseId === e.id ? (
                <SetEntry
                  key={`add-${e.id}`}
                  counts={{
                    working: setsOfType(e.sets, 'working').length,
                    warmup: setsOfType(e.sets, 'warmup').length,
                  }}
                  suggestion={e.sets.at(-1)}
                  submitLabel={t('Add')}
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
                  {t('Add set')}
                </Button>
              ))}
          </Section>
        );
      })}
      <p className="px-1 text-[13px] text-muted">
        {t('Tap a set to fix the weight or reps. Statistics update immediately.')}
      </p>
      <Button block variant="danger" onClick={() => setDeleting(true)}>
        {t('Delete workout')}
      </Button>
      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title={t('Delete the workout?')}
        text={t('All sets will be deleted and statistics recalculated. This cannot be undone.')}
        confirmLabel={t('Delete')}
        danger
        loading={removeSession.isPending}
        onConfirm={() => removeSession.mutate(undefined)}
      />
      <ConfirmSheet
        open={!!deletingSet}
        onClose={() => setDeletingSet(null)}
        title={t('Delete this set?')}
        confirmLabel={t('Delete')}
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
      <Stat label={t('Total duration')} value={formatDuration(s.summary.durationSeconds)} />
      <Stat label={t('Volume')} value={formatVolume(s.summary.volumeKg)} />
      <Stat label={t('Exercises')} value={s.summary.exercisesCompleted} />
      <Stat
        label={t('Sets')}
        value={s.summary.totalSets}
        sub={
          s.summary.skippedSets ? t('{n} more skipped', { n: s.summary.skippedSets }) : undefined
        }
      />
    </div>
  );
}
