'use client';

import type { ProgramDto } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { moveItem, ReorderButtons } from '@/components/reorder';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  PageLoader,
  Section,
  Sheet,
  TextArea,
} from '@/components/ui';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { errorMessage, http } from '@/lib/api';
import { plural } from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { queryKeys, useProgram } from '@/lib/queries';

export default function ProgramPage() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: program, isLoading, error, refetch } = useProgram(programId);
  const { start, pending: starting } = useStartWorkout();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const setProgram = (p: ProgramDto) => qc.setQueryData(queryKeys.program(p.id), p);
  const common = { invalidate: [['programs'], ['home']], onSuccess: setProgram };
  const reorder = useApiMutation(
    (ids: string[]) => http.put<ProgramDto>(`/programs/${programId}/workouts/order`, { ids }),
    common,
  );
  const activate = useApiMutation(() => http.post<ProgramDto>(`/programs/${programId}/activate`), {
    ...common,
    success: 'Программа активна',
  });
  const archive = useApiMutation(
    () =>
      http.post<ProgramDto>(
        `/programs/${programId}/${program?.archivedAt ? 'unarchive' : 'archive'}`,
      ),
    {
      ...common,
      onSuccess: (p) => {
        setProgram(p);
        setArchiveOpen(false);
      },
    },
  );
  const duplicate = useApiMutation(
    () => http.post<ProgramDto>(`/programs/${programId}/duplicate`),
    {
      invalidate: [['programs']],
      success: 'Копия создана',
      onSuccess: (p) => router.push(`/programs/${p.id}`),
    },
  );

  if (isLoading) return <PageLoader />;
  if (error || !program)
    return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />;

  const workouts = program.workouts;
  return (
    <>
      <PageHeader
        title={program.name}
        subtitle={
          program.archivedAt ? 'В архиве' : program.isActive ? 'Активная программа' : 'Программа'
        }
        right={
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Изменить
          </Button>
        }
      />
      {program.description && <p className="px-1 text-[15px] text-muted">{program.description}</p>}

      {!program.isActive && !program.archivedAt && (
        <Button block onClick={() => activate.mutate(undefined)} loading={activate.isPending}>
          Сделать активной
        </Button>
      )}

      <Section
        title={`Цикл · ${workouts.length} ${plural(workouts.length, 'тренировка', 'тренировки', 'тренировок')}`}
      >
        {workouts.length === 0 ? (
          <EmptyState
            icon="🗓️"
            title="Нет тренировок"
            text="Добавьте тренировки — они будут идти по кругу в заданном порядке."
          />
        ) : (
          <ul className="space-y-2">
            {workouts.map((w, i) => (
              <li
                key={w.id}
                className="flex items-center gap-1 rounded-3xl bg-surface py-2 pr-2 pl-4"
              >
                <Link
                  href={`/programs/${programId}/workouts/${w.id}`}
                  className="min-w-0 flex-1 py-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold num">
                      {i + 1}
                    </span>
                    <span className="truncate font-semibold">{w.name}</span>
                    {program.nextWorkoutId === w.id && program.isActive && (
                      <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                        Следующая
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate pl-9 text-sm text-muted">
                    {w.exercises.length
                      ? w.exercises.map((e) => e.exercise.name).join(' · ')
                      : 'Нет упражнений'}
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Начать «${w.name}»`}
                  disabled={starting || w.exercises.length === 0}
                  onClick={() => start(w.id)}
                >
                  ▶
                </Button>
                <ReorderButtons
                  index={i}
                  count={workouts.length}
                  label={w.name}
                  onMove={(from, to) =>
                    reorder.mutate(moveItem(workouts, from, to).map((x) => x.id))
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <Button block variant="secondary" onClick={() => setAdding(true)}>
          + Добавить тренировку
        </Button>
      </Section>

      <Section title="Действия">
        <div className="divide-y divide-border overflow-hidden rounded-3xl bg-surface">
          <button
            type="button"
            className="block h-14 w-full px-4 text-left font-medium"
            onClick={() => duplicate.mutate(undefined)}
          >
            Дублировать программу
          </button>
          <button
            type="button"
            className="block h-14 w-full px-4 text-left font-medium text-danger"
            onClick={() => setArchiveOpen(true)}
          >
            {program.archivedAt ? 'Восстановить из архива' : 'Архивировать'}
          </button>
        </div>
      </Section>

      <EditProgramSheet
        open={editing}
        onClose={() => setEditing(false)}
        program={program}
        onSaved={setProgram}
      />
      <AddWorkoutSheet
        open={adding}
        onClose={() => setAdding(false)}
        programId={programId}
        onSaved={setProgram}
        defaultName={`Тренировка ${workouts.length + 1}`}
      />
      <ConfirmSheet
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={program.archivedAt ? 'Восстановить программу?' : 'Архивировать программу?'}
        text={
          program.archivedAt
            ? undefined
            : 'История тренировок сохранится. Программу можно будет восстановить.'
        }
        confirmLabel={program.archivedAt ? 'Восстановить' : 'Архивировать'}
        danger={!program.archivedAt}
        loading={archive.isPending}
        onConfirm={() => archive.mutate(undefined)}
      />
    </>
  );
}

function EditProgramSheet({
  open,
  onClose,
  program,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  program: ProgramDto;
  onSaved: (p: ProgramDto) => void;
}) {
  const [name, setName] = useState(program.name);
  const [description, setDescription] = useState(program.description ?? '');
  const save = useApiMutation(
    () =>
      http.patch<ProgramDto>(`/programs/${program.id}`, { name, description: description || null }),
    {
      invalidate: [['programs'], ['home']],
      onSuccess: (p) => {
        onSaved(p);
        onClose();
      },
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title="Программа">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate(undefined);
        }}
      >
        <Field
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <TextArea label="Описание" value={description} onChange={setDescription} />
        <Button type="submit" block size="lg" loading={save.isPending} disabled={!name.trim()}>
          Сохранить
        </Button>
      </form>
    </Sheet>
  );
}

function AddWorkoutSheet({
  open,
  onClose,
  programId,
  onSaved,
  defaultName,
}: {
  open: boolean;
  onClose: () => void;
  programId: string;
  onSaved: (p: ProgramDto) => void;
  defaultName: string;
}) {
  const [name, setName] = useState('');
  const save = useApiMutation(
    () =>
      http.post<ProgramDto>(`/programs/${programId}/workouts`, {
        name: name.trim() || defaultName,
      }),
    {
      invalidate: [['programs'], ['home']],
      onSuccess: (p) => {
        onSaved(p);
        setName('');
        onClose();
      },
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title="Новая тренировка">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field
          label="Название"
          value={name}
          placeholder={defaultName}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />
        <Button type="submit" block size="lg" loading={save.isPending}>
          Добавить
        </Button>
      </form>
    </Sheet>
  );
}
