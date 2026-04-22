import { Request, Response } from 'express';
import { z } from 'zod';
import { synthesizeWithYandexTts } from '../services/yandexTtsClient';
import { logger } from '../utils/logger';

const requestSchema = z.object({
  text: z.string().trim().min(1).max(1200),
  lang: z.string().optional(),
  voice: z.string().optional(),
  speed: z.number().min(0.1).max(3).optional(),
  format: z.enum(['mp3', 'oggopus']).optional(),
});

export async function synthesizeTts(req: Request, res: Response) {
  try {
    const parsed = requestSchema.parse(req.body);

    const audio = await synthesizeWithYandexTts({
      text: parsed.text,
      lang: parsed.lang,
      voice: parsed.voice,
      speed: parsed.speed,
      format: parsed.format,
    });

    res.json({
      status: 'success',
      ...audio,
    });
  } catch (error: unknown) {
    logger.error('TTS synthesis error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid request',
        details: error.issues,
      });
      return;
    }
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'TTS synthesis failed',
    });
  }
}
