import { Request, Response } from 'express';
import { z } from 'zod';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';
import {
  APPLICATION_DRAFT_PROMPT_VERSION,
  APPLICATION_DRAFT_TONES,
  ApplicationDraftJobInput,
  ApplicationDraftTone,
  buildApplicationDraftPrompt,
  parseApplicationDraftJson,
  temperatureForApplicationDraftTone,
  maxTokensForApplicationDraftTone,
} from '../services/applicationDraftPrompts';

const applicationDraftSchema = z.object({
  collectedData: z.record(z.any()).default({}),
  job: z.object({
    title: z.string().min(1),
    company: z.string().min(1),
    description: z.string().optional(),
    requirements: z.string().optional(),
    skills: z.array(z.string()).optional(),
    location: z.array(z.string()).optional(),
    workMode: z.string().nullable().optional(),
    conditions: z.record(z.any()).nullable().optional(),
  }),
  tone: z.enum(APPLICATION_DRAFT_TONES).optional(),
  matchHighlights: z.array(z.string()).optional(),
});

export async function generateApplicationDraft(req: Request, res: Response): Promise<void> {
  try {
    const parsed = applicationDraftSchema.parse(req.body);
    const tone: ApplicationDraftTone = parsed.tone ?? 'neutral';
    const job: ApplicationDraftJobInput = parsed.job;

    const { system, user } = buildApplicationDraftPrompt({
      collectedData: parsed.collectedData,
      job,
      tone,
      matchHighlights: parsed.matchHighlights,
    });

    const aiResponse = await callYandexModel({
      sessionId: `application-draft-${Date.now()}`,
      userId: 'system',
      messages: [
        { role: 'system', text: system },
        { role: 'user', text: user },
      ],
      completionOptions: {
        temperature: temperatureForApplicationDraftTone(tone),
        maxTokens: maxTokensForApplicationDraftTone(tone),
      },
    });

    const fallback = {
      headline: '',
      coverLetter:
        'Откликаюсь на эту роль: мой опыт в продукте и запуске B2B-решений пересекается с задачами вакансии. Готов коротко рассказать о релевантных кейсах.',
      bullets: [] as string[],
    };

    const draft = parseApplicationDraftJson(aiResponse.message.text || '', fallback);

    res.json({
      status: 'success',
      draft,
      promptVersion: APPLICATION_DRAFT_PROMPT_VERSION,
    });
  } catch (error: unknown) {
    logger.error('Failed to generate application draft:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate application draft',
    });
  }
}
