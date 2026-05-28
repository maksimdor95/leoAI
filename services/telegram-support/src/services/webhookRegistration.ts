import { config } from '../config';
import { resolveNgrokWebhookUrl } from './ngrokWebhook';
import { setWebhook } from './telegramApi';
import { logger } from '../utils/logger';

export async function registerTelegramWebhook(): Promise<string | undefined> {
  let webhookUrl = config.webhookUrl;

  if (config.ngrokAutosync) {
    const fromNgrok = await resolveNgrokWebhookUrl(config.port);
    if (fromNgrok) {
      webhookUrl = fromNgrok;
    }
  }

  if (!webhookUrl) {
    logger.warn(
      'Webhook mode: set TELEGRAM_WEBHOOK_URL or TELEGRAM_NGROK_AUTOSYNC=true with ngrok http running'
    );
    return undefined;
  }

  await setWebhook(webhookUrl, config.webhookSecret || undefined);
  logger.info(`Webhook registered: ${webhookUrl}`);
  return webhookUrl;
}
