import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Telegram Mini App initData verification.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 * hash       = hex(HMAC_SHA256(key = secret_key, data = data_check_string))
 * data_check_string = all received fields except `hash`, sorted by key, "k=v" joined by "\n".
 */

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type VerifyResult =
  | { ok: true; user: TelegramUser; authDate: Date }
  | { ok: false; reason: 'missing' | 'malformed' | 'bad_signature' | 'expired' | 'no_user' };

function secretKey(botToken: string): Buffer {
  return createHmac('sha256', 'WebAppData').update(botToken).digest();
}

function dataCheckString(entries: [string, string][], exclude: Set<string>): string {
  return entries
    .filter(([k]) => !exclude.has(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && timingSafeEqual(ab, bb);
}

export function verifyInitData(
  raw: string | null | undefined,
  botToken: string,
  options: { maxAgeSeconds: number; now?: Date },
): VerifyResult {
  if (!raw) return { ok: false, reason: 'missing' };
  if (raw.length > 8192) return { ok: false, reason: 'malformed' };
  const params = new URLSearchParams(raw);
  const entries = [...params.entries()];
  const keys = new Set(entries.map(([k]) => k));
  if (keys.size !== entries.length) return { ok: false, reason: 'malformed' };
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: 'malformed' };

  const key = secretKey(botToken);
  const valid =
    safeEqualHex(hmacHex(key, dataCheckString(entries, new Set(['hash']))), hash) ||
    // Some clients compute the hash without the newer Ed25519 `signature` field.
    (keys.has('signature') &&
      safeEqualHex(hmacHex(key, dataCheckString(entries, new Set(['hash', 'signature']))), hash));
  if (!valid) return { ok: false, reason: 'bad_signature' };

  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0)
    return { ok: false, reason: 'malformed' };
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (nowSeconds - authDateSeconds > options.maxAgeSeconds || authDateSeconds - nowSeconds > 300) {
    return { ok: false, reason: 'expired' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'no_user' };
  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0)
    return { ok: false, reason: 'no_user' };
  return { ok: true, user, authDate: new Date(authDateSeconds * 1000) };
}

/**
 * Produces initData signed exactly like Telegram does. Used by tests and by the
 * dev-only endpoint so that local development goes through the *same*
 * verification path as production.
 */
export function signInitData(
  botToken: string,
  user: TelegramUser,
  options: { authDate?: Date; extra?: Record<string, string> } = {},
): string {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor((options.authDate ?? new Date()).getTime() / 1000)),
    query_id: 'dev',
    user: JSON.stringify(user),
    ...options.extra,
  };
  const entries = Object.entries(fields);
  const hash = hmacHex(secretKey(botToken), dataCheckString(entries, new Set()));
  return new URLSearchParams({ ...fields, hash }).toString();
}
