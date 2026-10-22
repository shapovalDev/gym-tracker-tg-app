import { beforeAll, describe, expect, it } from 'vitest';
import { signInitData, verifyInitData } from '../src/auth/telegram';
import { parseEnv } from '../src/env';
import { app, BOT_TOKEN, resetDb } from './helpers';

beforeAll(resetDb);

const call = (authorization?: string) =>
  app.request('/api/v1/me', { headers: authorization ? { authorization } : {} });

describe('Telegram initData verification', () => {
  it('accepts correctly signed data', () => {
    const raw = signInitData(BOT_TOKEN, { id: 42 });
    const r = verifyInitData(raw, BOT_TOKEN, { maxAgeSeconds: 60 });
    expect(r.ok && r.user.id).toBe(42);
  });
  it('rejects data signed with another token', () => {
    const raw = signInitData('999:other', { id: 42 });
    expect(verifyInitData(raw, BOT_TOKEN, { maxAgeSeconds: 60 })).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });
  it('rejects tampered user id', () => {
    const raw = signInitData(BOT_TOKEN, { id: 42 }).replace('%22id%22%3A42', '%22id%22%3A43');
    expect(verifyInitData(raw, BOT_TOKEN, { maxAgeSeconds: 60 }).ok).toBe(false);
  });
  it('rejects expired data', () => {
    const raw = signInitData(BOT_TOKEN, { id: 42 }, { authDate: new Date(Date.now() - 3600_000) });
    expect(verifyInitData(raw, BOT_TOKEN, { maxAgeSeconds: 60 })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });
  it('rejects duplicate keys and missing hash', () => {
    const raw = signInitData(BOT_TOKEN, { id: 42 });
    expect(verifyInitData(`${raw}&user=x`, BOT_TOKEN, { maxAgeSeconds: 60 }).ok).toBe(false);
    expect(verifyInitData('auth_date=1&user=%7B%7D', BOT_TOKEN, { maxAgeSeconds: 60 }).ok).toBe(
      false,
    );
  });
  it('accepts hashes computed without the signature field', () => {
    const raw = signInitData(BOT_TOKEN, { id: 7 });
    const withSig = `${raw}&signature=abc`;
    expect(verifyInitData(withSig, BOT_TOKEN, { maxAgeSeconds: 60 }).ok).toBe(true);
  });
});

describe('protected endpoints', () => {
  it('return 401 without credentials', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error.code).toBe('UNAUTHORIZED');
  });
  it('return 401 for forged initData', async () => {
    expect((await call(`tma ${signInitData('1:forged', { id: 1 })}`)).status).toBe(401);
    expect((await call('Bearer something')).status).toBe(401);
  });
  it('create the user on first valid request and reuse it afterwards', async () => {
    const auth = `tma ${signInitData(BOT_TOKEN, { id: 555 })}`;
    const a = (await (await call(auth)).json()) as any;
    const b = (await (await call(auth)).json()) as any;
    expect(a.telegramId).toBe('555');
    expect(a.id).toBe(b.id);
  });
  it('survive concurrent first requests of a new user', async () => {
    const auth = `tma ${signInitData(BOT_TOKEN, { id: 9090 })}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => call(auth)));
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(200));
    const ids = new Set(await Promise.all(results.map(async (r) => ((await r.json()) as any).id)));
    expect(ids.size).toBe(1);
  });
  it('store the UI language and reject unknown ones', async () => {
    const auth = `tma ${signInitData(BOT_TOKEN, { id: 557 })}`;
    const patch = (locale: unknown) =>
      app.request('/api/v1/me', {
        method: 'PATCH',
        headers: { authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
    expect(((await (await call(auth)).json()) as any).locale).toBeNull();
    expect(((await (await patch('uk')).json()) as any).locale).toBe('uk');
    expect(((await (await call(auth)).json()) as any).locale).toBe('uk');
    expect((await patch('ru')).status).toBe(400);
  });
  it('ignore a telegram id passed as a query parameter', async () => {
    const auth = `tma ${signInitData(BOT_TOKEN, { id: 556 })}`;
    const res = await app.request('/api/v1/me?telegramId=555', {
      headers: { authorization: auth },
    });
    expect(((await res.json()) as any).telegramId).toBe('556');
  });
  it('keep health and openapi public', async () => {
    expect((await app.request('/api/v1/health')).status).toBe(200);
    const doc = (await (await app.request('/api/v1/openapi.json')).json()) as any;
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.paths).length).toBeGreaterThan(30);
  });
  it('do not expose the dev init-data endpoint when disabled', async () => {
    expect((await app.request('/api/v1/dev/init-data')).status).toBe(401);
  });
});

describe('environment safety', () => {
  it('refuses dev auth in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'x',
        TELEGRAM_BOT_TOKEN: BOT_TOKEN,
        ALLOW_DEV_AUTH: 'true',
      }),
    ).toThrow(/forbidden/);
  });
});

describe('telegram webhook', () => {
  it('rejects requests without the secret', async () => {
    const res = await app.request('/api/v1/telegram/webhook', { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });
  it('accepts updates with the secret', async () => {
    const res = await app.request('/api/v1/telegram/webhook', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'hook-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(res.status).toBe(200);
  });
});
