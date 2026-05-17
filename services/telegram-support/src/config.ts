import path from 'path';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

const serviceRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(serviceRoot, '../../.env') });
dotenv.config({ path: path.resolve(serviceRoot, '.env'), override: true });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOperatorIds(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id));
}

const nodeEnv = process.env.NODE_ENV || 'development';
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim() || '';
const pollingFlag = process.env.TELEGRAM_USE_POLLING?.trim().toLowerCase();

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  nodeEnv,
  botToken: () => requireEnv('TELEGRAM_BOT_TOKEN'),
  supportChatId: () => Number(requireEnv('TELEGRAM_SUPPORT_CHAT_ID')),
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
  siteUrl: (process.env.TELEGRAM_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://leoai.com').replace(
    /\/$/,
    ''
  ),
  operatorIds: parseOperatorIds(process.env.TELEGRAM_OPERATOR_IDS),
  webhookUrl,
  usePolling:
    pollingFlag === 'true' ||
    (pollingFlag !== 'false' && nodeEnv !== 'production' && !webhookUrl),
};

export function validateConfig(): void {
  config.botToken();
  const chatId = config.supportChatId();
  if (!Number.isFinite(chatId)) {
    throw new Error('TELEGRAM_SUPPORT_CHAT_ID must be a number');
  }
  logger.info('Telegram support config OK', {
    supportChatId: chatId,
    siteUrl: config.siteUrl,
    usePolling: config.usePolling,
    operators: config.operatorIds.length ? config.operatorIds.length : 'any',
  });
}
