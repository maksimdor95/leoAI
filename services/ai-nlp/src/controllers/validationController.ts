/**
 * Validation Controller
 * Validates user answers using YandexGPT to detect unclear, irrelevant, or empty responses
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { buildSystemMessage, buildUserMessage } from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const validateAnswerSchema = z.object({
  question: z.string().min(1),
  answer: z.string(),
  collectedData: z.record(z.any()).optional(),
  stepId: z.string().min(1),
});

interface ValidationResult {
  quality: 'good' | 'unclear' | 'irrelevant';
  reason: string;
  suggestion?: string;
}

/**
 * Определяет тип вопроса по stepId для более точной валидации
 */
function getQuestionType(stepId: string): string {
  // Вопросы про готовность/согласие
  if (stepId === 'greeting' || stepId === 'privacy_info' || stepId === 'pause_reminder') {
    return 'подтверждение (ожидается "да"/"нет" или похожее)';
  }

  // Вопросы про должность/роль
  if (stepId === 'role') {
    return 'название должности (ожидается ЛЮБОЕ название должности - простое, специализированное, военное и т.д. ВСЕ названия должностей валидны: грузчик, водитель, продавец, военный, разработчик на ГО, менеджер и т.д.)';
  }

  // Вопросы про опыт
  if (stepId === 'experience' || stepId === 'junior_intro' || stepId === 'senior_deep_dive') {
    return 'опыт работы (ожидается период в годах или описание опыта)';
  }

  // Вопросы про локацию
  if (stepId === 'location') {
    return 'локация и переезд (ожидается город и готовность к переезду)';
  }

  // Вопросы про формат работы
  if (stepId === 'work_format') {
    return 'формат работы (ожидается: удалённо/офис/гибрид, полная/частичная занятость)';
  }

  // Вопросы про навыки
  if (stepId === 'skills' || stepId === 'skills_clarify' || stepId === 'skills_prioritize') {
    return 'навыки (ожидается список навыков через запятую)';
  }

  // Вопросы про отрасли
  if (stepId === 'industries') {
    return 'отрасли (ожидается название отрасли или список отраслей; допустимы короткие ответы: IT, банк, финансы, "любой", "не важно" и т.д.)';
  }

  // Вопросы про задачи
  if (stepId === 'tasks' || stepId === 'targetTasks') {
    return 'задачи и обязанности (ожидается описание задач, которые хочет решать)';
  }

  // Вопросы про зарплату
  if (stepId === 'salary' || stepId === 'salaryExpectation') {
    return 'зарплата (ожидается диапазон или "готов обсуждать")';
  }

  // Вопросы про культуру/ценности
  if (stepId === 'culture' || stepId === 'cultureFit') {
    return 'культура и ценности (ожидается описание того, что важно в компании)';
  }

  // Вопросы про образование
  if (stepId === 'education') {
    return 'образование (ожидается описание образования и курсов)';
  }

  // Вопросы про языки
  if (stepId === 'languages') {
    return 'языки (ожидается уровень владения языками)';
  }

  // Вопросы про дату старта
  if (stepId === 'start_date' || stepId === 'availability') {
    return 'дата начала работы (ожидается конкретная дата или "в ближайшее время")';
  }

  // Уточнение
  if (stepId === 'clarify') {
    return 'уточнение (пользователь должен уточнить предыдущий ответ)';
  }

  // Дополнительная информация
  if (stepId === 'additional' || stepId === 'additionalNotes') {
    return 'дополнительная информация (ответ необязателен, может быть пустым)';
  }

  return 'общий вопрос';
}

function parseValidationResponse(text: string): ValidationResult {
  try {
    // Try to parse JSON response
    const parsed = JSON.parse(text.trim());

    // Validate structure
    if (parsed.quality && ['good', 'unclear', 'irrelevant'].includes(parsed.quality)) {
      return {
        quality: parsed.quality as 'good' | 'unclear' | 'irrelevant',
        reason: parsed.reason || 'No reason provided',
        suggestion: parsed.suggestion,
      };
    }
  } catch (error) {
    // If JSON parsing fails, try to extract quality from text
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('good') ||
      lowerText.includes('хорош') ||
      lowerText.includes('релевант')
    ) {
      return {
        quality: 'good',
        reason: 'Ответ релевантен',
      };
    }
    if (
      lowerText.includes('unclear') ||
      lowerText.includes('неясн') ||
      lowerText.includes('непонят')
    ) {
      return {
        quality: 'unclear',
        reason: 'Ответ неясен',
        suggestion: 'Можете уточнить ваш ответ?',
      };
    }
    if (
      lowerText.includes('irrelevant') ||
      lowerText.includes('нерелевант') ||
      lowerText.includes('не относится')
    ) {
      return {
        quality: 'irrelevant',
        reason: 'Ответ не относится к вопросу',
        suggestion: 'Пожалуйста, ответьте на заданный вопрос',
      };
    }
  }

  // Default fallback
  return {
    quality: 'good',
    reason: 'Не удалось обработать результат валидации, предполагаем хороший ответ',
  };
}

export async function validateAnswer(req: Request, res: Response) {
  try {
    const parsed = validateAnswerSchema.parse(req.body);
    const { question, answer, collectedData, stepId } = parsed;

    // Check for empty or invalid answer
    const trimmedAnswer = answer?.trim() || '';

    if (trimmedAnswer.length === 0) {
      return res.json({
        status: 'success',
        validation: {
          quality: 'unclear' as const,
          reason: 'Ответ пустой',
          suggestion: 'Пожалуйста, дайте ответ на вопрос',
        },
      });
    }

    // Check for answers that are only punctuation, emojis, or whitespace
    const meaningfulContent = trimmedAnswer.replace(/[^\p{L}\p{N}]/gu, '');
    if (meaningfulContent.length === 0) {
      return res.json({
        status: 'success',
        validation: {
          quality: 'unclear' as const,
          reason: 'Ответ содержит только знаки препинания или эмодзи',
          suggestion: 'Пожалуйста, дайте текстовый ответ на вопрос',
        },
      });
    }

    // Check for extremely short answers that are likely unclear (less than 2 characters of meaningful content)
    // Exceptions:
    // 1. Answers like "да", "нет", "ok" are acceptable for confirmation questions
    // 2. Numeric answers (e.g., "4", "5", "10") are acceptable for experience questions
    // 3. Industry answers (e.g., "IT", "банк", "любой") are acceptable for industry questions
    const questionType = getQuestionType(stepId);
    const isConfirmationQuestion = questionType.includes('подтверждение');
    const isExperienceQuestion = questionType.includes('опыт работы');
    const isIndustryQuestion = questionType.includes('отрасли');

    // Check if answer is a valid number (for experience questions)
    const isNumericAnswer = /^\d+$/.test(meaningfulContent);

    // Common valid short industry answers
    const validIndustryAnswers = ['любой', 'любая', 'не важно', 'любая отрасль', 'все', 'неважно'];
    const lowerAnswer = meaningfulContent.toLowerCase();
    const isValidIndustryAnswer =
      isIndustryQuestion &&
      (validIndustryAnswers.includes(lowerAnswer) || meaningfulContent.length >= 2); // Industry names like "IT", "банк", "финансы", "В банке" are at least 2 chars

    if (
      !isConfirmationQuestion &&
      !(isExperienceQuestion && isNumericAnswer) &&
      !isValidIndustryAnswer &&
      meaningfulContent.length < 2
    ) {
      return res.json({
        status: 'success',
        validation: {
          quality: 'unclear' as const,
          reason: 'Ответ слишком короткий',
          suggestion: 'Пожалуйста, дайте более развернутый ответ',
        },
      });
    }

    const systemPrompt = buildSystemMessage({
      extraSections: [
        `# Роль: Валидатор ответов в HR-диалоге
Ты анализируешь ответы пользователя на вопросы в диалоге с HR-ассистентом LEO.
Твоя задача — определить качество ответа и помочь улучшить диалог.

## Критерии оценки:

### "good" — ответ хороший, если:
- Ответ релевантен заданному вопросу
- Ответ информативен и содержит полезную информацию
- Ответ соответствует ожидаемому формату (например, для вопроса про опыт — указан период в годах)
- Ответ не является односложным "да"/"нет" для открытых вопросов (кроме вопросов, где это уместно)

### "unclear" — ответ неясен, если:
- Ответ слишком короткий или неполный (например, "немного", "разное", "да" для открытых вопросов)
- Ответ неконкретный (например, "как-то так", "по-разному")
- Ответ содержит только междометия или неполные фразы
- Ответ не дает достаточно информации для продолжения диалога
- Ответ содержит только знаки препинания или эмодзи
- **ИСКЛЮЧЕНИЕ**: Для вопроса про должность ЛЮБОЕ название должности (даже если оно кажется "простым" или "неполным") является валидным и должно оцениваться как "good". Это включает: грузчик, водитель, продавец, военный, разработчик на ГО, менеджер, повар, учитель, врач и т.д. - ВСЕ названия должностей валидны.

### "irrelevant" — ответ нерелевантен, если:
- Ответ не относится к заданному вопросу вообще
- Пользователь задает встречный вопрос вместо ответа
- Ответ содержит только приветствие или прощание
- Ответ явно не по теме (например, на вопрос про должность отвечает про погоду)

## Примеры:

Вопрос: "Какую должность вы сейчас рассматриваете?"
- "Product Manager" → good
- "грузчик" → good (ЛЮБОЕ название должности валидно)
- "водитель автобуса" → good (ЛЮБОЕ название должности валидно)
- "менеджер" → good (ЛЮБОЕ название должности валидно)
- "военный" → good (ЛЮБОЕ название должности валидно)
- "продавец" → good (ЛЮБОЕ название должности валидно)
- "разработчик на ГО" → good (ЛЮБОЕ название должности, даже специализированное, валидно)
- "инженер-конструктор" → good (ЛЮБОЕ название должности валидно)
- "да" → irrelevant (не название должности)
- "А что вы предлагаете?" → irrelevant (встречный вопрос, не название должности)
- "" → unclear (пустой ответ)

Вопрос: "Какой у вас общий опыт работы в годах?"
- "5 лет" → good
- "5" → good (числовой ответ валиден для вопроса про опыт)
- "4" → good (числовой ответ валиден для вопроса про опыт)
- "10" → good (числовой ответ валиден для вопроса про опыт)
- "немного" → unclear
- "привет" → irrelevant
- "около 3-4 лет" → good

Вопрос: "Перечислите ключевые навыки через запятую"
- "Python, SQL, Docker" → good
- "навыки" → unclear
- "да" → irrelevant
- "умею работать" → unclear

Вопрос: "В какой отрасли вы работали или хотели бы работать?"
- "IT" → good (короткие ответы валидны)
- "финансы" → good (короткие ответы валидны)
- "банк" → good (короткие ответы валидны)
- "В банке" → good (короткие ответы валидны)
- "любой" → good (ответ "любой" означает готовность работать в любой отрасли - это валидный ответ)
- "IT, финансы, маркетинг" → good (список отраслей)
- "не важно" → good (эквивалентно "любой")
- "любая" → good (эквивалентно "любой")
- "да" → irrelevant (не название отрасли)
- "" → unclear (пустой ответ)

## Важно:
- Учитывай контекст диалога при оценке
- Для вопросов про готовность ("готовы начать?") односложные ответы допустимы
- **КРИТИЧЕСКИ ВАЖНО для вопросов про должность (role):** ЛЮБОЕ название должности, независимо от его длины, специфичности или формы, является ВАЛИДНЫМ ответом и должно оцениваться как "good". Это правило применяется ко ВСЕМ названиям должностей без исключений:
  * Простые названия: "грузчик", "водитель", "менеджер", "продавец", "повар" → good
  * Специализированные названия: "разработчик на ГО", "инженер-конструктор", "врач-терапевт" → good
  * Военные/специальные: "военный", "пожарный", "полицейский" → good
  * Любые другие названия должностей → good
  **НЕ требуй дополнительных уточнений для названий должностей - любое название достаточно.**
- **КРИТИЧЕСКИ ВАЖНО для вопросов про опыт работы (experience):** Числовые ответы (например, "4", "5", "10") являются ВАЛИДНЫМИ ответами и должны оцениваться как "good". Не требуй дополнительных уточнений для числовых ответов - любое число валидно.
- **КРИТИЧЕСКИ ВАЖНО для вопросов про отрасли (industries):** Короткие ответы с названием отрасли (например, "IT", "банк", "финансы", "маркетинг") являются ВАЛИДНЫМИ и должны оцениваться как "good". Ответы типа "любой", "любая", "не важно" также валидны и означают готовность работать в любой отрасли. НЕ требуй дополнительных уточнений для коротких названий отраслей.
- Будь строгим к нерелевантным ответам, но терпимым к неполным (они могут быть unclear)
- Suggestion должен быть на РУССКОМ языке, конкретным и помогать пользователю понять, что от него ожидается
- Все тексты в ответе (reason, suggestion) должны быть ТОЛЬКО на русском языке

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "quality": "good" | "unclear" | "irrelevant",
  "reason": "краткое объяснение на русском (1-2 предложения)",
  "suggestion": "конкретная подсказка на русском, что спросить для уточнения (только если quality !== 'good', должно быть конкретным и полезным)"
}`,
      ],
    });

    const contextText =
      collectedData && Object.keys(collectedData).length > 0
        ? `Контекст диалога (уже собранные данные):\n${JSON.stringify(collectedData, null, 2)}`
        : 'Контекст диалога отсутствует (это начало диалога).';

    // questionType уже определен выше (строка 186)

    const userMessage = buildUserMessage(`
Вопрос: "${question}"
ID шага: ${stepId}
Тип вопроса: ${questionType}
Ответ пользователя: "${trimmedAnswer}"
${contextText}

Проанализируй ответ пользователя на этот вопрос. Учитывай тип вопроса и контекст диалога.
Верни оценку качества в формате JSON.`);

    const aiResponse = await callYandexModel({
      sessionId: `validation-${stepId}`,
      userId: 'validator',
      messages: [systemPrompt, userMessage],
      completionOptions: {
        temperature: 0.3, // Low temperature for more deterministic responses
        maxTokens: 200,
      },
    });

    const validation = parseValidationResponse(aiResponse.message.text);
    logger.info(
      `Validation result for step ${stepId}: ${validation.quality} - ${validation.reason}`
    );

    res.json({
      status: 'success',
      validation,
    });
  } catch (error: unknown) {
    logger.error('Failed to validate answer:', error);

    // Fallback to good quality on error
    res.json({
      status: 'success',
      validation: {
        quality: 'good' as const,
        reason: 'Validation service error, assuming good quality',
      },
    });
  }
}
