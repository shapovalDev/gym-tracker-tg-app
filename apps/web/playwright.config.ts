import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs the real app (Next.js dev server + API) against a dedicated
 * database `<db>_e2e`. Authentication uses the dev-only signed initData
 * endpoint, i.e. the same server-side verification as production.
 */
const PORT = 3100;
const base = process.env.DATABASE_URL ?? 'postgresql://gym:gym@localhost:5544/gym';
const e2eUrl = new URL(base);
e2eUrl.pathname = `${e2eUrl.pathname}_e2e`;
process.env.E2E_DATABASE_URL = e2eUrl.toString();

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/v1/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: e2eUrl.toString(),
      DIRECT_URL: e2eUrl.toString(),
      ALLOW_DEV_AUTH: 'true',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '123456:e2e-test-token',
      DEV_TELEGRAM_USER_ID: '777000777',
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
});
