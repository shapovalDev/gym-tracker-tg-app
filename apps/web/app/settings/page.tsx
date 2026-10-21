'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PageHeader, Section } from '@/components/ui';
import { useOutbox, flush } from '@/lib/outbox';
import { tg } from '@/lib/telegram';

export default function SettingsPage() {
  const { queue, lastError } = useOutbox();
  const [env, setEnv] = useState<{ inTelegram: boolean; version?: string; platform?: string }>({
    inTelegram: false,
  });
  useEffect(() => {
    const app = tg();
    setEnv({ inTelegram: !!app, version: app?.version, platform: app?.platform });
  }, []);

  return (
    <>
      <PageHeader title="Ещё" />
      <Section title="Библиотека">
        <div className="divide-y divide-border overflow-hidden rounded-3xl bg-surface">
          <Row href="/exercises" label="Упражнения" />
          <Row href="/programs" label="Программы и архив" />
        </div>
      </Section>
      <Section title="Единицы">
        <div className="flex items-center justify-between rounded-3xl bg-surface px-4 py-4">
          <span>Вес</span>
          <span className="text-muted">килограммы</span>
        </div>
      </Section>
      <Section title="Синхронизация">
        <div className="space-y-2 rounded-3xl bg-surface px-4 py-4 text-sm">
          <p>
            {queue.length === 0
              ? 'Все данные сохранены на сервере.'
              : `${queue.length} изменений ожидают отправки${lastError === 'offline' ? ' (нет сети)' : ''}.`}
          </p>
          {queue.length > 0 && (
            <button type="button" className="font-medium text-link" onClick={() => flush()}>
              Отправить сейчас
            </button>
          )}
        </div>
      </Section>
      <Section title="Как считается статистика">
        <div className="space-y-2 rounded-3xl bg-surface px-4 py-4 text-sm text-muted">
          <p>
            Учитываются только подходы со статусом «выполнен» и хотя бы одним повтором из
            завершённых тренировок.
          </p>
          <p>Объём = Σ вес × повторы. e1RM — оценка по формуле Эпли, не реальный максимум.</p>
          <p>Длительность — общее время от старта до завершения тренировки.</p>
        </div>
      </Section>
      <p className="px-1 text-xs text-muted">
        {env.inTelegram
          ? `Telegram ${env.platform} · Bot API ${env.version}`
          : 'Открыто вне Telegram (режим разработки)'}
      </p>
    </>
  );
}

function Row({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex h-14 items-center justify-between px-4 font-medium">
      {label}
      <span className="text-muted" aria-hidden>
        ›
      </span>
    </Link>
  );
}
