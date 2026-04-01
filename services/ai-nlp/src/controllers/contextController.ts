/**
 * Context Management Controller
 * Checks if user response stays on topic or deviates from the current question
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { buildSystemMessage, buildUserMessage } from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const checkContextSchema = z.object({
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        text: z.string(),
      })
    )
    .optional(),
  currentStep: z.object({
    id: z.string(),
    label: z.string(),
    instruction: z.string().optional(),
  }),
  userMessage: z.string().min(1),
});

interface ContextCheckResult {
  onTopic: boolean; // Остается ли пользователь в теме
  deviation: string; // Описание отклонения (если есть)
  shouldRedirect: boolean; // Нужно ли вернуть к теме
  importantInfo: string[]; // Важная информация из ответа, которую стоит сохранить
}

function parseContextCheckResponse(text: string): ContextCheckResult {
  try {
    // Try to extract JSON from text (might be wrapped in markdown or have extra text)
    let jsonText = text.trim();

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Try to find JSON object in text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Try to parse JSON response
    const parsed = JSON.parse(jsonText);

    // Validate structure
    if (
      typeof parsed.onTopic === 'boolean' &&
      typeof parsed.shouldRedirect === 'boolean' &&
      Array.isArray(parsed.importantInfo)
    ) {
      return {
        onTopic: parsed.onTopic,
        deviation: parsed.deviation || '',
        shouldRedirect: parsed.shouldRedirect,
        importantInfo: parsed.importantInfo || [],
      };
    }
  } catch (error) {
    logger.warn(
      'Failed to parse context check JSON, using fallback. Response:',
      text.substring(0, 200)
    );
  }

  // Default fallback - assume user is on topic
  return {
    onTopic: true,
    deviation: '',
    shouldRedirect: false,
    importantInfo: [],
  };
}

export async function checkContext(req: Request, res: Response) {
  try {
    const parsed = checkContextSchema.parse(req.body);
    const { conversationHistory = [], currentStep, userMessage } = parsed;

    // Build conversation history text (last 5 messages for context)
    const recentHistory = conversationHistory.slice(-5);
    const historyText =
      recentHistory.length > 0
        ? recentHistory
            .map((msg) => `${msg.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${msg.text}`)
            .join('\n')
        : 'История диалога отсутствует (начало разговора).';

    const systemPrompt = buildSystemMessage({
      extraSections: [
        `# Роль: Менеджер контекста диалога
Ты отслеживаешь, не отклоняется ли пользователь от темы текущего вопроса в диалоге с HR-ассистентом LEO.
Твоя задача — определить, остается ли ответ в теме или пользователь уходит в сторону.

## Критерии оценки:

### onTopic (true/false):
- true — ответ относится к заданному вопросу, даже если содержит дополнительную информацию
- false — ответ явно не относится к вопросу или пользователь задает встречный вопрос вместо ответа

### deviation (описание отклонения):
- Если onTopic === false, опиши кратко, в чем отклонение
- Если onTopic === true, оставь пустым

### shouldRedirect (true/false):
- true — нужно мягко вернуть пользователя к теме (если отклонение значительное)
- false — не нужно возвращать (ответ в теме или отклонение незначительное)

### importantInfo (массив строк):
- Извлеки важную информацию из ответа, которая может быть полезна для профиля
- Например: упоминание удаленной работы, конкретных навыков, предпочтений по зарплате
- Если важной информации нет — пустой массив

## Примеры:

Вопрос: "Какую должность вы ищете?"
Ответ: "Product Manager" → onTopic: true, shouldRedirect: false
Ответ: "А сколько платят?" → onTopic: false, deviation: "Пользователь задает встречный вопрос вместо ответа", shouldRedirect: true
Ответ: "Product Manager, кстати ищу удаленную работу" → onTopic: true, shouldRedirect: false, importantInfo: ["ищет удаленную работу"]

Вопрос: "Какой у вас опыт работы?"
Ответ: "5 лет" → onTopic: true, shouldRedirect: false
Ответ: "Расскажите про вашу компанию" → onTopic: false, deviation: "Пользователь спрашивает про компанию вместо ответа на вопрос", shouldRedirect: true
Ответ: "5 лет, работал в IT" → onTopic: true, shouldRedirect: false, importantInfo: ["работал в IT"]

Вопрос: "Перечислите навыки"
Ответ: "Python, SQL" → onTopic: true, shouldRedirect: false
Ответ: "А что вы предлагаете?" → onTopic: false, deviation: "Пользователь задает встречный вопрос", shouldRedirect: true
Ответ: "Python, SQL, кстати знаю Docker" → onTopic: true, shouldRedirect: false, importantInfo: ["знает Docker"]

## Важно:
- Будь терпимым: если ответ содержит и ответ на вопрос, и дополнительную информацию — это onTopic: true
- shouldRedirect только для явных отклонений, когда пользователь совсем не отвечает на вопрос
- Важная информация должна быть конкретной и полезной для профиля
- Не считай отклонением, если пользователь уточняет вопрос или просит пояснение

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "onTopic": true/false,
  "deviation": "описание отклонения (если есть)",
  "shouldRedirect": true/false,
  "importantInfo": ["важная информация 1", "важная информация 2"]
}`,
      ],
    });

    const userMessageText = buildUserMessage(`
Текущий вопрос:
ID шага: ${currentStep.id}
Тема вопроса: ${currentStep.label}
${currentStep.instruction ? `Инструкция: ${currentStep.instruction}` : ''}

История диалога (последние сообщения):
${historyText}

Ответ пользователя: "${userMessage}"

Проанализируй, остается ли ответ в теме вопроса.
Верни оценку в формате JSON.`);

    const aiResponse = await callYandexModel({
      sessionId: `context-check-${currentStep.id}`,
      userId: 'context-manager',
      messages: [systemPrompt, userMessageText],
      completionOptions: {
        temperature: 0.3, // Low temperature for more deterministic analysis
        maxTokens: 300,
      },
    });

    const contextCheck = parseContextCheckResponse(aiResponse.message.text);
    logger.info(
      `Context check for step ${currentStep.id}: onTopic=${contextCheck.onTopic}, shouldRedirect=${contextCheck.shouldRedirect}`
    );

    res.json({
      status: 'success',
      contextCheck,
    });
  } catch (error: unknown) {
    logger.error('Failed to check context:', error);

    // Fallback to on-topic on error
    res.json({
      status: 'success',
      contextCheck: {
        onTopic: true,
        deviation: '',
        shouldRedirect: false,
        importantInfo: [],
      },
    });
  }
}
