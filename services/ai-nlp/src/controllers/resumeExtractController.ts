/**
 * Извлечение структурированных полей профиля из текста резюме (Yandex GPT).
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { buildSystemMessage, buildUserMessage } from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const bodySchema = z.object({
  resumeText: z.string().min(40),
  scenarioId: z.string().min(1).optional(),
});

function parseJsonObject(text: string): Record<string, unknown> {
  let t = text.trim();
  const block = t.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m);
  if (block) {
    t = block[1].trim();
  }
  const parsed = JSON.parse(t) as unknown;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error('Ответ модели не является объектом JSON');
}

export async function extractProfileFromResume(req: Request, res: Response) {
  try {
    const parsed = bodySchema.parse(req.body);
    const scenarioId = parsed.scenarioId || 'jack-profile-v2';

    const wannanewHint =
      scenarioId === 'wannanew-pm-v1'
        ? `
Ключи для сценария wannanew (используй только те, что удалось вывести из текста):
- resumeOrIntro — краткое резюме опыта одной строкой или абзацем (обязательно, если есть опыт)
- targetRole — уровень PM: Junior | Middle | Senior | Lead | VP (если удаётся)
- targetProductType — B2C | B2B | SaaS | Marketplace | Hardware | Internal tools или краткое описание
- pmCase — один сильный продуктовый кейс (метрики, результат), если есть в тексте
`
        : `
Ключи для расширенного профиля Jack (заполни только то, что явно следует из резюме):
- careerSummary — краткий обзор карьеры (2–4 предложения)
- totalExperience — число полных лет опыта (число или строка с числом)
- positionsCount — сколько позиций описать (1–5), если удаётся оценить
- position_1_company, position_1_role, position_1_industry, position_1_achievements
- position_2_company, position_2_role, position_2_achievements (если есть вторая роль)
- education_main, education_additional
- skills_hard, skills_soft, skills_languages
- desired_role, desired_location, desired_salary, desired_culture, desired_start
`;

    const system = buildSystemMessage({
      extraSections: [
        `# Задача
Ты извлекаешь структурированные поля профиля кандидата из текста резюме.
Верни ТОЛЬКО один JSON-объект без пояснений и без markdown.
Не выдумывай факты: если чего-то нет в тексте — не включай ключ или поставь null.
Числовые поля — числа или строки с цифрами, как удобнее для фронтенда.
${wannanewHint}
## Формат ответа
{
  "fields": { ... },
  "notes": "кратко: что удалось / чего не хватило в тексте"
}`,
      ],
    });

    const user = buildUserMessage(
      `Текст резюме:\n---\n${parsed.resumeText.slice(0, 48000)}\n---\n\nscenarioId: ${scenarioId}`
    );

    const ai = await callYandexModel({
      sessionId: `resume-extract-${scenarioId}`,
      userId: 'resume-parser',
      messages: [system, user],
      completionOptions: {
        temperature: 0.1,
        maxTokens: 4000,
      },
    });

    const raw = ai.message.text;
    const obj = parseJsonObject(raw);
    let fields: Record<string, unknown>;
    if (obj.fields && typeof obj.fields === 'object' && !Array.isArray(obj.fields)) {
      fields = obj.fields as Record<string, unknown>;
    } else {
      const { notes: _notes, ...rest } = obj;
      fields = rest;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim().length === 0) continue;
      cleaned[k] = v;
    }

    logger.info(`extractProfileFromResume: ${Object.keys(cleaned).length} keys for ${scenarioId}`);

    const notesVal = obj.notes;
    res.json({
      status: 'success',
      fields: cleaned,
      notes: typeof notesVal === 'string' ? notesVal : undefined,
    });
  } catch (error: unknown) {
    logger.error('extractProfileFromResume failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to extract profile';
    res.status(400).json({ status: 'error', message });
  }
}
