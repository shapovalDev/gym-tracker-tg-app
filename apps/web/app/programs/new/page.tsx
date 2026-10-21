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

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export default function NewProgramPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workouts, setWorkouts] = useState<string[]>(['Тренировка A', 'Тренировка B']);

  const create = useApiMutation(
    () =>
      http.post<ProgramDto>('/programs', {
        name,
        description: description || null,
        workouts: workouts.map((w, i) => w.trim() || `Тренировка ${LETTERS[i]}`),
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
      <PageHeader title="Новая программа" />
      <div className="space-y-4">
        <Field
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Например, сплит на 4 дня"
          maxLength={100}
          required
        />
        <TextArea
          label="Описание"
          value={description}
          onChange={setDescription}
          placeholder="Необязательно"
        />
      </div>

      <Section
        title="Тренировки"
        hint="Идут по кругу в этом порядке. Упражнения добавите на следующем шаге."
      >
        <Card className="divide-y divide-line">
          {workouts.map((w, i) => (
            <div key={i} className="flex items-center gap-3 py-2 pr-1 pl-3">
              <PlateBadge index={i} size="sm" />
              <input
                aria-label={`Тренировка ${i + 1}`}
                value={w}
                maxLength={100}
                onChange={(e) =>
                  setWorkouts(workouts.map((x, j) => (j === i ? e.target.value : x)))
                }
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none"
              />
              <IconButton
                label={`Удалить тренировку ${i + 1}`}
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
              `Тренировка ${LETTERS[workouts.length] ?? workouts.length + 1}`,
            ])
          }
        >
          <PlusIcon /> Добавить тренировку
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
          Создать программу
        </Button>
      </BottomBar>
    </form>
  );
}
