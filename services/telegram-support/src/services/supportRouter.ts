import { handlePrivateMessage } from '../handlers/privateChat';
import { handleSupportGroupMessage } from '../handlers/supportGroup';
import type { TelegramUpdate } from '../types/telegram';
import { logger } from '../utils/logger';

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message) return;

  const chatType = message.chat.type;

  try {
    if (chatType === 'private') {
      await handlePrivateMessage(message);
      return;
    }

    if (chatType === 'group' || chatType === 'supergroup') {
      await handleSupportGroupMessage(message);
    }
  } catch (error) {
    logger.error('handleUpdate failed', { updateId: update.update_id, error });
  }
}
