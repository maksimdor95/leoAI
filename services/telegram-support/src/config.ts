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
const ngrokAutosyncFlag = process.env.TELEGRAM_NGROK_AUTOSYNC?.trim().toLowerCase();

function optionalProxyUrl(): string {
  return (
    process.env.TELEGRAM_PROXY_URL?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    ''
  );
}

const strictConfigFlag = process.env.TELEGRAM_STRICT_CONFIG?.trim().toLowerCase();

function resolveBindHost(): string {
  const explicit = process.env.BIND_HOST?.trim() || process.env.TELEGRAM_BIND_HOST?.trim();
  if (explicit) return explicit;
  if (nodeEnv === 'production') return '127.0.0.1';
  return '0.0.0.0';
}

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  bindHost: resolveBindHost(),
  nodeEnv,
  botToken: () => requireEnv('TELEGRAM_BOT_TOKEN'),
  supportChatId: () => Number(requireEnv('TELEGRAM_SUPPORT_CHAT_ID')),
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
  siteUrl: (process.env.TELEGRAM_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://leoai.com').replace(
    /\/$/,
    ''
  ),
  operatorIds: parseOperatorIds(process.env.TELEGRAM_OPERATOR_IDS),
  apiRoot: (process.env.TELEGRAM_API_ROOT?.trim() || 'https://api.telegram.org').replace(/\/$/, ''),
  proxyUrl: optionalProxyUrl,
  webhookUrl,
  ngrokAutosync: ngrokAutosyncFlag === 'true' || ngrokAutosyncFlag === '1',
  registerWebhookOnStart:
    process.env.TELEGRAM_REGISTER_WEBHOOK_ON_START?.trim().toLowerCase() !== 'false',
  usePolling:
    pollingFlag === 'true' ||
    (pollingFlag !== 'false' &&
      nodeEnv !== 'production' &&
      !webhookUrl &&
      !configNgrokAutosyncEnabled()),
};

function configNgrokAutosyncEnabled(): boolean {
  return ngrokAutosyncFlag === 'true' || ngrokAutosyncFlag === '1';
}

export function validateConfig(): void {
  config.botToken();
  const chatId = config.supportChatId();
  if (!Number.isFinite(chatId)) {
    throw new Error('TELEGRAM_SUPPORT_CHAT_ID must be a number');
  }

  const strict =
    strictConfigFlag === 'true' ||
    strictConfigFlag === '1' ||
    nodeEnv === 'production';

  if (strict && !config.operatorIds.length) {
    logger.warn(
      'TELEGRAM_OPERATOR_IDS is empty — any member of the support group can reply to users'
    );
  }

  if (strict && !config.usePolling && !config.webhookSecret) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET is required in webhook mode (TELEGRAM_STRICT_CONFIG)');
  }

  logger.info('Telegram support config OK', {
    supportChatId: chatId,
    siteUrl: config.siteUrl,
    bindHost: config.bindHost,
    usePolling: config.usePolling,
    webhook: config.webhookUrl || (config.ngrokAutosync ? 'ngrok-autosync' : 'none'),
    proxy: config.proxyUrl() ? 'enabled' : 'disabled',
    operators: config.operatorIds.length ? config.operatorIds.length : 'any',
    strictConfig: strict,
  });
}
