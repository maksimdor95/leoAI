import { Request, Response } from 'express';
import { z } from 'zod';
import { getYandexEmbedding } from '../services/yandexClient';
import { logger } from '../utils/logger';

const embeddingSchema = z.object({
  text: z.string(),
});

export async function generateEmbedding(req: Request, res: Response) {
  try {
    const parsed = embeddingSchema.parse(req.body);
    const embedding = await getYandexEmbedding(parsed.text);
    res.json({ embedding });
  } catch (error: unknown) {
    logger.error('Error generating embedding:', error);
    res.status(500).json({ error: 'Failed to generate embedding' });
  }
}
