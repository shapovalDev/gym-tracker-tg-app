'use client';

import { orderBySchedule, WEEKDAYS, type ProgramDto } from '@gym/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckIcon, PlusIcon, TrashIcon } from '@/components/icons';
import {
  BottomBar,
  Button,
  Card,
  Field,
  IconButton,
  PageHeader,
  PlateBadge,
  Section,
  Sheet,
  TextArea,
  cx,
} from '@/components/ui';
import { http } from '@/lib/api';
import { weekdayLong, weekdayShort } from '@/lib/format';
import { useApiMutation } from '@/lib/mutations';
import { t } from '@/i18n';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface Draft {
  /** Local key only: keeps inputs stable while the list re-sorts. */
  key: string;
  name: string;
  weekday: number | null;
}

const draft = (): Draft => ({ key: crypto.randomUUID(), name: '', weekday: null });

export default function NewProgramPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workouts, setWorkouts] = useState<Draft[]>(() => [draft(), draft()]);
  const [pickingDay, setPickingDay] = useState<number | null>(null);

  // The cycle follows the calendar: scheduled workouts by day, then the rest.
  const ordered = orderBySchedule(workouts);
  const defaultName = (i: number) => t('Workout {n}', { n: LETTERS[i] ?? i + 1 });
  const indexOf = (w: Draft) => ordered.indexOf(w);
  const onDay = (day: number) => workouts.find((w) => w.weekday === day);

  const update = (key: string, patch: Partial<Draft>) =>
    setWorkouts((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  /** One workout per day: putting a workout on a day frees the day it had. */
  const assign = (day: number, key: string | null) =>
    setWorkouts((ws) =>
      ws.map((w) =>
        w.key === key ? { ...w, weekday: day } : w.weekday === day ? { ...w, weekday: null } : w,
      ),
    );

  const create = useApiMutation(
    () =>
      http.post<ProgramDto>('/programs', {
        name,
        description: description || null,
        workouts: ordered.map((w, i) => ({
          name: w.name.trim() || defaultName(i),
          weekday: w.weekday,
        })),
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
        title={t('Schedule')}
        hint={t('Optional. Pick the days: the workouts will follow the order of the week.')}
      >
        <ol className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((day) => {
            const w = onDay(day);
            const i = w ? indexOf(w) : -1;
            return (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => setPickingDay(day)}
                  aria-label={`${weekdayLong(day)}: ${w ? w.name.trim() || defaultName(i) : t('No workout')}`}
                  className={cx(
                    'press flex h-[72px] w-full flex-col items-center justify-between rounded-xl py-2',
                    w ? 'bg-card ring-2 ring-ink' : 'border border-dashed border-line',
                  )}
                >
                  <span className={cx('text-[11px] font-semibold', w ? 'text-ink' : 'text-muted')}>
                    {weekdayShort(day)}
                  </span>
                  {w ? (
                    <PlateBadge index={i} size="sm" />
                  ) : (
                    <span className="grid size-[30px] place-items-center text-muted">
                      <PlusIcon />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section
        title={t('Workouts')}
        hint={t('They repeat in this order. You will add exercises in the next step.')}
      >
        <Card className="divide-y divide-line">
          {ordered.map((w, i) => (
            <div key={w.key} className="flex items-center gap-3 py-2 pr-1 pl-3">
              <PlateBadge index={i} size="sm" />
              <input
                aria-label={t('Workout {n}', { n: i + 1 })}
                value={w.name}
                placeholder={defaultName(i)}
                maxLength={100}
                onChange={(e) => update(w.key, { name: e.target.value })}
                className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
              />
              {w.weekday != null && (
                <span
                  className="shrink-0 rounded-md border border-line px-1.5 py-px text-[12px] font-bold"
                  title={weekdayLong(w.weekday)}
                >
                  {weekdayShort(w.weekday)}
                </span>
              )}
              <IconButton
                label={t('Delete workout {n}', { n: i + 1 })}
                tone="danger"
                disabled={workouts.length === 1}
                onClick={() => setWorkouts(workouts.filter((x) => x.key !== w.key))}
              >
                <TrashIcon />
              </IconButton>
            </div>
          ))}
        </Card>
        <Button variant="soft" block onClick={() => setWorkouts([...workouts, draft()])}>
          <PlusIcon /> {t('Add workout')}
        </Button>
      </Section>

      <Sheet
        open={pickingDay !== null}
        onClose={() => setPickingDay(null)}
        title={
          pickingDay !== null ? t('{day}: which workout?', { day: weekdayLong(pickingDay) }) : ''
        }
      >
        {pickingDay !== null && (
          <Card className="divide-y divide-line overflow-hidden">
            {ordered.map((w, i) => {
              const here = w.weekday === pickingDay;
              return (
                <button
                  key={w.key}
                  type="button"
                  aria-pressed={here}
                  onClick={() => {
                    assign(pickingDay, w.key);
                    setPickingDay(null);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <PlateBadge index={i} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">
                      {w.name.trim() || defaultName(i)}
                    </span>
                    {w.weekday != null && !here && (
                      <span className="block text-[13px] text-muted">
                        {t('Now on {day}', { day: weekdayLong(w.weekday) })}
                      </span>
                    )}
                  </span>
                  {here && <CheckIcon />}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={!onDay(pickingDay)}
              onClick={() => {
                assign(pickingDay, null);
                setPickingDay(null);
              }}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
            >
              <span className="grid size-[30px] place-items-center rounded-lg border border-dashed border-line text-muted">
                –
              </span>
              <span className="flex-1 text-[16px] font-semibold">{t('No workout')}</span>
              {!onDay(pickingDay) && <CheckIcon />}
            </button>
          </Card>
        )}
      </Sheet>

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
