import express from 'express';
import helmet from 'helmet';
import { validateConfig, config } from './config';
import { webhookRouter } from './routes/webhook';
import { startPolling } from './services/polling';
import { verifyBot } from './services/telegramApi';
import { ticketCount } from './services/ticketStore';
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
  res.json({
    status: 'ok',
    mode: config.usePolling ? 'polling' : 'webhook',
    openTickets: ticketCount(),
  });
});

app.use('/telegram', webhookRouter);

async function start(): Promise<void> {
  validateConfig();
  await verifyBot();

  app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Telegram Support Service on http://0.0.0.0:${config.port}`);
    logger.info(`Site URL: ${config.siteUrl}`);
  });

  if (config.usePolling) {
    await startPolling();
  } else {
    logger.info(`Webhook mode. Register: npm run set-webhook (TELEGRAM_WEBHOOK_URL)`);
  }
}

start().catch((error) => {
  logger.error('Failed to start', error);
  process.exit(1);
});
