import { afterEach, describe, expect, it } from 'vitest';
import { count, localeFromLanguageCode, setCurrentLocale, t, tn } from '@/i18n';
import { uk } from '@/i18n/uk';

afterEach(() => setCurrentLocale('en'));

describe('i18n', () => {
  it('uses English source strings as-is and interpolates variables', () => {
    expect(t('Set {n}', { n: 3 })).toBe('Set 3');
    expect(t('Save')).toBe('Save');
  });
  it('translates to Ukrainian', () => {
    setCurrentLocale('uk');
    expect(t('Set {n}', { n: 3 })).toBe('Підхід 3');
    expect(t('Save')).toBe('Зберегти');
  });
  it('inflects plurals per language', () => {
    expect([1, 2, 5].map((n) => count(n, 'set'))).toEqual(['1 set', '2 sets', '5 sets']);
    setCurrentLocale('uk');
    expect([1, 2, 5, 11, 21, 22].map((n) => count(n, 'set'))).toEqual([
      '1 підхід',
      '2 підходи',
      '5 підходів',
      '11 підходів',
      '21 підхід',
      '22 підходи',
    ]);
    expect(tn(3, 'exercise')).toBe('вправи');
  });
  it('keeps every placeholder in translations', () => {
    for (const [en, ua] of Object.entries(uk)) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(vars(ua), en).toBe(vars(en));
    }
  });
  it('picks Ukrainian only for Ukrainian Telegram clients', () => {
    expect(localeFromLanguageCode('uk')).toBe('uk');
    expect(localeFromLanguageCode('ru')).toBe('en');
    expect(localeFromLanguageCode(undefined)).toBe('en');
  });
});
