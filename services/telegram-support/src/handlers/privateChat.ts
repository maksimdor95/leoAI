import { config } from '../config';
import {
  displayName,
  escapeHtml,
  formatTicketHeader,
  helpText,
  privacyText,
  receivedAckText,
  welcomeText,
} from '../messages';
import * as telegram from '../services/telegramApi';
import { nextTicketNumber, saveTicket, type Ticket } from '../services/ticketStore';
import type { TelegramMessage } from '../types/telegram';
import { logger } from '../utils/logger';

function parseStartParam(text: string): string | undefined {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  return match?.[1]?.trim() || undefined;
}

function isCommand(text: string, command: string): boolean {
  const normalized = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
  return normalized === command || normalized.startsWith(`${command}@`);
}

function hasAttachments(message: TelegramMessage): boolean {
  return Boolean(
    message.photo || message.document || message.voice || message.video || message.caption
  );
}

export async function handlePrivateMessage(message: TelegramMessage): Promise<void> {
  const from = message.from;
  if (!from || from.is_bot) return;

  const userId = from.id;
  const text = message.text?.trim() || '';

  if (text && isCommand(text, '/start')) {
    await telegram.sendMessage(userId, welcomeText(parseStartParam(text)));
    return;
  }

  if (text && isCommand(text, '/help')) {
    await telegram.sendMessage(userId, helpText());
    return;
  }

  if (text && isCommand(text, '/privacy')) {
    await telegram.sendMessage(userId, privacyText());
    return;
  }

  await forwardToSupport(message, from);
  await telegram.sendMessage(userId, receivedAckText());
}

async function forwardToSupport(
  message: TelegramMessage,
  from: NonNullable<TelegramMessage['from']>
): Promise<void> {
  const supportChatId = config.supportChatId();
  const ticketNo = nextTicketNumber();
  const name = displayName(from);

  const ticket: Ticket = {
    userId: from.id,
    username: from.username,
    displayName: name,
    createdAt: Date.now(),
  };

  const header = formatTicketHeader(ticketNo, name, from.username, from.id, ticket.source);
  const userText = message.text || message.caption;

  if (userText && !userText.startsWith('/')) {
    const groupMessage = await telegram.sendMessage(
      supportChatId,
      `${header}\n\n${escapeHtml(userText)}`
    );
    saveTicket(groupMessage.message_id, ticket);
    logger.info(`Ticket #${ticketNo} → group msg ${groupMessage.message_id} (user ${from.id})`);
    return;
  }

  const headerMessage = await telegram.sendMessage(supportChatId, header);
  saveTicket(headerMessage.message_id, ticket);

  if (hasAttachments(message)) {
    try {
      await telegram.forwardMessage(supportChatId, message.chat.id, message.message_id);
    } catch (error) {
      logger.warn('forwardMessage failed', error);
    }
  }

  logger.info(`Ticket #${ticketNo} → group msg ${headerMessage.message_id} (user ${from.id})`);
}
