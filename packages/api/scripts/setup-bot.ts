/**
 * One-time Telegram bot configuration:
 *   pnpm bot:setup
 * - sets the webhook to <PUBLIC_APP_URL>/api/v1/telegram/webhook (with secret)
 * - sets the chat menu button that opens the Mini App
 * - registers the /start command
 * Requires PUBLIC_APP_URL to be a public HTTPS URL.
 */
import { callBotApi } from '../src/telegram/bot';

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.env.PUBLIC_APP_URL;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !url || !secret) {
  console.error('TELEGRAM_BOT_TOKEN, PUBLIC_APP_URL and TELEGRAM_WEBHOOK_SECRET are required');
  process.exit(1);
}
if (!url.startsWith('https://')) {
  console.error('PUBLIC_APP_URL must be HTTPS — Telegram only opens Mini Apps over HTTPS');
  process.exit(1);
}

const webhook = `${url.replace(/\/$/, '')}/api/v1/telegram/webhook`;
await callBotApi(token, 'setWebhook', {
  url: webhook,
  secret_token: secret,
  allowed_updates: ['message'],
});
// The menu button has one label for everyone; commands are localised.
await callBotApi(token, 'setChatMenuButton', {
  menu_button: { type: 'web_app', text: 'Workout', web_app: { url } },
});
await callBotApi(token, 'setMyCommands', {
  commands: [{ command: 'start', description: 'Open the tracker' }],
});
await callBotApi(token, 'setMyCommands', {
  commands: [{ command: 'start', description: 'Відкрити трекер' }],
  language_code: 'uk',
});
console.info(`Bot configured.\n  webhook: ${webhook}\n  menu button -> ${url}`);
