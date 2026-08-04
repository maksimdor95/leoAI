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
  matchedSkills: z.array(z.string()).optional(),
  missingSkills: z.array(z.string()).optional(),
  snippet: z.string().optional(),
});

const rerankSchema = z.object({
  profileSummary: z.string().min(20).max(5000),
  experienceHighlights: z.array(z.string()).max(8).optional(),
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
    const { profileSummary, experienceHighlights = [], redFlags = [], jobs } = parsed;

    const jobsBlock = jobs
      .map((j, i) => {
        const skillsLine =
          (j.matchedSkills?.length
            ? ` matched=[${j.matchedSkills.slice(0, 5).join(', ')}]`
            : '') +
          (j.missingSkills?.length
            ? ` missing=[${j.missingSkills.slice(0, 4).join(', ')}]`
            : '');
        return (
          `${i + 1}. id=${j.id} | ${j.title} @ ${j.company} | score=${j.score}` +
          skillsLine +
          (j.reasons?.length ? ` | reasons: ${j.reasons.slice(0, 4).join('; ')}` : '') +
          (j.snippet ? `\n   JD: ${j.snippet.slice(0, 800)}` : '')
        );
      })
      .join('\n');

    const flagsLine =
      redFlags.length > 0
        ? `Исключения кандидата (обязательно учитывать): ${redFlags.join(', ')}`
        : 'Явных исключений нет.';

    const experienceBlock =
      experienceHighlights.length > 0
        ? `Ключевые позиции / достижения кандидата:\n- ${experienceHighlights
            .map((h) => h.slice(0, 220))
            .join('\n- ')}`
        : 'Отдельные буллеты опыта не переданы — опирайся на профиль ниже.';

    const prompt = `Ты — карьерный matching-аналитик LEO AI.
Дан профиль кандидата и shortlist вакансий со скором правила.
Скорректируй порядок: сравни обязанности и требования JD с опытом и достижениями кандидата
(роль, домен, seniority, навыки, исключения).
Не выдумывай факты, которых нет в тексте.
explain обязателен: одно короткое предложение на русском — почему вакансия лучше или хуже подходит
по сути опыта ↔ обязанностей (не про график/часы).

${flagsLine}

${experienceBlock}

Профиль:
${profileSummary.slice(0, 2800)}

Вакансии:
${jobsBlock}

Верни ТОЛЬКО JSON:
{
  "items": [
    { "id": "...", "delta": -10..10, "explain": "Подходит потому что … / Слабее потому что …" }
  ]
}
delta: положительный = лучше fit, отрицательный = хуже. Для каждой вакансии ровно один item с тем же id.
explain: обязательно, до 220 символов, без воды.`;

    const response = await callYandexModel({
      messages: [
        {
          role: 'system',
          text: 'Ты ранжируешь вакансии для кандидата. Ответ — только валидный JSON без markdown. У каждой вакансии должен быть explain.',
        },
        { role: 'user', text: prompt },
      ],
      completionOptions: {
        temperature: 0.15,
        maxTokens: 1600,
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
            ? item.explain.trim().slice(0, 240)
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

    const explainCount = result.filter((r) => r.explain).length;
    logger.info(`match-rerank: jobs=${jobs.length} explain=${explainCount}/${jobs.length}`);

    res.json({ items: result });
  } catch (error: unknown) {
    logger.error('Error reranking matched jobs:', error);
    res.status(500).json({ error: 'Failed to rerank matched jobs' });
  }
}
