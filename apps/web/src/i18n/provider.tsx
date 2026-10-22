'use client';

import type { MeDto } from '@gym/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { http } from '@/lib/api';
import { tg } from '@/lib/telegram';
import {
  localeFromLanguageCode,
  setCurrentLocale,
  storedLocale,
  storeLocale,
  type Locale,
} from './index';

const LocaleContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({
  locale: 'en',
  setLocale: () => undefined,
});
export const useLocale = () => useContext(LocaleContext);

export const meKey = ['me'] as const;

/**
 * Picks the UI language (device choice → saved on the server → Telegram
 * language → English) and remounts the app when it changes, so module-level
 * `t()` calls re-render in the new language. Renders nothing until mounted:
 * the language is only known in the browser, which avoids hydration mismatches.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [locale, setLocaleState] = useState<Locale | null>(null);
  const { data: me } = useQuery({
    queryKey: meKey,
    queryFn: () => http.get<MeDto>('/me'),
    staleTime: Infinity,
  });

  const apply = useCallback((l: Locale) => {
    setCurrentLocale(l);
    document.documentElement.lang = l;
    setLocaleState(l);
  }, []);

  useEffect(() => {
    apply(storedLocale() ?? localeFromLanguageCode(tg()?.initDataUnsafe?.user?.language_code));
  }, [apply]);

  // The server copy wins once known (e.g. a fresh device), unless already equal.
  useEffect(() => {
    if (me?.locale && me.locale !== locale) {
      storeLocale(me.locale);
      apply(me.locale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      storeLocale(l);
      apply(l);
      qc.setQueryData<MeDto>(meKey, (old) => (old ? { ...old, locale: l } : old));
      void http.patch<MeDto>('/me', { locale: l }).catch(() => undefined);
    },
    [apply, qc],
  );

  if (!locale) return null;
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <div key={locale} className="contents">
        {children}
      </div>
    </LocaleContext.Provider>
  );
}
