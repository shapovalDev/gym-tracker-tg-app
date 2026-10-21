'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight } from '@/components/icons';
import { Button, Card, PageHeader, Section } from '@/components/ui';
import { flush, useOutbox } from '@/lib/outbox';
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
      <Card className="divide-y divide-line overflow-hidden">
        <Row href="/exercises" label="Упражнения" hint="Библиотека, техника, архив" />
        <Row href="/programs" label="Программы" hint="Тренировки и цикл" />
      </Card>

      <Section title="Сохранение">
        <Card className="space-y-3 p-4">
          <p className="text-[15px]">
            {queue.length === 0
              ? 'Все данные сохранены на сервере.'
              : `${queue.length} изменений ждут отправки${lastError === 'offline' ? ': нет сети' : ''}.`}
          </p>
          {queue.length > 0 && (
            <Button size="sm" variant="soft" onClick={() => flush()}>
              Отправить сейчас
            </Button>
          )}
        </Card>
      </Section>

      <Section title="Как считается статистика">
        <Card className="space-y-2 p-4 text-[15px]">
          <p>
            Учитываются только выполненные подходы, хотя бы с одним повтором, из завершённых
            тренировок.
          </p>
          <p>Объём — это сумма «вес × повторы».</p>
          <p>Длительность — время от старта до завершения тренировки. Вес — в килограммах.</p>
        </Card>
      </Section>

      <p className="px-1 text-[13px] text-muted">
        {env.inTelegram
          ? `Telegram ${env.platform}, Bot API ${env.version}`
          : 'Открыто вне Telegram (режим разработки)'}
      </p>
    </>
  );
}

function Row({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-[14px] text-muted">{hint}</span>
      </span>
      <span className="text-muted">
        <ChevronRight />
      </span>
    </Link>
  );
}
