'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight } from '@/components/icons';
import { Button, Card, PageHeader, Section, Segmented } from '@/components/ui';
import { count, LOCALE_NAMES, LOCALES, t, type Locale } from '@/i18n';
import { useLocale } from '@/i18n/provider';
import { flush, useOutbox } from '@/lib/outbox';
import { tg } from '@/lib/telegram';
import { setThemePref, useThemePref, type ThemePref } from '@/lib/theme';

export default function SettingsPage() {
  const { locale, setLocale } = useLocale();
  const theme = useThemePref();
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
      <PageHeader title={t('More')} />
      <Card className="divide-y divide-line overflow-hidden">
        <Row href="/exercises" label={t('Exercises')} hint={t('Library, technique, archive')} />
        <Row href="/programs" label={t('Programs')} hint={t('Workouts and the cycle')} />
      </Card>

      <Section title={t('Language')}>
        <Segmented<Locale>
          label={t('Language')}
          value={locale}
          onChange={setLocale}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))}
        />
      </Section>

      <Section title={t('Theme')}>
        <Segmented<ThemePref>
          label={t('Theme')}
          value={theme}
          onChange={setThemePref}
          options={[
            { value: 'system', label: env.inTelegram ? t('As in Telegram') : t('System') },
            { value: 'light', label: t('Light') },
            { value: 'dark', label: t('Dark') },
          ]}
        />
      </Section>

      <Section title={t('Saving')}>
        <Card className="space-y-3 p-4">
          <p className="text-[15px]">
            {queue.length === 0
              ? t('All data is saved on the server.')
              : t('{changes} waiting to be sent', { changes: count(queue.length, 'change') }) +
                (lastError === 'offline' ? `: ${t('offline')}.` : '.')}
          </p>
          {queue.length > 0 && (
            <Button size="sm" variant="soft" onClick={() => flush()}>
              {t('Send now')}
            </Button>
          )}
        </Card>
      </Section>

      <Section title={t('How statistics are calculated')}>
        <Card className="space-y-2 p-4 text-[15px]">
          <p>
            {t(
              'Only completed working sets with at least one rep from finished workouts are counted. Warm-up sets are not.',
            )}
          </p>
          <p>{t('Volume is the sum of weight × reps.')}</p>
          <p>
            {t(
              'Duration is the time from start to finish of the workout. Weights are in kilograms.',
            )}
          </p>
        </Card>
      </Section>

      <p className="px-1 text-[13px] text-muted">
        {env.inTelegram
          ? `Telegram ${env.platform}, Bot API ${env.version}`
          : t('Opened outside Telegram (development mode)')}
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
