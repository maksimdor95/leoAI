import { handleUpdate } from './supportRouter';
import { getConnectionState, markTelegramError, markTelegramSuccess } from './connectionState';
import * as telegram from '../services/telegramApi';
import { logger } from '../utils/logger';

let running = false;
let offset = 0;

const POLL_OK_MS = 3000;
const POLL_BACKOFF_MIN_MS = 3000;
const POLL_BACKOFF_MAX_MS = 60_000;

export async function startPolling(): Promise<void> {
  if (running) return;
  running = true;

  try {
    await telegram.deleteWebhook();
  } catch (error) {
    logger.warn('deleteWebhook failed at polling start (will retry via getUpdates)', error);
  }
  logger.info('Long polling started. Set TELEGRAM_WEBHOOK_URL for webhook mode.');

  const loop = async (): Promise<void> => {
    let backoffMs = POLL_BACKOFF_MIN_MS;

    while (running) {
      try {
        const updates = await telegram.getUpdates(offset);
        markTelegramSuccess();
        backoffMs = POLL_BACKOFF_MIN_MS;

        for (const update of updates) {
          offset = update.update_id + 1;
          await handleUpdate(update);
        }

        await sleep(POLL_OK_MS);
      } catch (error) {
        markTelegramError();
        const { consecutiveErrors } = getConnectionState();

        if (consecutiveErrors === 1 || consecutiveErrors % 10 === 0) {
          logger.warn(
            `Polling error (retry in ${backoffMs}ms, streak=${consecutiveErrors})`,
            error
          );
        }

        await sleep(backoffMs);
        backoffMs = Math.min(backoffMs * 2, POLL_BACKOFF_MAX_MS);
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
