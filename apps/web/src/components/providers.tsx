'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { initOutbox } from '@/lib/outbox';
import { LocaleProvider } from '@/i18n/provider';
import { initTelegram, tg } from '@/lib/telegram';
import { applyTheme } from '@/lib/theme';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data changes only through this app; mutations invalidate what they touch.
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 2,
          },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(() => {
    initTelegram();
    // Follow Telegram's light/dark choice (unless overridden in settings) with our
    // own palette, and paint Telegram's header/background to match.
    applyTheme();
    tg()?.onEvent?.('themeChanged', () => applyTheme());
    initOutbox(client);
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>{children}</LocaleProvider>
    </QueryClientProvider>
  );
}
