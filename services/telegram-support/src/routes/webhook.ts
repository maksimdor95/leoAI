import { Router, type Request, type Response } from 'express';
import { config } from '../config';
import { handleUpdate } from '../services/supportRouter';
import type { TelegramUpdate } from '../types/telegram';

export const webhookRouter = Router();

webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const secret = config.webhookSecret;
  if (secret) {
    const header = req.get('x-telegram-bot-api-secret-token');
    if (header !== secret) {
      res.status(403).json({ ok: false, error: 'Invalid webhook secret' });
      return;
    }
  }

  const update = req.body as TelegramUpdate;
  if (!update?.update_id) {
    res.status(400).json({ ok: false, error: 'Invalid update' });
    return;
  }

  res.status(200).json({ ok: true });

  setImmediate(() => {
    void handleUpdate(update);
  });
});

webhookRouter.get('/webhook', (_req, res) => {
  res.json({
    ok: true,
    message: 'Telegram webhook endpoint. Use POST.',
  });
});
