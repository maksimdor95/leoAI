import { validateConfig, config } from './config';
import { initSentry } from './utils/sentry';
initSentry('telegram-support');

import express from 'express';
import helmet from 'helmet';
import { webhookRouter } from './routes/webhook';
import { startPolling } from './services/polling';
import { verifyBotWithRetry } from './services/telegramApi';
import { registerTelegramWebhook } from './services/webhookRegistration';
import { ticketCount } from './services/ticketStore';
import { getConnectionState } from './services/connectionState';
import { logger } from './utils/logger';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    service: 'telegram-support',
    version: '0.1.0',
    mode: config.usePolling ? 'polling' : 'webhook',
    endpoints: {
      health: '/health',
      webhook: 'POST /telegram/webhook',
    },
  });
});

app.get('/health', (_req, res) => {
  const telegram = getConnectionState();
  const ok = telegram.connected;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    mode: config.usePolling ? 'polling' : 'webhook',
    openTickets: ticketCount(),
    telegram: {
      connected: telegram.connected,
      lastSuccessAt: telegram.lastSuccessAt
        ? new Date(telegram.lastSuccessAt).toISOString()
        : null,
      lastErrorAt: telegram.lastErrorAt ? new Date(telegram.lastErrorAt).toISOString() : null,
      consecutiveErrors: telegram.consecutiveErrors,
    },
  });
});

app.use('/telegram', webhookRouter);

async function start(): Promise<void> {
  validateConfig();

  await new Promise<void>((resolve) => {
    app.listen(config.port, config.bindHost, () => {
      logger.info(`Telegram Support Service on http://${config.bindHost}:${config.port}`);
      logger.info(`Site URL: ${config.siteUrl}`);
      resolve();
    });
  });

  if (config.usePolling) {
    void verifyBotWithRetry().then((connected) => {
      if (!connected) {
        logger.warn(
          'Telegram Bot API unreachable at startup (proxy/route may be flaky). Polling will keep retrying.'
        );
      }
    });
    await startPolling();
    return;
  }

  const connected = await verifyBotWithRetry();
  if (!connected) {
    logger.warn('Telegram Bot API unreachable at startup — webhook registration skipped');
  }

  if (config.registerWebhookOnStart && connected) {
    await registerTelegramWebhook();
  } else if (config.registerWebhookOnStart) {
    logger.warn('Webhook registration skipped — Bot API unreachable');
  } else {
    logger.info('Webhook mode. Register: npm run set-webhook');
  }
}

start().catch((error) => {
  logger.error('Failed to start', error);
  process.exit(1);
});
