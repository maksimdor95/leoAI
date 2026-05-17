import { BOT_COMMANDS } from '../botCommands';
import { config } from '../config';
import type { TelegramApiResponse, TelegramMessage, TelegramUpdate } from '../types/telegram';
import { logger } from '../utils/logger';

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${config.botToken()}/${method}`;
}

async function callTelegram<T>(
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed`);
  }
  return data.result as T;
}

export async function getMe(): Promise<{ username?: string }> {
  return callTelegram('getMe');
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: { replyToMessageId?: number; disableWebPagePreview?: boolean }
): Promise<TelegramMessage> {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: options?.disableWebPagePreview ?? true,
    reply_to_message_id: options?.replyToMessageId,
  });
}

export async function forwardMessage(
  toChatId: number,
  fromChatId: number,
  messageId: number
): Promise<TelegramMessage> {
  return callTelegram('forwardMessage', {
    chat_id: toChatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  });
}

export async function copyMessage(
  toChatId: number,
  fromChatId: number,
  messageId: number,
  caption?: string
): Promise<TelegramMessage> {
  return callTelegram('copyMessage', {
    chat_id: toChatId,
    from_chat_id: fromChatId,
    message_id: messageId,
    caption,
    parse_mode: caption ? 'HTML' : undefined,
  });
}

export async function deleteWebhook(): Promise<boolean> {
  return callTelegram('deleteWebhook', { drop_pending_updates: false });
}

export async function setWebhook(url: string, secretToken?: string): Promise<boolean> {
  return callTelegram('setWebhook', {
    url,
    secret_token: secretToken || undefined,
    allowed_updates: ['message'],
  });
}

export async function getUpdates(offset: number, timeout = 25): Promise<TelegramUpdate[]> {
  return callTelegram('getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message'],
  });
}

export async function setMyCommands(): Promise<void> {
  await callTelegram('setMyCommands', {
    commands: BOT_COMMANDS.map((c) => ({
      command: c.command,
      description: c.description,
    })),
    scope: { type: 'all_private_chats' },
  });
}

export async function verifyBot(): Promise<void> {
  const me = await getMe();
  logger.info(`Bot connected: @${me.username || 'unknown'}`);
  await setMyCommands();
  logger.info('Bot commands registered: /start, /help, /privacy');
}
