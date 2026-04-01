/**
 * Profile Analysis Controller
 * Analyzes user profile completeness using YandexGPT to detect missing fields, contradictions, and readiness for matching
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { buildSystemMessage, buildUserMessage } from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';

const analyzeProfileSchema = z.object({
  collectedData: z.record(z.any()).optional(),
  completedSteps: z.array(z.string()).optional(),
  currentStepId: z.string().min(1),
});

interface ProfileAnalysisResult {
  completeness: number; // 0.0 - 1.0
  hasGaps: boolean;
  criticalGaps: string[]; // Поля, которые критичны для matching
  missingFields: string[]; // Все отсутствующие поля
  contradictions: string[]; // Описания противоречий
  readyForMatching: boolean;
}

// ============================================
// КРИТИЧНЫЕ ПОЛЯ (обязательны для качественного профиля)
// ============================================
const CRITICAL_FIELDS = [
  'careerSummary',      // Обзор карьеры
  'totalExperience',    // Общий опыт
  'position_1_company', // Минимум одна позиция
  'position_1_role',
  'position_1_achievements',
  'education_main',     // Основное образование
  'desired_role',       // Желаемая должность (новый формат)
  'desiredRole',        // Желаемая должность (старый формат для совместимости)
] as const;

// ============================================
// ВАЖНЫЕ ПОЛЯ (желательны для полного профиля)
// ============================================
const IMPORTANT_FIELDS = [
  'skills_hard',        // Технические навыки
  'skills_languages',   // Языки
  'desired_salary',     // Ожидания по зарплате
  'desired_location',   // Локация и формат
  'skills',             // Навыки (старый формат)
  'salaryExpectation',  // Зарплата (старый формат)
  'location',           // Локация (старый формат)
  'workFormat',         // Формат работы (старый формат)
] as const;

// ============================================
// ПОЛЯ ПОЗИЦИЙ (для проверки полноты опыта)
// ============================================
const POSITION_FIELDS = [
  'company', 'role', 'industry', 'team', 'responsibilities', 'achievements', 'projects'
] as const;

// ============================================
// ВСЕ ПОЛЯ ПРОФИЛЯ
// ============================================
const ALL_PROFILE_FIELDS = [
  ...CRITICAL_FIELDS,
  ...IMPORTANT_FIELDS,
  'education_additional',
  'skills_soft',
  'desired_culture',
  'desired_start',
  'additional_info',
  // Legacy fields
  'industries',
  'targetTasks',
  'cultureFit',
  'education',
  'languages',
  'availability',
  'additionalNotes',
] as const;

/**
 * Проверяет полноту данных о позициях
 */
function checkPositionsCompleteness(collectedData: Record<string, unknown>): {
  positionsCount: number;
  filledPositions: number;
  positionGaps: string[];
} {
  const positionsCount = parseInt(String(collectedData.positionsCount || '0'), 10) || 0;
  let filledPositions = 0;
  const positionGaps: string[] = [];

  for (let i = 1; i <= Math.min(positionsCount, 5); i++) {
    const company = collectedData[`position_${i}_company`];
    const role = collectedData[`position_${i}_role`];
    const achievements = collectedData[`position_${i}_achievements`];

    if (company && role) {
      filledPositions++;
      // Проверяем критичные поля позиции
      if (!achievements) {
        positionGaps.push(`position_${i}_achievements`);
      }
    } else if (i <= positionsCount) {
      // Позиция должна быть заполнена, но её нет
      if (!company) positionGaps.push(`position_${i}_company`);
      if (!role) positionGaps.push(`position_${i}_role`);
    }
  }

  return { positionsCount, filledPositions, positionGaps };
}

function getFieldDisplayName(field: string): string {
  const fieldNames: Record<string, string> = {
    // Новые поля
    careerSummary: 'обзор карьеры',
    totalExperience: 'общий опыт работы',
    positionsCount: 'количество позиций',
    position_1_company: 'компания (позиция 1)',
    position_1_role: 'должность (позиция 1)',
    position_1_achievements: 'достижения (позиция 1)',
    position_2_company: 'компания (позиция 2)',
    position_2_role: 'должность (позиция 2)',
    position_2_achievements: 'достижения (позиция 2)',
    education_main: 'основное образование',
    education_additional: 'дополнительное образование',
    skills_hard: 'технические навыки',
    skills_soft: 'управленческие навыки',
    skills_languages: 'владение языками',
    desired_role: 'желаемая должность',
    desired_location: 'локация и формат работы',
    desired_salary: 'ожидания по зарплате',
    desired_culture: 'культура и ценности',
    desired_start: 'готовность к выходу',
    additional_info: 'дополнительная информация',
    // Legacy поля
    desiredRole: 'желаемая должность',
    location: 'локация',
    workFormat: 'формат работы',
    skills: 'навыки',
    salaryExpectation: 'ожидания по зарплате',
    industries: 'отрасли',
    targetTasks: 'целевые задачи',
    cultureFit: 'культура и ценности',
    education: 'образование',
    languages: 'языки',
    availability: 'дата начала работы',
  };
  return fieldNames[field] || field;
}

/**
 * Проверяет, является ли значение релевантным (не пустым и не нерелевантным)
 * Значения вроде "нерелевантно", "не знаю", "пропустить" считаются нерелевантными
 */
function isRelevantValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const strValue = String(value).trim().toLowerCase();

  // Пустые значения
  if (strValue.length === 0) {
    return false;
  }

  // Нерелевантные значения, которые означают, что поле фактически не заполнено
  const irrelevantPatterns = [
    /^нерелевантно/i,
    /^не\s+знаю/i,
    /^не\s+указано/i,
    /^пропустить/i,
    /^пропущу/i,
    /^не\s+хочу/i,
    /^не\s+могу/i,
    /^не\s+важно/i,
    /^не\s+имеет\s+значения/i,
    /^не\s+указал/i,
    /^не\s+указала/i,
  ];

  // Проверяем, не является ли значение нерелевантным
  for (const pattern of irrelevantPatterns) {
    if (pattern.test(strValue)) {
      return false;
    }
  }

  return true;
}

function parseProfileAnalysisResponse(text: string): ProfileAnalysisResult {
  try {
    let jsonText = text.trim();

    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    // Handle multiple variations of code blocks
    const codeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m;
    const codeBlockMatch = jsonText.match(codeBlockRegex);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    // Try to find JSON object in the text (in case it's embedded in other text)
    // Look for JSON-like structure with required fields
    const jsonObjectRegex = /\{\s*"completeness"\s*:\s*[\d.]+[\s\S]*?"readyForMatching"\s*:\s*(?:true|false)\s*\}/;
    const jsonMatch = jsonText.match(jsonObjectRegex);
    if (jsonMatch && !jsonText.startsWith('{')) {
      jsonText = jsonMatch[0];
    }

    // Clean up common formatting issues
    jsonText = jsonText
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      .replace(/\n/g, ' ') // Remove newlines
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    // Try to parse JSON response
    const parsed = JSON.parse(jsonText);

    // Validate structure with more flexible checks
    const hasCompleteness = typeof parsed.completeness === 'number' || typeof parsed.completeness === 'string';
    const hasHasGaps = typeof parsed.hasGaps === 'boolean' || typeof parsed.hasGaps === 'string';
    const hasCriticalGaps = Array.isArray(parsed.criticalGaps) || typeof parsed.criticalGaps === 'string';
    const hasMissingFields = Array.isArray(parsed.missingFields) || typeof parsed.missingFields === 'string';
    const hasContradictions = Array.isArray(parsed.contradictions) || typeof parsed.contradictions === 'string';
    const hasReadyForMatching = typeof parsed.readyForMatching === 'boolean' || typeof parsed.readyForMatching === 'string';

    if (hasCompleteness && hasHasGaps && hasCriticalGaps && hasMissingFields && hasContradictions && hasReadyForMatching) {
      // Convert string values to appropriate types if needed
      const completeness = typeof parsed.completeness === 'string'
        ? parseFloat(parsed.completeness)
        : parsed.completeness;

      const hasGaps = typeof parsed.hasGaps === 'string'
        ? parsed.hasGaps.toLowerCase() === 'true'
        : parsed.hasGaps;

      const readyForMatching = typeof parsed.readyForMatching === 'string'
        ? parsed.readyForMatching.toLowerCase() === 'true'
        : parsed.readyForMatching;

      // Convert string arrays to actual arrays if needed
      const criticalGaps = typeof parsed.criticalGaps === 'string'
        ? parsed.criticalGaps.split(',').map((s: string) => s.trim()).filter(Boolean)
        : parsed.criticalGaps || [];

      const missingFields = typeof parsed.missingFields === 'string'
        ? parsed.missingFields.split(',').map((s: string) => s.trim()).filter(Boolean)
        : parsed.missingFields || [];

      const contradictions = typeof parsed.contradictions === 'string'
        ? parsed.contradictions.split(',').map((s: string) => s.trim()).filter(Boolean)
        : parsed.contradictions || [];

      return {
        completeness: Math.max(0, Math.min(1, completeness)),
        hasGaps,
        criticalGaps,
        missingFields,
        contradictions,
        readyForMatching,
      };
    }

    logger.warn('Profile analysis JSON structure validation failed');
    logger.warn(`   Parsed object keys: ${Object.keys(parsed).join(', ')}`);
    logger.warn(`   Expected: completeness, hasGaps, criticalGaps, missingFields, contradictions, readyForMatching`);

  } catch (error) {
    logger.error('Failed to parse profile analysis JSON:', error);
    logger.error(`   Original response text: ${text.substring(0, 500)}...`);

    // Try to extract partial information if JSON parsing failed
    try {
      // Look for key patterns in the text
      const completenessMatch = text.match(/"completeness"\s*:\s*([\d.]+)/);
      const hasGapsMatch = text.match(/"hasGaps"\s*:\s*(true|false)/i);
      const readyForMatchingMatch = text.match(/"readyForMatching"\s*:\s*(true|false)/i);

      if (completenessMatch || hasGapsMatch || readyForMatchingMatch) {
        logger.info('Attempting partial extraction from malformed JSON');

        return {
          completeness: completenessMatch ? parseFloat(completenessMatch[1]) : 0.5,
          hasGaps: hasGapsMatch ? hasGapsMatch[1].toLowerCase() === 'true' : true,
          criticalGaps: [],
          missingFields: [],
          contradictions: [],
          readyForMatching: readyForMatchingMatch ? readyForMatchingMatch[1].toLowerCase() === 'true' : false,
        };
      }
    } catch (partialError) {
      logger.error('Partial extraction also failed:', partialError);
    }
  }

  // Default fallback - assume profile is incomplete
  logger.warn('Using default fallback for profile analysis');
  return {
    completeness: 0.5,
    hasGaps: true,
    criticalGaps: [],
    missingFields: [],
    contradictions: [],
    readyForMatching: false,
  };
}

export async function analyzeProfile(req: Request, res: Response) {
  try {
    const parsed = analyzeProfileSchema.parse(req.body);
    const { collectedData = {}, completedSteps = [], currentStepId } = parsed;

    // Build context about collected fields (only relevant values)
    // Фильтруем нерелевантные значения (например, "нерелевантно", "не знаю")
    const collectedFields = Object.keys(collectedData).filter((key) =>
      isRelevantValue(collectedData[key])
    );

    // Создаем очищенную версию collectedData для анализа (без нерелевантных значений)
    const cleanedCollectedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(collectedData)) {
      if (isRelevantValue(value)) {
        cleanedCollectedData[key] = value;
      }
    }

    const missingCriticalFields = CRITICAL_FIELDS.filter(
      (field) => !collectedFields.includes(field)
    );
    const missingImportantFields = IMPORTANT_FIELDS.filter(
      (field) => !collectedFields.includes(field)
    );

    const systemPrompt = buildSystemMessage({
      extraSections: [
        `# Роль: Аналитик профиля кандидата
Ты анализируешь полноту профиля кандидата в диалоге с HR-ассистентом LEO.
Твоя задача — определить готовность профиля для подбора вакансий (matching).

## Критичные поля (обязательны для matching):
${CRITICAL_FIELDS.map((f) => `- ${f} (${getFieldDisplayName(f)})`).join('\n')}

## Важные поля (желательны, но не критичны):
${IMPORTANT_FIELDS.map((f) => `- ${f} (${getFieldDisplayName(f)})`).join('\n')}

## Критерии оценки:

### completeness (0.0 - 1.0):
- 1.0 — все критичные и важные поля заполнены
- 0.8-0.9 — все критичные поля заполнены, некоторые важные отсутствуют
- 0.5-0.7 — некоторые критичные поля отсутствуют
- 0.0-0.4 — большинство критичных полей отсутствуют

### hasGaps:
- true — если отсутствуют критичные или важные поля
- false — если все критичные поля заполнены

### criticalGaps:
- Массив названий полей (на английском, как в collectedData), которые критичны и отсутствуют
- Только поля из списка критичных полей

### missingFields:
- Массив всех отсутствующих полей (критичных и важных)

### contradictions:
- Массив описаний противоречий в данных (например: "Опыт работы менее 1 года, но указаны навыки для senior-позиций")
- Если противоречий нет — пустой массив

### readyForMatching:
- true — если все критичные поля заполнены и нет серьезных противоречий
- false — если отсутствуют критичные поля или есть серьезные противоречия

## Примеры противоречий:
- Опыт < 1 года, но указаны senior навыки
- Должность "junior", но опыт > 10 лет
- Локация "Москва", но формат работы "только удалённо" без уточнения
- Навыки не соответствуют указанной должности

## Важно:
- Будь строгим к критичным полям — без них matching невозможен
- Будь терпимым к важным полям — их можно заполнить позже
- Противоречия должны быть реальными, а не предположениями
- Учитывай контекст: если пользователь только начал диалог, пробелы нормальны

## Обработка нерелевантных значений:
- Если поле содержит нерелевантное значение (например, "нерелевантно", "не знаю", "пропустить"), считай это поле НЕ заполненным
- Нерелевантные значения означают, что пользователь не предоставил полезную информацию для этого поля
- Такие поля должны быть включены в criticalGaps или missingFields, если они критичны или важны

Верни ТОЛЬКО валидный JSON без дополнительного текста:
{
  "completeness": 0.0-1.0,
  "hasGaps": true/false,
  "criticalGaps": ["field1", "field2"],
  "missingFields": ["field1", "field2", "field3"],
  "contradictions": ["описание противоречия 1", "описание противоречия 2"],
  "readyForMatching": true/false
}`,
      ],
    });

    // Показываем как исходные данные, так и очищенные (для понимания контекста)
    const collectedDataText =
      Object.keys(collectedData).length > 0
        ? `Собранные данные (включая нерелевантные значения):\n${JSON.stringify(collectedData, null, 2)}\n\nОчищенные данные (только релевантные значения):\n${JSON.stringify(cleanedCollectedData, null, 2)}`
        : 'Собранные данные отсутствуют.';

    const completedStepsText =
      completedSteps.length > 0
        ? `Завершенные шаги: ${completedSteps.join(', ')}`
        : 'Завершенные шаги отсутствуют.';

    // Проверяем полноту позиций
    const positionsCheck = checkPositionsCompleteness(collectedData);

    const userMessage = buildUserMessage(`
Текущий шаг: ${currentStepId}
${completedStepsText}

${collectedDataText}

Собранные поля: ${collectedFields.join(', ') || 'нет'}
Отсутствующие критичные поля: ${missingCriticalFields.join(', ') || 'нет'}
Отсутствующие важные поля: ${missingImportantFields.join(', ') || 'нет'}

Позиции (опыт работы):
- Запланировано позиций: ${positionsCheck.positionsCount}
- Заполнено позиций: ${positionsCheck.filledPositions}
- Пробелы в позициях: ${positionsCheck.positionGaps.join(', ') || 'нет'}

Проанализируй полноту профиля и готовность к matching.
Учитывай, что для качественного профиля нужно минимум 1 заполненная позиция с достижениями.
Верни оценку в формате JSON.`);

    const aiResponse = await callYandexModel({
      sessionId: `profile-analysis-${currentStepId}`,
      userId: 'profile-analyst',
      messages: [systemPrompt, userMessage],
      completionOptions: {
        temperature: 0.2, // Low temperature for more deterministic analysis
        maxTokens: 500,
      },
    });

    const analysis = parseProfileAnalysisResponse(aiResponse.message.text);

    // Логируем детальную информацию для отладки
    logger.info(
      `Profile analysis for step ${currentStepId}: completeness=${analysis.completeness}, hasGaps=${analysis.hasGaps}, readyForMatching=${analysis.readyForMatching}`
    );
    if (analysis.criticalGaps.length > 0) {
      logger.info(`  Critical gaps detected: ${analysis.criticalGaps.join(', ')}`);
    }
    if (analysis.missingFields.length > 0) {
      logger.info(`  Missing fields: ${analysis.missingFields.join(', ')}`);
    }
    logger.info(`  Collected fields (relevant only): ${collectedFields.join(', ') || 'none'}`);
    logger.info(`  Missing critical fields: ${missingCriticalFields.join(', ') || 'none'}`);

    res.json({
      status: 'success',
      analysis,
    });
  } catch (error: unknown) {
    logger.error('Failed to analyze profile:', error);

    // Fallback to incomplete profile on error
    res.json({
      status: 'success',
      analysis: {
        completeness: 0.5,
        hasGaps: true,
        criticalGaps: [],
        missingFields: [],
        contradictions: [],
        readyForMatching: false,
      },
    });
  }
}
