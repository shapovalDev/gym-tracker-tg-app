'use client';

import type { ProgramDto } from '@gym/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronRight, DotsIcon, PlusIcon } from '@/components/icons';
import { moveItem, ReorderButtons } from '@/components/reorder';
import {
  ActionSheet,
  BottomBar,
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  PageHeader,
  PageLoader,
  PlateBadge,
  Section,
  Sheet,
  TextArea,
} from '@/components/ui';
import { errorMessage, http } from '@/lib/api';
import { weekdayLong, weekdayShort } from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { queryKeys, useProgram } from '@/lib/queries';
import { count, t } from '@/i18n';

export default function ProgramPage() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: program, isLoading, error, refetch } = useProgram(programId);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const setProgram = (p: ProgramDto) => qc.setQueryData(queryKeys.program(p.id), p);
  const common = { invalidate: [['programs'], ['home']], onSuccess: setProgram };
  const reorder = useApiMutation(
    (ids: string[]) => http.put<ProgramDto>(`/programs/${programId}/workouts/order`, { ids }),
    common,
  );
  const activate = useApiMutation(() => http.post<ProgramDto>(`/programs/${programId}/activate`), {
    ...common,
    success: t('Program is active'),
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
    () =>
      http.post<ProgramDto>(`/programs/${programId}/duplicate`, {
        name: t('{name} (copy)', { name: program?.name ?? '' }).slice(0, 100),
      }),
    {
      invalidate: [['programs']],
      success: t('Copy created'),
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
          program.archivedAt ? t('Archived') : program.isActive ? t('Active program') : t('Program')
        }
        right={
          <IconButton label={t('Program actions')} onClick={() => setMenu(true)}>
            <DotsIcon />
          </IconButton>
        }
      />
      {program.description && (
        <p className="-mt-3 px-1 text-[15px] text-muted">{program.description}</p>
      )}

      {!program.isActive && !program.archivedAt && (
        <Card className="flex items-center justify-between gap-3 p-4">
          <p className="text-[15px]">{t('Another program is shown on Home now.')}</p>
          <Button
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => activate.mutate(undefined)}
            loading={activate.isPending}
          >
            {t('Make active')}
          </Button>
        </Card>
      )}

      <Section
        title={t('Workouts in the cycle')}
        hint={t('After the last one comes the first again.')}
        action={
          workouts.length > 1 && (
            <Button
              size="sm"
              variant={ordering ? 'primary' : 'secondary'}
              onClick={() => setOrdering(!ordering)}
            >
              {ordering ? t('Done') : t('Order')}
            </Button>
          )
        }
      >
        {workouts.length === 0 ? (
          <EmptyState
            title={t('No workouts yet')}
            text={t('Add the first one, e.g. “Chest and triceps”.')}
          />
        ) : (
          <ul className="space-y-2.5">
            {workouts.map((w, i) => {
              const next = program.isActive && program.nextWorkoutId === w.id;
              const body = (
                <>
                  <PlateBadge index={i} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{w.name}</span>
                    {(next || w.weekday != null) && (
                      <span className="mt-1 flex items-center gap-1.5">
                        {w.weekday != null && (
                          <span
                            className="rounded-md border border-line px-1.5 py-px text-[12px] font-bold"
                            title={weekdayLong(w.weekday)}
                          >
                            {weekdayShort(w.weekday)}
                          </span>
                        )}
                        {next && (
                          <span className="rounded-md bg-accent px-1.5 py-px text-[11px] font-bold tracking-[0.08em] text-on-accent uppercase">
                            {t('next')}
                          </span>
                        )}
                      </span>
                    )}
                    <span className="mt-0.5 line-clamp-2 text-[13px] text-muted">
                      {w.exercises.length
                        ? w.exercises.map((e) => e.exercise.name).join(', ')
                        : t('No exercises, tap to add')}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={w.id}>
                  {ordering ? (
                    <div className="flex items-center gap-3 rounded-[18px] border border-line bg-card py-3 pr-1 pl-3">
                      {body}
                      <ReorderButtons
                        index={i}
                        count={workouts.length}
                        label={w.name}
                        onMove={(f, t) => reorder.mutate(moveItem(workouts, f, t).map((x) => x.id))}
                      />
                    </div>
                  ) : (
                    <Link
                      href={`/programs/${programId}/workouts/${w.id}`}
                      className={`press flex items-center gap-3 rounded-[18px] bg-card py-3 pr-3 pl-3 ${next ? 'border-2 border-ink' : 'border border-line'}`}
                    >
                      {body}
                      <span className="text-muted">
                        <ChevronRight />
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {workouts.length > 0 && (
          <p className="px-1 text-[13px] text-muted">
            {t('{workouts} in the cycle. Open a workout to change its exercises.', {
              workouts: count(workouts.length, 'workout'),
            })}
          </p>
        )}
      </Section>

      <BottomBar>
        <Button
          variant={workouts.length ? 'secondary' : 'primary'}
          size="lg"
          className="flex-1"
          onClick={() => setAdding(true)}
        >
          <PlusIcon /> {t('Add workout')}
        </Button>
      </BottomBar>

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={program.name}
        actions={[
          !program.isActive &&
            !program.archivedAt && {
              label: t('Make active'),
              hint: t('Will be shown on Home'),
              onClick: () => activate.mutate(undefined),
            },
          { label: t('Edit name and description'), onClick: () => setEditing(true) },
          {
            label: t('Duplicate program'),
            hint: t('A copy with all workouts and exercises'),
            onClick: () => duplicate.mutate(undefined),
          },
          program.archivedAt
            ? { label: t('Restore from archive'), onClick: () => archive.mutate(undefined) }
            : { label: t('Move to archive'), danger: true, onClick: () => setArchiveOpen(true) },
        ]}
      />
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
        defaultName={t('Workout {n}', { n: String.fromCharCode(65 + workouts.length) })}
        onSaved={(p) => {
          setProgram(p);
          router.push(`/programs/${programId}/workouts/${p.workouts.at(-1)!.id}`);
        }}
      />
      <ConfirmSheet
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title={t('Move the program to the archive?')}
        text={t('Workout history is kept. You can restore the program at any time.')}
        confirmLabel={t('Move to archive')}
        danger
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
    <Sheet open={open} onClose={onClose} title={t('Program')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate(undefined);
        }}
      >
        <Field
          label={t('Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />
        <TextArea label={t('Description')} value={description} onChange={setDescription} />
        <Button type="submit" block size="lg" loading={save.isPending} disabled={!name.trim()}>
          {t('Save')}
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
        setName('');
        onClose();
        onSaved(p);
      },
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('New workout')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field
          label={t('Name')}
          value={name}
          placeholder={defaultName}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
          hint={t('E.g. “Back and biceps”. The exercise list opens next.')}
        />
        <Button type="submit" block size="lg" loading={save.isPending}>
          {t('Add and go to exercises')}
        </Button>
      </form>
    </Sheet>
  );
}
