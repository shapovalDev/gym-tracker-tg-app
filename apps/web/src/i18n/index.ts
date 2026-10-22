import { uk } from './uk';

/**
 * Minimal typed i18n. Source strings are English and double as keys; `uk`
 * holds the Ukrainian translation of every key (the compiler checks that each
 * `t('…')` exists there). The active locale is module state: the provider sets
 * it and remounts the tree on change, so plain `t()` calls work everywhere —
 * components, formatters and hooks alike.
 */
export const LOCALES = ['en', 'uk'] as const;
export type Locale = (typeof LOCALES)[number];
export type MsgKey = keyof typeof uk;

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', uk: 'Українська' };

let current: Locale = 'en';
export const getLocale = () => current;
export const setCurrentLocale = (l: Locale) => {
  current = l;
};
export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** BCP 47 tag for Intl formatters. */
export const intlLocale = () => (current === 'uk' ? 'uk-UA' : 'en-GB');

export function t(key: MsgKey, vars?: Record<string, string | number>): string {
  const template: string = current === 'uk' ? uk[key] : key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

type Forms = {
  en: [one: string, other: string];
  uk: [one: string, few: string, many: string, other: string];
};
const PLURALS = {
  set: { en: ['set', 'sets'], uk: ['підхід', 'підходи', 'підходів', 'підходу'] },
  workout: {
    en: ['workout', 'workouts'],
    uk: ['тренування', 'тренування', 'тренувань', 'тренування'],
  },
  exercise: { en: ['exercise', 'exercises'], uk: ['вправа', 'вправи', 'вправ', 'вправи'] },
  change: { en: ['change', 'changes'], uk: ['зміна', 'зміни', 'змін', 'зміни'] },
} satisfies Record<string, Forms>;
export type PluralKey = keyof typeof PLURALS;

const rules = new Map<Locale, Intl.PluralRules>();
/** The correctly inflected word for `n` (without the number). */
export function tn(n: number, key: PluralKey): string {
  const forms = PLURALS[key] as Forms;
  const rule = rules.get(current) ?? new Intl.PluralRules(intlLocale());
  rules.set(current, rule);
  const cat = rule.select(n);
  if (current === 'en') return cat === 'one' ? forms.en[0] : forms.en[1];
  const [one, few, many, other] = forms.uk;
  return cat === 'one' ? one : cat === 'few' ? few : cat === 'many' ? many : other;
}

/** `5 sets` / `5 підходів`. */
export const count = (n: number, key: PluralKey) => `${n} ${tn(n, key)}`;

const STORAGE_KEY = 'gym.locale';
export function storedLocale(): Locale | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : null;
  } catch {
    return null;
  }
}
export function storeLocale(l: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* private mode: the server copy still applies */
  }
}

/** Ukrainian for Ukrainian Telegram clients, English otherwise. */
export function localeFromLanguageCode(code: string | undefined | null): Locale {
  return code?.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}
