import { Request, Response } from 'express';
import { z } from 'zod';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const aiReadinessSchema = z.object({
  skills: z.array(z.string()),
  targetRole: z.string().optional(),
});

export async function generateAiReadiness(req: Request, res: Response) {
  try {
    const parsed = aiReadinessSchema.parse(req.body);
    const { skills, targetRole } = parsed;

    const prompt = `Ты — карьерный консультант. Оцени готовность кандидата к использованию AI-инструментов в работе.
Целевая роль: ${targetRole || 'Не указана'}
Навыки кандидата: ${skills.join(', ') || 'Не указаны'}

Верни ТОЛЬКО валидный JSON со следующими полями:
- score: число от 0 до 100 (оценка готовности)
- summary: строка (краткое резюме, 1-2 предложения)
- recommendations: массив строк (3 конкретные рекомендации по развитию AI-навыков для этой роли)

Без markdown-разметки, без пояснений.`;

    const response = await callYandexModel({
      messages: [
        { role: 'system', text: 'Ты оцениваешь AI-навыки кандидата и возвращаешь JSON.' },
        { role: 'user', text: prompt },
      ],
      completionOptions: {
        temperature: 0.3,
        maxTokens: 500,
      },
    });

    const responseText = response.message.text || '{}';
    let result = {};
    try {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (e) {
      logger.error('Failed to parse JSON from YandexGPT:', responseText);
      result = { 
        score: 42, 
        summary: 'Не удалось сгенерировать оценку', 
        recommendations: ['Попробуйте позже'] 
      };
    }

    res.json(result);
  } catch (error: unknown) {
    logger.error('Error generating AI readiness:', error);
    res.status(500).json({ error: 'Failed to generate AI readiness' });
  }
}
