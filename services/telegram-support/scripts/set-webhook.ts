/**
 * Register Telegram webhook.
 * Usage (from services/telegram-support):
 *   TELEGRAM_WEBHOOK_URL=https://xxxx.ngrok-free.app/telegram/webhook npm run set-webhook
 */
import path from 'path';
import dotenv from 'dotenv';

const serviceRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(serviceRoot, '../../.env') });
dotenv.config({ path: path.resolve(serviceRoot, '.env'), override: true });

async function main(): Promise<void> {
  const url = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }
  if (!url) throw new Error('TELEGRAM_WEBHOOK_URL is required');

  const { setWebhook, verifyBot } = await import('../src/services/telegramApi');
  await verifyBot();
  await setWebhook(url, secret || undefined);
  console.log('Webhook set:', url);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
