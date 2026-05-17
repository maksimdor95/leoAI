import path from 'path';
import dotenv from 'dotenv';

const serviceRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(serviceRoot, '../../.env') });
dotenv.config({ path: path.resolve(serviceRoot, '.env'), override: true });

async function main(): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  const { deleteWebhook, verifyBot } = await import('../src/services/telegramApi');
  await verifyBot();
  await deleteWebhook();
  console.log('Webhook deleted. Dev polling can be used again.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
