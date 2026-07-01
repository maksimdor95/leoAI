import { config } from '../config';
import {
  displayName,
  escapeHtml,
  formatTicketHeader,
  helpText,
  privacyText,
  receivedAckText,
  forwardDelayedAckText,
  welcomeText,
} from '../messages';
import * as telegram from '../services/telegramApi';
import { nextTicketNumber, saveTicket, type Ticket } from '../services/ticketStore';
import { getSiteUserId, linkTelegramToSite } from '../services/userLinkStore';
import type { TelegramMessage } from '../types/telegram';
import { logger } from '../utils/logger';

function parseStartParam(text: string): string | undefined {
  const match = text.trim().match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
  return match?.[1]?.trim() || undefined;
}

function parseSiteUserIdFromStart(startParam?: string): string | undefined {
  if (!startParam?.startsWith('u_')) return undefined;
  const siteUserId = startParam.slice(2).trim();
  return siteUserId || undefined;
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
    const startParam = parseStartParam(text);
    const siteUserIdFromStart = parseSiteUserIdFromStart(startParam);
    if (siteUserIdFromStart) {
      linkTelegramToSite(userId, siteUserIdFromStart);
      logger.info(`Linked Telegram ${userId} → site user ${siteUserIdFromStart}`);
    }
    await telegram.sendMessage(
      userId,
      welcomeText(startParam, Boolean(siteUserIdFromStart || getSiteUserId(userId)))
    );
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

  await handleSupportMessage(message, from);
}

async function handleSupportMessage(
  message: TelegramMessage,
  from: NonNullable<TelegramMessage['from']>
): Promise<void> {
  const userId = from.id;

  try {
    await telegram.withTelegramRetry(() => telegram.sendMessage(userId, receivedAckText()));
  } catch (error) {
    logger.error('Failed to send ack to user', { userId, error });
    return;
  }

  try {
    await telegram.withTelegramRetry(() => forwardToSupport(message, from));
  } catch (error) {
    logger.error('Failed to forward ticket to support group', { userId, error });
    try {
      await telegram.sendMessage(userId, forwardDelayedAckText());
    } catch (notifyError) {
      logger.error('Failed to notify user about forward delay', { userId, error: notifyError });
    }
  }
}

async function forwardToSupport(
  message: TelegramMessage,
  from: NonNullable<TelegramMessage['from']>
): Promise<void> {
  const supportChatId = config.supportChatId();
  const ticketNo = nextTicketNumber();
  const name = displayName(from);

  const siteUserId = getSiteUserId(from.id);

  const ticket: Ticket = {
    userId: from.id,
    username: from.username,
    displayName: name,
    siteUserId,
    createdAt: Date.now(),
  };

  const header = formatTicketHeader(
    ticketNo,
    name,
    from.username,
    from.id,
    ticket.source,
    siteUserId
  );
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
