import { handleUpdate } from './supportRouter';
import * as telegram from './telegramApi';
import { logger } from '../utils/logger';

let running = false;
let offset = 0;

export async function startPolling(): Promise<void> {
  if (running) return;
  running = true;

  await telegram.deleteWebhook();
  logger.info('Long polling started (dev mode). Set TELEGRAM_WEBHOOK_URL for production webhook.');

  const loop = async (): Promise<void> => {
    while (running) {
      try {
        const updates = await telegram.getUpdates(offset);
        for (const update of updates) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }
      } catch (error) {
        logger.error('Polling error', error);
        await sleep(3000);
      }
    }
  };

  void loop();
}

export function stopPolling(): void {
  running = false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
