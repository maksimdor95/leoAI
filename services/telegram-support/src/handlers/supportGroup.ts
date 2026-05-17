import { config } from '../config';
import * as telegram from '../services/telegramApi';
import { getTicketByGroupMessage } from '../services/ticketStore';
import type { TelegramMessage } from '../types/telegram';
import { escapeHtml, operatorHintNoTicket } from '../messages';
import { logger } from '../utils/logger';

function isOperatorAllowed(userId: number): boolean {
  const allowed = config.operatorIds;
  if (!allowed.length) return true;
  return allowed.includes(userId);
}

function resolveTicketMessageId(message: TelegramMessage): number | undefined {
  const reply = message.reply_to_message;
  if (!reply) return undefined;
  return reply.message_id;
}

export async function handleSupportGroupMessage(message: TelegramMessage): Promise<void> {
  if (message.chat.id !== config.supportChatId()) return;

  const from = message.from;
  if (!from || from.is_bot) return;

  if (!isOperatorAllowed(from.id)) {
    logger.warn(`Ignored reply from non-operator ${from.id}`);
    return;
  }

  const ticketMessageId = resolveTicketMessageId(message);
  if (!ticketMessageId) return;

  const ticket = getTicketByGroupMessage(ticketMessageId);
  if (!ticket) {
    await telegram.sendMessage(config.supportChatId(), operatorHintNoTicket(), {
      replyToMessageId: message.message_id,
    });
    return;
  }

  const replyText = message.text?.trim();
  const hasMedia =
    Boolean(message.photo) ||
    Boolean(message.document) ||
    Boolean(message.voice) ||
    Boolean(message.video);

  if (replyText) {
    const prefix = '💬 <b>Ответ поддержки LEO AI</b>\n\n';
    await telegram.sendMessage(ticket.userId, `${prefix}${escapeHtml(replyText)}`);
    logger.info(`Reply sent to user ${ticket.userId} from operator ${from.id}`);
    return;
  }

  if (hasMedia) {
    try {
      await telegram.copyMessage(ticket.userId, message.chat.id, message.message_id);
      await telegram.sendMessage(
        ticket.userId,
        '💬 <b>Ответ поддержки LEO AI</b> (вложение выше)'
      );
      logger.info(`Media reply sent to user ${ticket.userId}`);
    } catch (error) {
      logger.error('Failed to copy media to user', error);
      await telegram.sendMessage(
        config.supportChatId(),
        'Не удалось переслать вложение пользователю. Попробуйте ответить текстом.',
        { replyToMessageId: message.message_id }
      );
    }
  }
}
