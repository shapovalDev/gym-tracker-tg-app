'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { initOutbox } from '@/lib/outbox';
import { initTelegram, tg } from '@/lib/telegram';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 2,
          },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(() => {
    initTelegram();
    const app = tg();
    if (app) {
      const sync = () => (document.documentElement.dataset.tg = app.colorScheme);
      sync();
      app.onEvent?.('themeChanged', sync);
    }
    initOutbox(client);
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
