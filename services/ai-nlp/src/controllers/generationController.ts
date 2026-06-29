import { Request, Response } from 'express';
import { z } from 'zod';
import { buildSystemMessage, buildUserMessage } from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';
import {
  buildProfileSummarySystemPrompt,
  buildProfileSummaryUserMessage,
  buildProfileTextForAnalysis,
  parseProfileSummaryResponse,
  type ProfileSummaryResult,
} from '../prompts/profileSummaryPrompt';

const freeChatSchema = z.object({
  message: z.string().min(1),
  collectedData: z.record(z.any()).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

const generateStepSchema = z.object({
  stepId: z.string().min(1),
  instruction: z.string().min(1),
  fallbackText: z.string().min(1),
  tone: z.enum(['default', 'friendly', 'formal']).optional(),
  facts: z.record(z.any()).optional(),
  locale: z.enum(['ru', 'en']).optional(),
});

const formatFacts = (facts: Record<string, unknown> | undefined): string => {
  if (!facts || Object.keys(facts).length === 0) {
    return 'Нет дополнительных фактов.';
  }

  const lines = Object.entries(facts).map(([key, value]) => {
    if (value === null || value === undefined) {
      return `- ${key}: (не указано)`;
    }

    if (Array.isArray(value)) {
      return `- ${key}: ${value.join(', ')}`;
    }

    if (typeof value === 'object') {
      return `- ${key}: ${JSON.stringify(value)}`;
    }

    return `- ${key}: ${String(value)}`;
  });

  return lines.join('\n');
};

export async function generateStepMessage(req: Request, res: Response) {
  try {
    const parsed = generateStepSchema.parse(req.body);

    const factsText = formatFacts(parsed.facts);
    const tone = parsed.tone ?? 'friendly';
    const isEnglish = parsed.locale === 'en';

    // Check if this is a clarify step and instruction contains context about previous step
    const isClarifyStep = parsed.stepId === 'clarify';
    const hasPreviousStepContext = parsed.instruction.includes('Предыдущий вопрос был про');

    let additionalInstructions = '';
    if (isClarifyStep && hasPreviousStepContext) {
      additionalInstructions = `\n\n⚠️ КРИТИЧЕСКИ ВАЖНО: Это шаг уточнения (clarify). Инструкция выше содержит информацию о предыдущем вопросе. Ты ДОЛЖЕН задать вопрос, который уточняет ответ именно на этот предыдущий вопрос, а НЕ задавать вопрос на совершенно другую тему. Если предыдущий вопрос был про опыт работы в годах, спрашивай про опыт. Если был про должность, спрашивай про должность. НЕ придумывай новые темы!`;
    }

    const messageParts = isEnglish
      ? [
          `Write one question or short prompt for the next step of a career chat scenario.`,
          `Step ID: ${parsed.stepId}`,
          `Step goal: ${parsed.instruction}`,
          `Known facts about the candidate:\n${factsText}`,
          `Requirements:`,
          `- use a ${tone === 'friendly' ? 'friendly' : tone === 'formal' ? 'formal' : 'neutral-friendly'} tone.`,
          `- output must be a single question or invitation, no lists or extra text.`,
          `- do not repeat earlier questions verbatim; rephrase if needed.`,
          `- do not introduce topics unrelated to the step goal.`,
          `- write in English only.`,
        ]
      : [
          `Сформулируй один вопрос или короткую фразу для следующего шага сценария чата.`,
          `ID шага: ${parsed.stepId}`,
          `Цель шага: ${parsed.instruction}`,
          `Известные факты о кандидате:\n${factsText}`,
          `Требования:`,
          `- используй тон ${tone === 'friendly' ? 'дружелюбный' : tone === 'formal' ? 'деловой' : 'нейтрально-дружелюбный'}.`,
          `- результат должен быть одним вопросом или обращением, без списков и без дополнительного текста.`,
          `- не повторяй ранее заданные вопросы дословно, перефразируй при необходимости.`,
          `- не добавляй новых тем, которые не связаны с целью шага.`,
        ];

    // Insert additional instructions after "Цель шага" if it's a clarify step
    if (additionalInstructions) {
      messageParts.splice(3, 0, additionalInstructions);
    }

    const userMessage = messageParts.join('\n');

    const messages = [
      buildSystemMessage({
        extraSections: [
          `# Формат ответа
- верни только текст вопроса или короткого приглашения, без пояснений и без списков;
- не добавляй извинений или служебных фраз.`,
        ],
      }),
      buildUserMessage(userMessage),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `step-${parsed.stepId}`,
      userId: 'system',
      messages,
    });

    const text = aiResponse.message.text.trim();
    logger.info(`Generated step text for ${parsed.stepId}: ${text}`);

    res.json({
      status: 'success',
      text: text.length > 0 ? text : parsed.fallbackText,
    });
  } catch (error: unknown) {
    logger.error('Failed to generate step message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate step message',
    });
  }
}

export async function freeChat(req: Request, res: Response) {
  try {
    const parsed = freeChatSchema.parse(req.body);

    // Format collected profile data
    const formatProfileData = (data: Record<string, unknown> | undefined): string => {
      if (!data || Object.keys(data).length === 0) {
        return 'Профиль пользователя пока не заполнен.';
      }

      const profileLines: string[] = [];
      const fieldNames: Record<string, string> = {
        desiredRole: 'Желаемая должность',
        totalExperience: 'Опыт работы',
        location: 'Локация',
        workFormat: 'Формат работы',
        skills: 'Навыки',
        industries: 'Отрасли',
        targetTasks: 'Целевые задачи',
        salaryExpectation: 'Ожидания по зарплате',
        seniorInfo: 'Дополнительная информация об опыте',
        juniorInfo: 'Информация для новичков',
      };

      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          const fieldName = fieldNames[key] || key;
          profileLines.push(`- ${fieldName}: ${String(value)}`);
        }
      });

      return profileLines.length > 0
        ? `Профиль пользователя:\n${profileLines.join('\n')}`
        : 'Профиль пользователя пока не заполнен.';
    };

    const profileText = formatProfileData(parsed.collectedData);

    // Format conversation history (last 5 messages for context)
    const recentHistory = parsed.conversationHistory
      ? parsed.conversationHistory
          .slice(-5)
          .map((msg) => `${msg.role === 'user' ? 'Пользователь' : 'LEO'}: ${msg.content}`)
          .join('\n')
      : '';

    const systemPrompt = `Ты LEO - AI-помощник по подбору вакансий. Ты помогаешь пользователям найти работу, отвечаешь на вопросы о карьере, даёшь советы по поиску работы и собеседованиям.

${profileText}

${recentHistory ? `\nКонтекст предыдущего общения:\n${recentHistory}` : ''}

Инструкции:
- Отвечай дружелюбно и профессионально
- Используй информацию из профиля пользователя для персонализации ответов
- Если вопрос не связан с карьерой или поиском работы, вежливо перенаправь разговор на эти темы
- Отвечай кратко, но информативно
- Не задавай вопросов, если пользователь не спрашивает
- Используй русский язык`;

    const messages = [
      buildSystemMessage({
        extraSections: [],
      }),
      buildUserMessage(systemPrompt),
      buildUserMessage(`Вопрос пользователя: ${parsed.message}`),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `free-chat-${Date.now()}`,
      userId: 'user',
      messages,
    });

    const text = aiResponse.message.text.trim();
    logger.info(`Free chat response generated`);

    res.json({
      status: 'success',
      text:
        text.length > 0
          ? text
          : 'Извините, не могу ответить на этот вопрос. Могу помочь с поиском работы или карьерными вопросами.',
    });
  } catch (error: unknown) {
    logger.error('Failed to generate free chat response:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate free chat response',
    });
  }
}

// ============================================
// ГЕНЕРАЦИЯ ПРОФЕССИОНАЛЬНОГО САММАРИ
// ============================================

const generateSummarySchema = z.object({
  collectedData: z.record(z.any()),
});

/**
 * Генерирует профессиональное саммари с экспертной оценкой профиля (RQG, 10 баллов)
 */
export async function generateProfileSummary(req: Request, res: Response) {
  try {
    const parsed = generateSummarySchema.parse(req.body);
    const { collectedData } = parsed;

    const profileText = buildProfileTextForAnalysis(collectedData);

    const systemPrompt = buildSystemMessage({
      extraSections: [buildProfileSummarySystemPrompt()],
    });

    const userMessage = buildUserMessage(buildProfileSummaryUserMessage(profileText));

    const messages = [systemPrompt, userMessage];

    const aiResponse = await callYandexModel({
      sessionId: `summary-generation-${Date.now()}`,
      userId: 'summary-generator',
      messages,
      completionOptions: {
        temperature: 0.3,
        maxTokens: 1500,
      },
    });

    const summary: ProfileSummaryResult = parseProfileSummaryResponse(aiResponse.message.text.trim());
    logger.info(
      `Generated profile summary (score ${summary.score}/10): ${summary.professionalSummary.substring(0, 100)}...`
    );

    res.json({
      status: 'success',
      summary,
    });
  } catch (error: unknown) {
    logger.error('Failed to generate profile summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate profile summary',
    });
  }
}

// ============================================
// ГЕНЕРАЦИЯ ПОЛНОГО РЕЗЮМЕ
// ============================================

const generateResumeSchema = z.object({
  collectedData: z.record(z.any()),
  format: z.enum(['text', 'markdown', 'json']).optional(),
});

/**
 * Генерирует полное резюме в текстовом формате
 */
export async function generateResume(req: Request, res: Response) {
  try {
    const parsed = generateResumeSchema.parse(req.body);
    const { collectedData, format = 'markdown' } = parsed;

    // Собираем все данные
    const careerOverview = collectedData.careerSummary || '';
    const totalExperience = collectedData.totalExperience || '';
    const positions = aggregatePositionsForSummary(collectedData);
    const skillsHard = collectedData.skills_hard || collectedData.skills || '';
    const skillsSoft = collectedData.skills_soft || '';
    const languages = collectedData.skills_languages || collectedData.languages || '';
    const educationMain = collectedData.education_main || collectedData.education || '';
    const educationAdditional = collectedData.education_additional || '';
    const desiredRole = collectedData.desired_role || collectedData.desiredRole || '';
    const desiredLocation = collectedData.desired_location || collectedData.location || '';
    const desiredSalary = collectedData.desired_salary || collectedData.salaryExpectation || '';

    const systemPrompt = buildSystemMessage({
      extraSections: [
        `# Роль: Генератор резюме

Ты создаёшь профессиональное резюме на основе собранных данных.

## Структура резюме (Markdown):

# [Имя кандидата или "Кандидат"]

## Саммари
[2-4 предложения о карьере]

## Опыт работы

### [Должность] | [Компания]
**Период:** [даты]
**Отрасль:** [отрасль]
**Команда:** [описание]

**Обязанности:**
- [обязанность 1]
- [обязанность 2]

**Достижения:**
- [достижение 1]
- [достижение 2]

**Ключевые проекты:**
- [проект и результат]

## Образование
- [ВУЗ, специальность, годы]
- [Курсы и сертификаты]

## Навыки
**Технические:** [список]
**Управленческие:** [список]
**Языки:** [список с уровнями]

## Предпочтения по поиску
- **Желаемая должность:** [...]
- **Локация:** [...]
- **Формат работы:** [...]
- **Ожидания по зарплате:** [...]

## Правила:
- Если данных нет, НЕ выдумывай
- Используй форматирование Markdown
- Делай акцент на достижениях
- Пиши профессионально`,
      ],
    });

    const userMessage = buildUserMessage(`
Сгенерируй резюме в формате ${format} на основе следующих данных:

Общий обзор карьеры: ${careerOverview || 'не указан'}
Общий опыт: ${totalExperience || 'не указан'}

Позиции:
${positions || 'не указаны'}

Образование: ${educationMain || 'не указано'}
Дополнительное образование: ${educationAdditional || 'не указано'}

Технические навыки: ${skillsHard || 'не указаны'}
Управленческие навыки: ${skillsSoft || 'не указаны'}
Языки: ${languages || 'не указаны'}

Желаемая должность: ${desiredRole || 'не указана'}
Локация: ${desiredLocation || 'не указана'}
Ожидания по зарплате: ${desiredSalary || 'не указаны'}`);

    const messages = [
      systemPrompt,
      userMessage,
    ];

    const aiResponse = await callYandexModel({
      sessionId: `resume-generation-${Date.now()}`,
      userId: 'resume-generator',
      messages,
      completionOptions: {
        temperature: 0.5,
        maxTokens: 2000,
      },
    });

    const resume = aiResponse.message.text.trim();
    logger.info(`Generated resume (${format} format)`);

    res.json({
      status: 'success',
      resume,
      format,
    });
  } catch (error: unknown) {
    logger.error('Failed to generate resume:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate resume',
    });
  }
}