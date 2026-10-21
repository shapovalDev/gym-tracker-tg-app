import { timingSafeEqual } from 'node:crypto';
import type { Hono } from 'hono';
import type { AppEnv } from '../http/types';

/** Minimal Telegram Bot API client (fetch only, no SDK). */
export async function callBotApi<T = unknown>(
  token: string,
  method: string,
  payload: unknown,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  return json.result as T;
}

export function openAppKeyboard(url: string) {
  return { inline_keyboard: [[{ text: '🏋️ Открыть трекер', web_app: { url } }]] };
}

interface Update {
  message?: { chat: { id: number }; text?: string };
}

/**
 * Webhook: replies to /start with a button that opens the Mini App.
 * Serverless-friendly (no long polling process). Authenticated via the
 * secret_token Telegram echoes in X-Telegram-Bot-Api-Secret-Token.
 */
export function registerTelegramWebhook(app: Hono<AppEnv>, path: string) {
  app.post(path, async (c) => {
    const env = c.get('env');
    const expected = env.TELEGRAM_WEBHOOK_SECRET;
    const got = c.req.header('x-telegram-bot-api-secret-token') ?? '';
    if (
      !expected ||
      got.length !== expected.length ||
      !timingSafeEqual(Buffer.from(got), Buffer.from(expected))
    ) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Bad webhook secret' } }, 401);
    }
    const update = (await c.req.json().catch(() => ({}))) as Update;
    const msg = update.message;
    if (msg?.text?.startsWith('/start')) {
      try {
        await callBotApi(env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: 'Привет! Здесь ты ведёшь свои тренировки: программы, подходы и прогресс.',
          reply_markup: openAppKeyboard(env.PUBLIC_APP_URL),
        });
      } catch (err) {
        console.error(
          JSON.stringify({ level: 'error', msg: 'Bot reply failed', error: String(err) }),
        );
      }
    }
    // Always 200 so Telegram does not retry the same update forever.
    return c.json({ ok: true });
  });
}
