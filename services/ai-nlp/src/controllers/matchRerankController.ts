/**
 * Layer 3: LLM tie-break / explain for top-N matched jobs.
 * Fail-open: при ошибке возвращаем исходный порядок.
 */

import { z } from 'zod';
import { Request, Response } from 'express';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const jobItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  score: z.number(),
  reasons: z.array(z.string()).optional(),
  snippet: z.string().optional(),
});

const rerankSchema = z.object({
  profileSummary: z.string().min(20).max(4000),
  redFlags: z.array(z.string()).max(12).optional(),
  jobs: z.array(jobItemSchema).min(1).max(20),
});

export type MatchRerankItem = z.infer<typeof jobItemSchema> & {
  /** −15…+15 от LLM; итоговый порядок = score + delta. */
  delta?: number;
  explain?: string;
};

function parseJsonObject(text: string): unknown {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('invalid json');
  }
}

export async function rerankMatchedJobs(req: Request, res: Response): Promise<void> {
  try {
    const parsed = rerankSchema.parse(req.body);
    const { profileSummary, redFlags = [], jobs } = parsed;

    const jobsBlock = jobs
      .map(
        (j, i) =>
          `${i + 1}. id=${j.id} | ${j.title} @ ${j.company} | score=${j.score}` +
          (j.reasons?.length ? ` | reasons: ${j.reasons.slice(0, 3).join('; ')}` : '') +
          (j.snippet ? `\n   ${j.snippet.slice(0, 280)}` : '')
      )
      .join('\n');

    const flagsLine =
      redFlags.length > 0
        ? `Исключения кандидата (обязательно учитывать): ${redFlags.join(', ')}`
        : 'Явных исключений нет.';

    const prompt = `Ты — карьерный matching-аналитик LEO AI.
Дан профиль кандидата и shortlist вакансий со скором правила.
Скорректируй порядок: учти fit роли, домен, seniority, исключения.
Не выдумывай факты, которых нет в тексте.

${flagsLine}

Профиль:
${profileSummary.slice(0, 2500)}

Вакансии:
${jobsBlock}

Верни ТОЛЬКО JSON:
{
  "items": [
    { "id": "...", "delta": -10..10, "explain": "1 короткое предложение на русском почему вверх/вниз" }
  ]
}
delta: положительный = лучше fit, отрицательный = хуже. Для каждой вакансии ровно один item с тем же id.`;

    const response = await callYandexModel({
      messages: [
        {
          role: 'system',
          text: 'Ты ранжируешь вакансии для кандидата. Ответ — только валидный JSON без markdown.',
        },
        { role: 'user', text: prompt },
      ],
      completionOptions: {
        temperature: 0.15,
        maxTokens: 1200,
      },
    });

    const raw = response.message?.text || '{}';
    const json = parseJsonObject(raw) as {
      items?: Array<{ id?: string; delta?: number; explain?: string }>;
    };

    const byId = new Map<string, { delta: number; explain?: string }>();
    for (const item of json.items ?? []) {
      if (typeof item.id !== 'string' || !item.id) continue;
      const delta =
        typeof item.delta === 'number' && Number.isFinite(item.delta)
          ? Math.max(-12, Math.min(12, Math.round(item.delta)))
          : 0;
      byId.set(item.id, {
        delta,
        explain:
          typeof item.explain === 'string' && item.explain.trim()
            ? item.explain.trim().slice(0, 180)
            : undefined,
      });
    }

    const result: MatchRerankItem[] = jobs.map((job) => {
      const adj = byId.get(job.id);
      return {
        ...job,
        delta: adj?.delta ?? 0,
        explain: adj?.explain,
      };
    });

    res.json({ items: result });
  } catch (error: unknown) {
    logger.error('Error reranking matched jobs:', error);
    res.status(500).json({ error: 'Failed to rerank matched jobs' });
  }
}
