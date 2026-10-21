import { createApp, type App } from './app';

export { createApp } from './app';
export { signInitData, verifyInitData } from './auth/telegram';
export { parseEnv } from './env';

let app: App | undefined;
/** Lazily created singleton (env is read on the first request, not at build time). */
export function getApp(): App {
  app ??= createApp();
  return app;
}
