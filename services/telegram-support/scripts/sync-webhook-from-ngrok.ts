/**
 * Register Telegram webhook using the public URL from a local ngrok agent.
 * Usage (from services/telegram-support):
 *   ngrok http 3008   # terminal 1
 *   npm run sync-webhook-from-ngrok   # terminal 2
 */
import path from 'path';
import dotenv from 'dotenv';

const serviceRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(serviceRoot, '../../.env') });
dotenv.config({ path: path.resolve(serviceRoot, '.env'), override: true });

async function main(): Promise<void> {
  process.env.TELEGRAM_NGROK_AUTOSYNC = 'true';

  const { verifyBot } = await import('../src/services/telegramApi');
  const { registerTelegramWebhook } = await import('../src/services/webhookRegistration');

  await verifyBot();
  const url = await registerTelegramWebhook();
  if (!url) {
    throw new Error('Could not resolve ngrok URL. Is ngrok http running?');
  }
  console.log('Webhook set:', url);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
