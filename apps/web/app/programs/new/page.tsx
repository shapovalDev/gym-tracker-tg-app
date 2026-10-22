'use client';

import type { ProgramDto } from '@gym/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@/components/icons';
import {
  BottomBar,
  Button,
  Card,
  Field,
  IconButton,
  PageHeader,
  PlateBadge,
  Section,
  TextArea,
} from '@/components/ui';
import { http } from '@/lib/api';
import { useApiMutation } from '@/lib/mutations';
import { t } from '@/i18n';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function NewProgramPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workouts, setWorkouts] = useState<string[]>(() => [
    t('Workout {n}', { n: 'A' }),
    t('Workout {n}', { n: 'B' }),
  ]);

  const create = useApiMutation(
    () =>
      http.post<ProgramDto>('/programs', {
        name,
        description: description || null,
        workouts: workouts.map((w, i) => w.trim() || t('Workout {n}', { n: LETTERS[i] ?? i + 1 })),
      }),
    { invalidate: [['programs'], ['home']], onSuccess: (p) => router.replace(`/programs/${p.id}`) },
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) create.mutate(undefined);
      }}
    >
      <PageHeader title={t('New program')} />
      <div className="space-y-4">
        <Field
          label={t('Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('E.g. 4-day split')}
          maxLength={100}
          required
        />
        <TextArea
          label={t('Description')}
          value={description}
          onChange={setDescription}
          placeholder={t('Optional')}
        />
      </div>

      <Section
        title={t('Workouts')}
        hint={t('They repeat in this order. You will add exercises in the next step.')}
      >
        <Card className="divide-y divide-line">
          {workouts.map((w, i) => (
            <div key={i} className="flex items-center gap-3 py-2 pr-1 pl-3">
              <PlateBadge index={i} size="sm" />
              <input
                aria-label={t('Workout {n}', { n: i + 1 })}
                value={w}
                maxLength={100}
                onChange={(e) =>
                  setWorkouts(workouts.map((x, j) => (j === i ? e.target.value : x)))
                }
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
              />
              <IconButton
                label={t('Delete workout {n}', { n: i + 1 })}
                tone="danger"
                disabled={workouts.length === 1}
                onClick={() => setWorkouts(workouts.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </IconButton>
            </div>
          ))}
        </Card>
        <Button
          variant="soft"
          block
          onClick={() =>
            setWorkouts([
              ...workouts,
              t('Workout {n}', { n: LETTERS[workouts.length] ?? workouts.length + 1 }),
            ])
          }
        >
          <PlusIcon /> {t('Add workout')}
        </Button>
      </Section>

      <BottomBar>
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          loading={create.isPending}
          disabled={!name.trim()}
        >
          {t('Create program')}
        </Button>
      </BottomBar>
    </form>
  );
}
