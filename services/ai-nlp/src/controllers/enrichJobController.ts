import { Request, Response } from 'express';
import { z } from 'zod';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const enrichJobSchema = z.object({
  title: z.string(),
  description: z.string(),
  requirements: z.string().optional(),
});

export async function enrichJob(req: Request, res: Response) {
  try {
    const parsed = enrichJobSchema.parse(req.body);
    const { title, description, requirements } = parsed;

    const fullText = `Title: ${title}\nDescription: ${description}\nRequirements: ${requirements || ''}`;

    const prompt = `Ты — AI-ассистент, который извлекает структурированную информацию из текста вакансии.
Тебе будет дано описание вакансии.
Извлеки из него следующие данные в формате JSON:
- skills: массив строк (навыки, инструменты, технологии)
- experience_level: строка (одно из: "junior", "middle", "senior", "lead", "unknown")
- work_mode: строка (одно из: "remote", "office", "hybrid", "unknown")

Верни ТОЛЬКО валидный JSON, без markdown-разметки, без пояснений.

Текст вакансии:
${fullText}`;

    const response = await callYandexModel({
      messages: [
        { role: 'system', text: 'Ты извлекаешь данные из вакансий в формате JSON.' },
        { role: 'user', text: prompt },
      ],
      completionOptions: {
        temperature: 0.1,
        maxTokens: 500,
      },
    });

    const responseText = response.message.text || '{}';
    let result = {};
    try {
      // Remove markdown code blocks if any
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse JSON from YandexGPT:', responseText);
      result = { skills: [], experience_level: 'unknown', work_mode: 'unknown' };
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error enriching job:', error);
    res.status(500).json({ error: 'Failed to enrich job' });
  }
}
