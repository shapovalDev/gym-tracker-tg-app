/**
 * Thin typed wrapper over the official Telegram WebApp SDK
 * (https://telegram.org/js/telegram-web-app.js, loaded in app/layout.tsx).
 * Every call is optional so the app also runs in a normal browser for development.
 */
interface TgButton {
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}
interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  isVersionAtLeast?: (v: string) => boolean;
  onEvent?: (event: string, cb: () => void) => void;
  BackButton?: TgButton;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function tg(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  const app = window.Telegram?.WebApp;
  // The script defines WebApp even outside Telegram; initData is empty there.
  return app && app.initData ? app : undefined;
}

export function initTelegram() {
  const app = tg();
  if (!app) return;
  app.ready();
  app.expand();
  // Scrolling a long set list must not collapse the Mini App mid-workout.
  app.disableVerticalSwipes?.();
}

export function firstName(): string | undefined {
  return tg()?.initDataUnsafe?.user?.first_name;
}

const can = (v: string) => tg()?.isVersionAtLeast?.(v) ?? false;

export const haptic = {
  tap: () => can('6.1') && tg()?.HapticFeedback?.impactOccurred('light'),
  success: () => can('6.1') && tg()?.HapticFeedback?.notificationOccurred('success'),
  error: () => can('6.1') && tg()?.HapticFeedback?.notificationOccurred('error'),
  select: () => can('6.1') && tg()?.HapticFeedback?.selectionChanged(),
};

export function setClosingConfirmation(enabled: boolean) {
  if (!can('6.2')) return;
  if (enabled) tg()?.enableClosingConfirmation?.();
  else tg()?.disableClosingConfirmation?.();
}

export function backButton(): TgButton | undefined {
  return can('6.1') ? tg()?.BackButton : undefined;
}

let cached: Promise<string> | null = null;

/**
 * initData sent to the API as `Authorization: tma <initData>`.
 * Outside Telegram in development, a dev-only endpoint returns initData signed
 * with the real bot token — the server-side verification is identical.
 */
export function getInitData(): Promise<string> {
  if (cached) return cached;
  const real = tg()?.initData;
  if (real) {
    cached = Promise.resolve(real);
    return cached;
  }
  if (process.env.NODE_ENV !== 'production') {
    cached = fetch('/api/v1/dev/init-data')
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ initData: string }>)
          : Promise.reject(new Error('dev auth disabled')),
      )
      .then((j) => j.initData)
      .catch((e) => {
        cached = null;
        throw e;
      });
    return cached;
  }
  return Promise.reject(new Error('NOT_IN_TELEGRAM'));
}
