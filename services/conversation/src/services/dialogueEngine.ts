import { v4 as uuidv4 } from 'uuid';
import { JACK_SCENARIO } from '../scenario/jackScenario';
import { WANNANEW_SCENARIO } from '../scenario/wannanewScenario';
import { INTERVIEW_PREP_SCENARIO } from '../scenario/interviewPrepScenario';
import {
  ScenarioDefinition,
  ScenarioQuestionStep,
  ScenarioStep,
  ScenarioInfoCardStep,
  ScenarioCommandStep,
  PreparedStepResult,
  ScenarioNext,
  ScenarioNextValue,
} from '../types/scenario';
import { ConversationSession, ConversationSessionMetadata, ProductType } from '../types/session';
import {
  Message,
  MessageRole,
  MessageType,
  QuestionMessage,
  InfoCardMessage,
  CommandMessage,
} from '../types/message';
import {
  generateStepQuestionText,
  validateAnswer,
  analyzeProfile,
  checkContext,
  generateFreeChatResponse,
  retrieveContext,
  extractVacancyProfile,
  generateInterviewPrepPlan,
  generateInterviewModeResponse,
  gradeInterviewAnswer,
  generateMockInterviewSummary,
  InterviewPrepMode,
  VacancyProfile,
  InterviewPrepPlanDay,
  ValidationResult,
} from './aiClient';
import {
  parsePositionsCountAnswer,
  parseTotalExperienceYearsFromText,
  resolveCollectValueForStep,
} from '../utils/numericStepAnswers';
import { logger } from '../utils/logger';
import { triggerProfileDrivenScrape } from './integrationService';

// ============================================
// РЕГИСТР СЦЕНАРИЕВ
// ============================================
const SCENARIOS: Record<string, ScenarioDefinition> = {
  'jack-profile-v2': JACK_SCENARIO,
  'wannanew-pm-v1': WANNANEW_SCENARIO,
  'interview-prep-v1': INTERVIEW_PREP_SCENARIO,
};

const DEFAULT_SCENARIO_ID = 'jack-profile-v2';

// Кэш шагов по сценариям: scenarioId:stepId -> ScenarioStep
const STEP_CACHE = new Map<string, ScenarioStep>();

// Инициализация кэша для всех сценариев
Object.entries(SCENARIOS).forEach(([scenarioId, scenario]) => {
  scenario.steps.forEach((step) => {
    STEP_CACHE.set(`${scenarioId}:${step.id}`, step);
  });
});

const STEP_FLAG_SENT_PREFIX = 'stepMessageSent:';
const COMPLETION_GAP_FIELDS_KEY = 'completionGapFields';
const CLARIFY_PREVIOUS_STEP_KEY = 'clarifyPreviousStep';
const CLARIFY_ATTEMPTS_KEY = 'clarifyAttempts';
const MAX_CLARIFY_ATTEMPTS = 2; // Максимальное количество попыток уточнения для одного вопроса
const RESUME_CONTENT_LIST_KEY = '__resumeContentList';

/**
 * Get scenario by ID, fallback to default (Jack)
 */
export function getScenario(scenarioId: string | undefined): ScenarioDefinition {
  if (scenarioId && SCENARIOS[scenarioId]) {
    return SCENARIOS[scenarioId];
  }
  return SCENARIOS[DEFAULT_SCENARIO_ID];
}

/**
 * Get scenario ID by product type
 */
export function getScenarioIdByProduct(product: ProductType | undefined): string {
  if (product === 'interview-prep') {
    return 'interview-prep-v1';
  }
  if (product === 'wannanew') {
    return 'wannanew-pm-v1';
  }
  return DEFAULT_SCENARIO_ID;
}

/**
 * Get step from scenario by scenarioId and stepId
 */
function getStep(scenarioId: string | undefined, stepId: string | undefined | null): ScenarioStep | undefined {
  if (!stepId) {
    return undefined;
  }
  const effectiveScenarioId = scenarioId || DEFAULT_SCENARIO_ID;
  return STEP_CACHE.get(`${effectiveScenarioId}:${stepId}`);
}

export function getStepSentFlagKey(stepId: string): string {
  return `${STEP_FLAG_SENT_PREFIX}${stepId}`;
}

function isCollectedFilledForImport(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return false;
}

function shouldSkipStepOnResumeImport(
  step: ScenarioStep,
  collected: Record<string, unknown>
): boolean {
  if (step.id === 'clarify' || step.id === 'completion_gap') {
    return true;
  }
  if (step.id === 'pause_reminder') {
    const r = collected.readyToStart;
    const s = typeof r === 'string' ? r.toLowerCase().trim() : '';
    const paused =
      s.includes('нет') || s.includes('позже') || s.includes('не готов');
    return !paused;
  }
  return false;
}

function recomputeCompletedQuestionSteps(
  scenario: ScenarioDefinition,
  collected: Record<string, unknown>
): string[] {
  const done: string[] = [];
  for (const step of scenario.steps) {
    if (
      step.type === 'question' &&
      step.collectKey &&
      isCollectedFilledForImport(collected[step.collectKey])
    ) {
      done.push(step.id);
    }
  }
  return done;
}

/**
 * Находит первый шаг сценария, который ещё нужно пройти после импорта данных из резюме.
 */
export function findFirstIncompleteStepIdAfterImport(
  scenario: ScenarioDefinition,
  collected: Record<string, unknown>,
  completedSteps: string[]
): string | null {
  const completed = new Set(completedSteps);
  for (const step of scenario.steps) {
    if (shouldSkipStepOnResumeImport(step, collected)) {
      continue;
    }
    if (step.type === 'question' && step.collectKey) {
      if (!isCollectedFilledForImport(collected[step.collectKey])) {
        return step.id;
      }
      continue;
    }
    if (step.type === 'info_card') {
      if (!completed.has(step.id)) {
        return step.id;
      }
      continue;
    }
    if (step.type === 'command' && !completed.has(step.id)) {
      return step.id;
    }
  }
  return null;
}

/**
 * Объединяет импортированные поля в collectedData, пересчитывает шаги и формирует следующее сообщение ассистента.
 */
export async function applyImportedCollectedData(
  session: ConversationSession,
  imported: Record<string, unknown>
): Promise<PreparedStepResult> {
  const scenarioUpdates = ensureScenarioMetadata(session);
  const scenarioId = session.metadata.scenarioId;
  const scenario = getScenario(scenarioId);

  session.metadata.collectedData = {
    ...session.metadata.collectedData,
    ...imported,
  };

  const fromData = recomputeCompletedQuestionSteps(scenario, session.metadata.collectedData);
  session.metadata.completedSteps = Array.from(
    new Set([...(session.metadata.completedSteps || []), ...fromData])
  );

  const nextStepId = findFirstIncompleteStepIdAfterImport(
    scenario,
    session.metadata.collectedData,
    session.metadata.completedSteps
  );

  if (!nextStepId) {
    return {
      message: null,
      metadataUpdates: {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
        completedSteps: session.metadata.completedSteps,
      },
    };
  }

  session.metadata.currentStepId = nextStepId;

  for (const step of scenario.steps) {
    if (step.id === nextStepId) {
      break;
    }
    session.metadata.flags = {
      ...session.metadata.flags,
      [getStepSentFlagKey(step.id)]: true,
    };
  }

  const nextStep = getStep(scenarioId, nextStepId);
  if (!nextStep) {
    return {
      message: null,
      metadataUpdates: {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
        completedSteps: session.metadata.completedSteps,
        currentStepId: nextStepId,
      },
    };
  }

  session.metadata.flags = {
    ...session.metadata.flags,
    [getStepSentFlagKey(nextStep.id)]: true,
  };

  if (nextStep.type === 'question') {
    const message = await buildQuestionMessage(session, nextStep);
    return {
      message,
      metadataUpdates: {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
        completedSteps: session.metadata.completedSteps,
        currentStepId: nextStepId,
        flags: { ...session.metadata.flags },
      },
      nextStepId,
    };
  }

  if (nextStep.type === 'info_card') {
    const message = buildInfoCardMessage(session, nextStep);
    return {
      message,
      metadataUpdates: {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
        completedSteps: session.metadata.completedSteps,
        currentStepId: nextStepId,
        flags: { ...session.metadata.flags },
      },
      nextStepId,
    };
  }

  if (nextStep.type === 'command') {
    const message = buildCommandMessage(session, nextStep);
    return {
      message,
      metadataUpdates: {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
        completedSteps: session.metadata.completedSteps,
        currentStepId: nextStepId,
        flags: { ...session.metadata.flags },
      },
      nextStepId,
    };
  }

  return {
    message: null,
    metadataUpdates: {
      ...scenarioUpdates,
      collectedData: session.metadata.collectedData,
      completedSteps: session.metadata.completedSteps,
      currentStepId: nextStepId,
    },
  };
}

/**
 * Evaluates a condition expression against collected data.
 * Supports simple comparisons: <, >, <=, >=, ===, !==
 * Examples:
 * - "experienceYears < 1"
 * - "skillsCount >= 3"
 * - "readyToStart === 'нет'"
 */
export function evaluateCondition(
  condition: string,
  collectedData: Record<string, unknown>
): boolean {
  try {
    // Extract numeric comparisons
    const numericMatch = condition.match(/^(\w+)\s*(<|>|<=|>=)\s*(\d+)$/);
    if (numericMatch) {
      const [, key, operator, value] = numericMatch;
      const dataValue = collectedData[key];
      if (typeof dataValue === 'string') {
        // Try to extract number from string (e.g., "2 года" -> 2)
        const numMatch = dataValue.match(/(\d+)/);
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          const target = parseInt(value, 10);
          switch (operator) {
            case '<':
              return num < target;
            case '>':
              return num > target;
            case '<=':
              return num <= target;
            case '>=':
              return num >= target;
          }
        }
      } else if (typeof dataValue === 'number') {
        const target = parseInt(value, 10);
        switch (operator) {
          case '<':
            return dataValue < target;
          case '>':
            return dataValue > target;
          case '<=':
            return dataValue <= target;
          case '>=':
            return dataValue >= target;
        }
      }
      return false;
    }

    // Extract equality comparisons
    const equalityMatch = condition.match(/^(\w+)\s*(===|!==)\s*(.+)$/);
    if (equalityMatch) {
      const [, key, operator, value] = equalityMatch;
      const dataValue = collectedData[key];
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      const stringDataValue = String(dataValue || '')
        .toLowerCase()
        .trim();
      const stringCleanValue = cleanValue.toLowerCase().trim();

      // For equality, prioritize exact match, then flexible matching for longer texts
      // Exact match first (important for short answers like "готов" vs "не готов")
      if (operator === '===') {
        // Exact match always wins
        if (stringDataValue === stringCleanValue) {
          return true;
        }

        // Flexible matching only for longer texts (more than 2 words)
        // Prevents false positives like "готов" matching "не готов"
        const dataWords = stringDataValue.split(/\s+/).filter((w) => w.length > 0);
        const cleanWords = stringCleanValue.split(/\s+/).filter((w) => w.length > 0);

        if (dataWords.length > 2 || cleanWords.length > 2) {
          // For longer texts, allow flexible matching
          return (
            stringDataValue.includes(stringCleanValue) || stringCleanValue.includes(stringDataValue)
          );
        }

        // For short texts (1-2 words), require exact match
        return false;
      } else if (operator === '!==') {
        // Exact mismatch
        if (stringDataValue !== stringCleanValue) {
          // For short texts, exact mismatch is enough
          const dataWords = stringDataValue.split(/\s+/).filter((w) => w.length > 0);
          const cleanWords = stringCleanValue.split(/\s+/).filter((w) => w.length > 0);

          if (dataWords.length <= 2 && cleanWords.length <= 2) {
            return true; // Short texts are different
          }

          // For longer texts, check if they don't contain each other
          return (
            !stringDataValue.includes(stringCleanValue) &&
            !stringCleanValue.includes(stringDataValue)
          );
        }
        return false;
      }
    }

    // Extract array length checks (e.g., "skillsCount < 3")
    const countMatch = condition.match(/^(\w+)Count\s*(<|>|<=|>=)\s*(\d+)$/);
    if (countMatch) {
      const [, key, operator, value] = countMatch;
      const dataValue = collectedData[key];
      let count = 0;
      if (Array.isArray(dataValue)) {
        count = dataValue.length;
      } else if (typeof dataValue === 'string') {
        // Count comma-separated items
        count = dataValue.split(',').filter((s) => s.trim().length > 0).length;
      }
      const target = parseInt(value, 10);
      switch (operator) {
        case '<':
          return count < target;
        case '>':
          return count > target;
        case '<=':
          return count <= target;
        case '>=':
          return count >= target;
      }
    }

    logger.warn(`Could not evaluate condition: ${condition}`);
    return false;
  } catch (error) {
    logger.error(`Error evaluating condition "${condition}":`, error);
    return false;
  }
}

/**
 * Resolves the next step ID based on the step's next configuration and collected data.
 */
export function resolveNextStep(
  next: ScenarioNextValue | undefined,
  collectedData: Record<string, unknown>
): string | null {
  if (next === null || next === undefined) {
    return null;
  }

  if (typeof next === 'string') {
    return next;
  }

  // Handle conditional next (ScenarioNext object)
  if (typeof next === 'object' && 'default' in next) {
    const nextConfig = next as ScenarioNext;

    // Check conditions in order
    if (nextConfig.when && Array.isArray(nextConfig.when)) {
      for (const condition of nextConfig.when) {
        if (evaluateCondition(condition.condition, collectedData)) {
          return condition.to;
        }
      }
    }

    // Return default if no conditions matched
    return nextConfig.default;
  }

  return null;
}

async function buildQuestionMessage(
  session: ConversationSession,
  step: ScenarioQuestionStep,
  previousStepId?: string,
  previousStepInstruction?: string
): Promise<QuestionMessage> {
  let questionText = step.fallbackText;

  // For clarify step, enhance instruction with previous step context
  let enhancedInstruction = step.instruction;
  if (step.id === 'clarify' && previousStepId && previousStepInstruction) {
    enhancedInstruction = `${step.instruction}\n\nВАЖНО: Предыдущий вопрос был про "${previousStepInstruction}". Нужно уточнить ответ именно на этот предыдущий вопрос, а не задавать новый вопрос на другую тему.`;
    logger.info(`🔧 Enhanced clarify instruction with previous step context: ${previousStepId}`);
  }

  try {
    logger.info(`🤖 Attempting to generate question text via AI for step: ${step.id}`);
    const generated = await generateStepQuestionText({
      stepId: step.id,
      instruction: enhancedInstruction,
      fallbackText: step.fallbackText,
      collectedData: session.metadata.collectedData,
    });

    if (generated && generated.trim().length > 0) {
      questionText = generated.trim();
      logger.info(`✅ AI-generated question text used for step: ${step.id}`);
      logger.info(`   Generated: "${questionText}"`);
    } else {
      logger.warn(`⚠️ AI returned empty text for step ${step.id}, using fallback`);
    }
  } catch (error: unknown) {
    logger.warn(`⚠️ Failed to generate question text for step ${step.id}, using fallback.`, error);
    logger.warn(`   Using fallback text: "${step.fallbackText}"`);
  }

  return {
    id: uuidv4(),
    type: MessageType.QUESTION,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    question: questionText,
    placeholder: step.placeholder,
  };
}

/**
 * Агрегирует данные о позициях из плоской структуры collectedData
 * Преобразует position_1_company, position_1_role и т.д. в массив объектов
 */
function aggregatePositions(collectedData: Record<string, unknown>): Array<{
  company: string;
  role: string;
  industry?: string;
  team?: string;
  responsibilities?: string;
  achievements?: string;
  projects?: string;
}> {
  const positions: Array<{
    company: string;
    role: string;
    industry?: string;
    team?: string;
    responsibilities?: string;
    achievements?: string;
    projects?: string;
  }> = [];

  for (let i = 1; i <= 5; i++) {
    const company = collectedData[`position_${i}_company`];
    const role = collectedData[`position_${i}_role`];
    
    if (company && role) {
      positions.push({
        company: String(company),
        role: String(role),
        industry: collectedData[`position_${i}_industry`] ? String(collectedData[`position_${i}_industry`]) : undefined,
        team: collectedData[`position_${i}_team`] ? String(collectedData[`position_${i}_team`]) : undefined,
        responsibilities: collectedData[`position_${i}_responsibilities`] ? String(collectedData[`position_${i}_responsibilities`]) : undefined,
        achievements: collectedData[`position_${i}_achievements`] ? String(collectedData[`position_${i}_achievements`]) : undefined,
        projects: collectedData[`position_${i}_projects`] ? String(collectedData[`position_${i}_projects`]) : undefined,
      });
    }
  }

  return positions;
}

function buildInfoCardMessage(
  session: ConversationSession,
  step: ScenarioInfoCardStep
): InfoCardMessage {
  // Special handling for profile_snapshot - dynamically build cards from collected data
  if (step.id === 'profile_snapshot') {
    const collectedData = session.metadata.collectedData;
    const cards: Array<{ title: string; content: string; icon?: string }> = [];

    // === САММАРИ И ОБЩИЙ ОПЫТ ===
    if (collectedData.careerSummary) {
      cards.push({
        title: '📋 Карьерный путь',
        content: String(collectedData.careerSummary),
      });
    }
    if (collectedData.totalExperience) {
      cards.push({
        title: '⏱️ Общий опыт',
        content: String(collectedData.totalExperience) + ' лет',
      });
    }

    // === ОПЫТ РАБОТЫ (ПОЗИЦИИ) ===
    const positions = aggregatePositions(collectedData);
    positions.forEach((pos, index) => {
      let content = `**${pos.role}**`;
      if (pos.industry) content += ` | ${pos.industry}`;
      if (pos.team) content += `\nКоманда: ${pos.team}`;
      if (pos.achievements) content += `\n✅ ${pos.achievements}`;
      
      cards.push({
        title: `💼 ${pos.company}`,
        content: content,
      });
    });

    // === ОБРАЗОВАНИЕ ===
    if (collectedData.education_main) {
      cards.push({
        title: '🎓 Образование',
        content: String(collectedData.education_main),
      });
    }
    if (collectedData.education_additional) {
      cards.push({
        title: '📚 Курсы и сертификаты',
        content: String(collectedData.education_additional),
      });
    }

    // === НАВЫКИ ===
    const skillsParts: string[] = [];
    if (collectedData.skills_hard) {
      skillsParts.push(`**Технические:** ${collectedData.skills_hard}`);
    }
    if (collectedData.skills_soft) {
      skillsParts.push(`**Управленческие:** ${collectedData.skills_soft}`);
    }
    if (skillsParts.length > 0) {
      cards.push({
        title: '🛠️ Навыки',
        content: skillsParts.join('\n'),
      });
    }
    if (collectedData.skills_languages) {
      cards.push({
        title: '🌍 Языки',
        content: String(collectedData.skills_languages),
      });
    }

    // === LEGACY: Обратная совместимость со старыми полями ===
    if (collectedData.desiredRole) {
      cards.push({
        title: 'Желаемая должность',
        content: String(collectedData.desiredRole),
      });
    }
    if (collectedData.location) {
      cards.push({
        title: 'Локация',
        content: String(collectedData.location),
      });
    }
    if (collectedData.workFormat) {
      cards.push({
        title: 'Формат работы',
        content: String(collectedData.workFormat),
      });
    }
    if (collectedData.skills && !collectedData.skills_hard) {
      cards.push({
        title: 'Навыки',
        content: String(collectedData.skills),
      });
    }
    if (collectedData.industries) {
      cards.push({
        title: 'Отрасли',
        content: String(collectedData.industries),
      });
    }
    if (collectedData.targetTasks) {
      cards.push({
        title: 'Задачи',
        content: String(collectedData.targetTasks),
      });
    }
    if (collectedData.salaryExpectation) {
      cards.push({
        title: 'Зарплата',
        content: String(collectedData.salaryExpectation),
      });
    }
    if (collectedData.cultureFit) {
      cards.push({
        title: 'Культура и ценности',
        content: String(collectedData.cultureFit),
      });
    }
    if (collectedData.education && !collectedData.education_main) {
      cards.push({
        title: 'Образование',
        content: String(collectedData.education),
      });
    }
    if (collectedData.languages && !collectedData.skills_languages) {
      cards.push({
        title: 'Языки',
        content: String(collectedData.languages),
      });
    }
    if (collectedData.availability) {
      cards.push({
        title: 'Готовность к работе',
        content: String(collectedData.availability),
      });
    }
    if (collectedData.additionalNotes || collectedData.additional_info) {
      cards.push({
        title: 'Дополнительно',
        content: String(collectedData.additionalNotes || collectedData.additional_info),
      });
    }

    return {
      id: uuidv4(),
      type: MessageType.INFO_CARD,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      title: step.title,
      description: step.description,
      cards:
        cards.length > 0 ? cards : [{ title: 'Профиль', content: 'Пока нет собранных данных' }],
    };
  }

  const msg: InfoCardMessage = {
    id: uuidv4(),
    type: MessageType.INFO_CARD,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    title: step.title,
    description: step.description,
    cards: step.cards,
  };
  if (step.commands && step.commands.length > 0) {
    msg.commands = step.commands;
  }
  return msg;
}

/**
 * После clarify: собрать ответ ассистента для следующего шага (question / info_card / command).
 * Совпадает с логикой основного потока после сохранения ответа на вопрос.
 */
async function prepareAssistantMessageForStepId(
  session: ConversationSession,
  scenarioId: string,
  nextStepId: string,
  baseMetadata: PreparedStepResult['metadataUpdates']
): Promise<PreparedStepResult> {
  const nextStep = getStep(scenarioId, nextStepId);
  if (!nextStep) {
    logger.error(`prepareAssistantMessageForStepId: step ${nextStepId} not found`);
    return {
      message: {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.ASSISTANT,
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        content: 'Понял, продолжаем дальше.',
      },
      metadataUpdates: { ...(baseMetadata || {}), currentStepId: nextStepId },
      nextStepId: null,
    };
  }

  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    ...(baseMetadata || {}),
    currentStepId: nextStepId,
  };
  session.metadata.currentStepId = nextStepId;

  if (nextStep.type === 'question') {
    const message = await buildQuestionMessage(session, nextStep);
    const sentFlagKey = getStepSentFlagKey(nextStep.id);
    metadataUpdates.flags = {
      ...(metadataUpdates.flags || {}),
      [sentFlagKey]: true,
    };
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [sentFlagKey]: true,
    };
    return { message, metadataUpdates, nextStepId };
  }

  if (nextStep.type === 'info_card') {
    const message = buildInfoCardMessage(session, nextStep);
    const sentFlagKey = getStepSentFlagKey(nextStep.id);
    metadataUpdates.flags = {
      ...(metadataUpdates.flags || {}),
      [sentFlagKey]: true,
    };
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [sentFlagKey]: true,
    };
    if (nextStep.id === 'profile_snapshot') {
      return { message, metadataUpdates };
    }
    const infoCardNextStepId = resolveNextStep(nextStep.next, session.metadata.collectedData);
    return {
      message,
      metadataUpdates,
      nextStepId: infoCardNextStepId ?? undefined,
    };
  }

  if (nextStep.type === 'command') {
    const message = buildCommandMessage(session, nextStep);
    const sentFlagKey = getStepSentFlagKey(nextStep.id);
    metadataUpdates.flags = {
      ...(metadataUpdates.flags || {}),
      [sentFlagKey]: true,
    };
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [sentFlagKey]: true,
    };
    return { message, metadataUpdates, nextStepId };
  }

  return {
    message: null,
    metadataUpdates,
    nextStepId: nextStepId ?? null,
  };
}

function buildCommandMessage(
  session: ConversationSession,
  step: ScenarioCommandStep
): CommandMessage {
  return {
    id: uuidv4(),
    type: MessageType.COMMAND,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    commands: step.commands,
  };
}

const INTERVIEW_MODE_LABELS: Record<InterviewPrepMode, string> = {
  diagnostics: 'Диагностика',
  theory: 'Теория',
  case: 'Кейс',
  mock: 'Мок-интервью',
  star: 'STAR / поведенческие вопросы',
  employer_questions: 'Вопросы работодателю',
};

function isInterviewPrepSession(session: ConversationSession): boolean {
  return session.metadata.product === 'interview-prep' || session.metadata.scenarioId === 'interview-prep-v1';
}

function isUrlOnlyVacancyInput(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) || /^www\.\S+$/i.test(trimmed);
}

function detectVacancySource(input: string): 'url' | 'text' | 'summary' {
  if (/https?:\/\/|www\./i.test(input)) return 'url';
  return input.trim().length > 500 ? 'text' : 'summary';
}

function normalizeInterviewMode(raw: string): InterviewPrepMode | null {
  const value = raw.toLowerCase().trim();
  if (value.includes('diagnostics') || value.includes('диагност')) return 'diagnostics';
  if (value.includes('theory') || value.includes('теор')) return 'theory';
  if (value.includes('case') || value.includes('кейс') || value.includes('задач')) return 'case';
  if (value.includes('mock') || value.includes('мок') || value.includes('интервью')) return 'mock';
  if (value.includes('star') || value.includes('поведен')) return 'star';
  if (value.includes('employer') || value.includes('работодател') || value.includes('вопрос')) {
    return 'employer_questions';
  }
  return null;
}

function compactList(items: string[] | undefined, fallback: string): string {
  if (!items || items.length === 0) return fallback;
  return items.slice(0, 5).join('\n');
}

function formatPrepPlan(plan: InterviewPrepPlanDay[]): string {
  if (!plan.length) return 'План уточним после короткой диагностики.';
  return plan
    .slice(0, 7)
    .map((day) => {
      const tasks = day.tasks.slice(0, 3).map((task) => `  - ${task}`).join('\n');
      return `День ${day.day}: ${day.focus}${tasks ? `\n${tasks}` : ''}`;
    })
    .join('\n\n');
}

function buildVacancyProfileCard(
  session: ConversationSession,
  profile: VacancyProfile,
  prepPlan: InterviewPrepPlanDay[]
): InfoCardMessage {
  const roleLine = [profile.role, profile.level].filter(Boolean).join(' / ') || 'роль требует уточнения';
  const locationLine = [profile.location, profile.format, profile.interviewLanguage]
    .filter(Boolean)
    .join(' / ') || 'не указано';
  const stackLine = [
    profile.domain,
    profile.stack && profile.stack.length > 0 ? profile.stack.join(', ') : undefined,
  ]
    .filter(Boolean)
    .join(' / ') || 'не указано';

  return {
    id: uuidv4(),
    type: MessageType.INFO_CARD,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    title: 'Профиль вакансии и план подготовки',
    description:
      'Я выделил ключевые ожидания по роли. Если где-то данных мало, считаю это предположением и буду уточнять в подготовке.',
    cards: [
      {
        title: 'Должность / уровень',
        content: roleLine,
      },
      {
        title: 'Локация / формат',
        content: locationLine,
      },
      {
        title: 'Стек и домен',
        content: stackLine,
      },
      {
        title: 'Ключевые ожидания',
        content: compactList(profile.requirements, 'Нет явных требований в тексте.'),
      },
      {
        title: 'Ответственность',
        content: compactList(profile.responsibilities, 'Ответственность описана недостаточно явно.'),
      },
      {
        title: 'Красные флаги / пробелы',
        content: compactList(profile.gaps, 'Явных пробелов не вижу, но уточним формат интервью.'),
      },
      {
        title: 'План подготовки',
        content: formatPrepPlan(prepPlan),
      },
    ],
    commands: [
      { id: 'diagnostics', label: 'Диагностика', action: 'interview_mode:diagnostics' },
      { id: 'theory', label: 'Теория', action: 'interview_mode:theory' },
      { id: 'case', label: 'Кейс', action: 'interview_mode:case' },
      { id: 'mock', label: 'Мок-интервью', action: 'interview_mode:mock' },
      { id: 'star', label: 'STAR', action: 'interview_mode:star' },
      {
        id: 'employer_questions',
        label: 'Вопросы работодателю',
        action: 'interview_mode:employer_questions',
      },
    ],
  };
}

function getInterviewConversationHistory(session: ConversationSession) {
  return (session.messages || [])
    .filter(
      (msg) =>
        (msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT) &&
        (msg.type === MessageType.TEXT || msg.type === MessageType.QUESTION)
    )
    .slice(-10)
    .map((msg) => ({
      role: msg.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
      content: 'content' in msg ? String(msg.content) : 'question' in msg ? String(msg.question) : '',
    }));
}

function buildInterviewTextMessage(session: ConversationSession, content: string): Message {
  return {
    id: uuidv4(),
    type: MessageType.TEXT,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    content,
  };
}

function buildInterviewQuestionMessage(
  session: ConversationSession,
  question: string,
  placeholder?: string
): QuestionMessage {
  return {
    id: uuidv4(),
    type: MessageType.QUESTION,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    question,
    placeholder:
      placeholder ??
      'Ответь развёрнуто: опирайся на опыт, назови шаги и метрики; отметь допущения, если данных не хватает.',
  };
}

async function buildInterviewModeMessage(
  session: ConversationSession,
  mode: InterviewPrepMode,
  userMessageContent: string,
  authToken?: string
): Promise<{ message: Message; metadataUpdates: PreparedStepResult['metadataUpdates'] }> {
  const collectedData = session.metadata.collectedData;
  const previousMode = collectedData.activeMode as InterviewPrepMode | undefined;
  const shouldGrade =
    previousMode === mode &&
    (mode === 'case' || mode === 'mock' || mode === 'star') &&
    userMessageContent.trim().length > 20;

  const grading = shouldGrade
    ? await gradeInterviewAnswer({
        mode,
        answer: userMessageContent,
        vacancyProfile: collectedData.vacancyProfile as VacancyProfile | undefined,
        collectedData,
        authToken,
      })
    : null;
  if (shouldGrade && mode === 'case') {
    logger.info(`event=case_answer_submitted sessionId=${session.id}`);
  }

  const response = await generateInterviewModeResponse({
    mode,
    userMessage: userMessageContent,
    vacancyProfile: collectedData.vacancyProfile as VacancyProfile | undefined,
    prepPlan: (collectedData.prepPlan as InterviewPrepPlanDay[] | undefined) ?? [],
    collectedData,
    conversationHistory: getInterviewConversationHistory(session),
    grading: grading ?? undefined,
    authToken,
  });

  const modeHistoryKey = `${mode}History`;
  const modeHistory = Array.isArray(collectedData[modeHistoryKey])
    ? (collectedData[modeHistoryKey] as unknown[])
    : [];
  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    collectedData: {
      activeMode: mode,
      lastInterviewGrade: grading ?? undefined,
      lastFollowUpToProbe: grading?.followUpToProbe,
      [modeHistoryKey]: [
        ...modeHistory.slice(-9),
        {
          at: new Date().toISOString(),
          userMessage: userMessageContent,
          grading: grading ?? undefined,
        },
      ],
    },
    currentStepId: 'mode_select',
  };

  if (mode === 'mock' && previousMode === mode && userMessageContent.trim().length > 20) {
    const mockAnswers = Array.isArray(collectedData.mockAnswers)
      ? (collectedData.mockAnswers as unknown[])
      : [];
    const nextMockAnswers = [
      ...mockAnswers,
      { answer: userMessageContent, grading: grading ?? undefined, at: new Date().toISOString() },
    ];
    metadataUpdates.collectedData = {
      ...metadataUpdates.collectedData,
      mockAnswers: nextMockAnswers,
      mockInterview: {
        currentQuestionIndex: nextMockAnswers.length + 1,
        answers: nextMockAnswers,
      },
    };

    if (nextMockAnswers.length >= 3) {
      const summary = await generateMockInterviewSummary({
        vacancyProfile: collectedData.vacancyProfile as VacancyProfile | undefined,
        answers: nextMockAnswers,
        authToken,
      });
      logger.info(`event=mock_interview_completed sessionId=${session.id}`);
      metadataUpdates.collectedData = {
        ...metadataUpdates.collectedData,
        mockSummary: summary,
      };
      return {
        message: buildInterviewTextMessage(
          session,
          `${response}\n\n## Итог мок-интервью\n\n${summary}\n\nМожем перейти к кейсам, теории или STAR-историям.`
        ),
        metadataUpdates,
      };
    }
  }

  if (mode === 'diagnostics') {
    return {
      message: buildInterviewQuestionMessage(session, response.trim()),
      metadataUpdates,
    };
  }

  return {
    message: buildInterviewTextMessage(session, response),
    metadataUpdates,
  };
}

async function handleInterviewPrepReply(
  session: ConversationSession,
  currentStep: ScenarioStep,
  userMessageContent: string,
  authToken?: string
): Promise<PreparedStepResult> {
  if (currentStep.id === 'vacancy_input') {
    if (isUrlOnlyVacancyInput(userMessageContent)) {
      logger.info(`event=interview_prep_started sessionId=${session.id} source=url_only`);
      return {
        message: buildInterviewTextMessage(
          session,
          'Вижу ссылку на вакансию. Я не буду выдумывать детали по одной ссылке: вставь, пожалуйста, текст вакансии или хотя бы ключевые требования. После этого соберу профиль роли и план подготовки.'
        ),
        metadataUpdates: {
          collectedData: {
            vacancySource: 'url',
            vacancyUrl: userMessageContent.trim(),
          },
          currentStepId: 'vacancy_input',
        },
        nextStepId: 'vacancy_input',
      };
    }

    logger.info(`event=interview_prep_started sessionId=${session.id} source=${detectVacancySource(userMessageContent)}`);
    const profile = await extractVacancyProfile({
      vacancyText: userMessageContent,
      source: detectVacancySource(userMessageContent),
      authToken,
    });
    logger.info(`event=vacancy_profile_extracted sessionId=${session.id} role=${profile.role ?? 'unknown'}`);
    const prepPlan = await generateInterviewPrepPlan({
      vacancyProfile: profile,
      availableDays: 5,
      authToken,
    });
    logger.info(`event=prep_plan_generated sessionId=${session.id} days=${prepPlan.length}`);

    return {
      message: buildVacancyProfileCard(session, profile, prepPlan),
      metadataUpdates: {
        collectedData: {
          vacancySource: detectVacancySource(userMessageContent),
          vacancyRawText: userMessageContent,
          vacancyProfile: profile,
          prepPlan,
        },
        completedSteps: ['vacancy_input'],
        currentStepId: 'mode_select',
      },
      nextStepId: 'mode_select',
    };
  }

  const explicitMode = normalizeInterviewMode(userMessageContent);
  const collectedMode = session.metadata.collectedData.activeMode as InterviewPrepMode | undefined;
  const mode = explicitMode ?? collectedMode;

  if (!mode) {
    return {
      message: buildInterviewTextMessage(
        session,
        'Выбери режим подготовки: Диагностика, Теория, Кейс, Мок-интервью, STAR или Вопросы работодателю. Можно нажать кнопку или написать режим текстом.'
      ),
      metadataUpdates: { currentStepId: 'mode_select' },
      nextStepId: 'mode_select',
    };
  }

  if (explicitMode) {
    logger.info(`event=mode_selected sessionId=${session.id} mode=${explicitMode}`);
  }
  const result = await buildInterviewModeMessage(session, mode, userMessageContent, authToken);
  return {
    message: result.message,
    metadataUpdates: result.metadataUpdates,
    nextStepId: 'mode_select',
  };
}

/**
 * Get active scenario for session (for backward compatibility)
 */
export function getActiveScenario(session?: ConversationSession) {
  if (session?.metadata?.scenarioId) {
    return getScenario(session.metadata.scenarioId);
  }
  return getScenario(DEFAULT_SCENARIO_ID);
}

export function ensureScenarioMetadata(
  session: ConversationSession
): Partial<ConversationSessionMetadata> {
  const updates: Partial<ConversationSessionMetadata> = {};

  // Determine scenario based on product or existing scenarioId
  if (!session.metadata.scenarioId) {
    const scenarioId = getScenarioIdByProduct(session.metadata.product);
    session.metadata.scenarioId = scenarioId;
    updates.scenarioId = scenarioId;
  }
  
  // Ensure product is set for backward compatibility
  if (!session.metadata.product) {
    // Infer product from scenarioId
    if (session.metadata.scenarioId === 'wannanew-pm-v1') {
      session.metadata.product = 'wannanew';
      updates.product = 'wannanew';
    } else {
      session.metadata.product = 'jack';
      updates.product = 'jack';
    }
  }
  
  if (!Array.isArray(session.metadata.completedSteps)) {
    session.metadata.completedSteps = [];
    updates.completedSteps = [];
  }
  if (!session.metadata.flags) {
    session.metadata.flags = {};
    updates.flags = {};
  }
  
  // Set entry step based on actual scenario
  if (!session.metadata.currentStepId) {
    const scenario = getScenario(session.metadata.scenarioId);
    session.metadata.currentStepId = scenario.entryStepId;
    updates.currentStepId = scenario.entryStepId;
  }

  return updates;
}

export async function prepareEntryStep(session: ConversationSession): Promise<PreparedStepResult> {
  const scenarioUpdates = ensureScenarioMetadata(session);

  const scenarioId = session.metadata.scenarioId;
  const currentStep = getStep(scenarioId, session.metadata.currentStepId);
  if (!currentStep) {
    logger.error(
      `Scenario step ${session.metadata.currentStepId} not found in scenario ${scenarioId} for session ${session.id}`
    );
    return { message: null };
  }

  const sentFlagKey = getStepSentFlagKey(currentStep.id);
  if (session.metadata.flags[sentFlagKey]) {
    return { message: null };
  }

  if (currentStep.type === 'question') {
    const message = await buildQuestionMessage(session, currentStep);
    return {
      message,
      metadataUpdates: {
        ...scenarioUpdates,
        flags: { [sentFlagKey]: true },
      },
    };
  }

  if (currentStep.type === 'info_card') {
    const message = buildInfoCardMessage(session, currentStep);

    // Special handling for profile_snapshot: don't auto-advance, wait for user action
    if (currentStep.id === 'profile_snapshot') {
      return {
        message,
        // Don't set nextStepId - wait for user to click "Continue" button
        metadataUpdates: {
          ...scenarioUpdates,
          flags: { [sentFlagKey]: true },
        },
      };
    }

    // For other info_card steps, auto-advance (existing behavior)
    const nextStepId = resolveNextStep(currentStep.next, session.metadata.collectedData);
    return {
      message,
      nextStepId: nextStepId ?? undefined,
      metadataUpdates: {
        ...scenarioUpdates,
        flags: { [sentFlagKey]: true },
      },
    };
  }

  if (currentStep.type === 'command') {
    const message = buildCommandMessage(session, currentStep);
    return {
      message,
      metadataUpdates: {
        ...scenarioUpdates,
        flags: { [sentFlagKey]: true },
      },
    };
  }

  logger.warn(
    `Entry step ${(currentStep as { id: string; type: string }).id} has unsupported type ${(currentStep as { id: string; type: string }).type}`
  );
  return { message: null, metadataUpdates: scenarioUpdates };
}

export async function handleUserReply(
  session: ConversationSession,
  userMessageContent: string,
  authToken?: string
): Promise<PreparedStepResult> {
  const scenarioUpdates = ensureScenarioMetadata(session);
  const scenarioId = session.metadata.scenarioId;
  const currentStepId = session.metadata.currentStepId;
  if (!scenarioId || !currentStepId) {
    return { message: null, metadataUpdates: scenarioUpdates };
  }
  const currentStep = getStep(scenarioId, currentStepId);

  if (!currentStep) {
    logger.error(`Current step ${currentStepId} not found in scenario ${scenarioId} for session ${session.id}`);
    return { message: null, metadataUpdates: scenarioUpdates };
  }

  // Тренажёр по вакансии обрабатывается отдельным движком только на своих шагах
  // (ввод вакансии и выбор режима). Приветствие-развилка и ветка пробного
  // собеседования идут через обычную обработку сценария (collectKey + next).
  if (
    isInterviewPrepSession(session) &&
    (currentStep.id === 'vacancy_input' || currentStep.id === 'mode_select')
  ) {
    return handleInterviewPrepReply(session, currentStep, userMessageContent, authToken);
  }

  // Check for profile command (only for Jack scenario): "покажи мой профиль", "мой профиль", "профиль", "покажи профиль"
  const profileCommands = [
    'покажи мой профиль',
    'мой профиль',
    'профиль',
    'покажи профиль',
    'показать профиль',
    'показать мой профиль',
  ];
  const normalizedMessage = userMessageContent.toLowerCase().trim();
  const isProfileCommand = profileCommands.some(
    (cmd) =>
      normalizedMessage === cmd.toLowerCase() || normalizedMessage.includes(cmd.toLowerCase())
  );

  // Profile command only works for Jack scenario
  if (isProfileCommand && session.metadata.product !== 'wannanew') {
    // Generate profile snapshot info card
    const profileSnapshotStep = getStep(scenarioId, 'profile_snapshot');
    if (profileSnapshotStep && profileSnapshotStep.type === 'info_card') {
      const message = buildInfoCardMessage(session, profileSnapshotStep);
      return {
        message,
        metadataUpdates: scenarioUpdates,
      };
    }
  }

  // Handle info_card step: check if user wants to continue
  if (currentStep.type === 'info_card') {
    // Special handling for profile_snapshot: wait for user action (button click or "продолжить")
    if (currentStep.id === 'profile_snapshot') {
      // Check if user sent a continue command
      const continueCommands = ['продолжить', 'продолжи', 'далее', 'дальше', 'next', 'continue'];
      const isContinueCommand = continueCommands.some(
        (cmd) => userMessageContent.toLowerCase().trim() === cmd.toLowerCase()
      );

      if (isContinueCommand) {
        logger.info(`✅ User clicked continue on profile_snapshot, advancing to next step`);
        // User wants to continue - advance to next step
        const nextStepId = resolveNextStep(currentStep.next, session.metadata.collectedData);
        logger.info(`📍 Next step after profile_snapshot: ${nextStepId}`);
        if (nextStepId) {
          const nextStep = getStep(scenarioId, nextStepId);
          if (nextStep) {
            session.metadata.currentStepId = nextStepId;

            if (nextStep.type === 'question') {
              const message = await buildQuestionMessage(session, nextStep);
              const sentFlagKey = getStepSentFlagKey(nextStep.id);
              return {
                message,
                metadataUpdates: {
                  ...scenarioUpdates,
                  currentStepId: nextStepId,
                  flags: {
                    ...(scenarioUpdates.flags || {}),
                    [sentFlagKey]: true,
                  },
                },
              };
            }
          }
        }
      } else {
        // User hasn't clicked continue yet - stay on profile_snapshot
        // Return null message to keep showing the info card
        return {
          message: null,
          metadataUpdates: scenarioUpdates,
        };
      }
    } else {
      // For other info_card steps, automatically advance (existing behavior)
      const nextStepId = resolveNextStep(currentStep.next, session.metadata.collectedData);
      if (nextStepId) {
        const nextStep = getStep(scenarioId, nextStepId);
        if (nextStep) {
          session.metadata.currentStepId = nextStepId;

          if (nextStep.type === 'question') {
            const message = await buildQuestionMessage(session, nextStep);
            const sentFlagKey = getStepSentFlagKey(nextStep.id);
            return {
              message,
              metadataUpdates: {
                ...scenarioUpdates,
                currentStepId: nextStepId,
                flags: {
                  ...(scenarioUpdates.flags || {}),
                  [sentFlagKey]: true,
                },
              },
            };
          }
        }
      }
      return {
        message: null,
        metadataUpdates: scenarioUpdates,
      };
    }
  }

  // Handle completion_gap step
  if (currentStep.id === 'completion_gap') {
    const gapFieldsJson = session.metadata.flags?.[COMPLETION_GAP_FIELDS_KEY] as string | undefined;
    const criticalGaps = gapFieldsJson ? (JSON.parse(gapFieldsJson) as string[]) : [];

    const userChoice = userMessageContent.toLowerCase().trim();
    const wantsToFill =
      userChoice.includes('заполнить') ||
      userChoice.includes('да') ||
      userChoice.includes('сейчас');

    if (wantsToFill && criticalGaps.length > 0) {
      // Map field names to step IDs
      const fieldToStepMap: Record<string, string> = {
        desiredRole: 'role',
        totalExperience: 'experience',
        location: 'location',
        workFormat: 'work_format',
        skills: 'skills',
      };

      // Find the first missing field's step
      const firstMissingField = criticalGaps[0];
      const targetStepId = fieldToStepMap[firstMissingField];

      if (targetStepId) {
        const targetStep = getStep(scenarioId, targetStepId);
        if (targetStep && targetStep.type === 'question') {
          // Remove this field from completed steps if it was there
          const updatedCompletedSteps = (session.metadata.completedSteps || []).filter(
            (step) => step !== targetStepId
          );

          const message = await buildQuestionMessage(session, targetStep);
          const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
            ...scenarioUpdates,
            currentStepId: targetStepId,
            completedSteps: updatedCompletedSteps,
            flags: {
              ...(scenarioUpdates.flags || {}),
              [COMPLETION_GAP_FIELDS_KEY]: undefined, // Clear the flag
            },
          };

          session.metadata.currentStepId = targetStepId;
          session.metadata.completedSteps = updatedCompletedSteps;
          session.metadata.flags = {
            ...(session.metadata.flags || {}),
            [COMPLETION_GAP_FIELDS_KEY]: undefined,
          };

          return {
            message,
            metadataUpdates,
            nextStepId: targetStepId,
          };
        }
      }
    }

    // User chose to continue without filling gaps - finish the dialogue
    return {
      message: null,
      metadataUpdates: {
        ...scenarioUpdates,
        flags: {
          ...(scenarioUpdates.flags || {}),
          [COMPLETION_GAP_FIELDS_KEY]: undefined,
        },
      },
      nextStepId: null,
    };
  }

  // Handle return from clarify step
  if (currentStep.id === 'clarify') {
    const previousStepId = session.metadata.flags?.[CLARIFY_PREVIOUS_STEP_KEY] as
      | string
      | undefined;

    if (previousStepId) {
      const previousStep = getStep(scenarioId, previousStepId);
      if (previousStep && previousStep.type === 'question') {
        // Get current clarify attempts count (stored as string in flags)
        const clarifyAttemptsKey = `${CLARIFY_ATTEMPTS_KEY}:${previousStepId}`;
        const currentAttemptsStr = session.metadata.flags?.[clarifyAttemptsKey] as
          | string
          | undefined;
        const currentAttempts = currentAttemptsStr ? parseInt(currentAttemptsStr, 10) || 0 : 0;
        const newAttempts = currentAttempts + 1;

        // Validate the clarified answer (числовые шаги — без LLM, см. IMPROVEMENT_PLAN P0.1)
        let validation: ValidationResult;
        if (previousStep.collectKey === 'positionsCount') {
          const n = parsePositionsCountAnswer(userMessageContent);
          if (n !== null) {
            validation = { quality: 'good', reason: 'positionsCount fast path (clarify)' };
          } else {
            validation = await validateAnswer({
              question: previousStep.label,
              answer: userMessageContent,
              collectedData: session.metadata.collectedData,
              stepId: previousStep.id,
            });
          }
        } else {
          validation = await validateAnswer({
            question: previousStep.label,
            answer: userMessageContent,
            collectedData: session.metadata.collectedData,
            stepId: previousStep.id,
          });
        }

        logger.info(
          `🔍 Clarify validation for step ${previousStepId}: quality=${validation.quality}, attempts=${newAttempts}/${MAX_CLARIFY_ATTEMPTS}`
        );

        // If still unclear, stay on clarify (but only if we haven't exceeded max attempts)
        if (
          (validation.quality === 'unclear' || validation.quality === 'irrelevant') &&
          newAttempts < MAX_CLARIFY_ATTEMPTS
        ) {
          logger.info(
            `⚠️ Answer still unclear, asking for clarification again (attempt ${newAttempts})`
          );
          const clarifyStep = getStep(scenarioId, 'clarify');
          if (clarifyStep && clarifyStep.type === 'question') {
            // Pass previous step context for clarify
            const clarifyMessage = await buildQuestionMessage(
              session,
              clarifyStep,
              previousStepId,
              previousStep?.instruction
            );
            // Modify question text with suggestion (only if suggestion exists and is in Russian)
            if (validation.suggestion && !validation.suggestion.match(/^[A-Za-z]/)) {
              // Only use suggestion if it starts with Cyrillic (not English)
              // Use suggestion as main text, add fallbackText only if suggestion doesn't end with punctuation
              const suggestion = validation.suggestion.trim();
              const hasPunctuation = /[.!?]$/.test(suggestion);
              if (hasPunctuation) {
                // Use suggestion as is, it's complete
                clarifyMessage.question = suggestion;
              } else {
                // Add fallbackText after suggestion with proper formatting
                clarifyMessage.question = `${suggestion}. ${clarifyStep.fallbackText}`;
              }
            } else if (validation.suggestion) {
              // If suggestion is in English, use only fallbackText
              logger.warn(
                `Validator returned English suggestion: "${validation.suggestion}", using only fallbackText`
              );
              clarifyMessage.question = clarifyStep.fallbackText;
            }

            return {
              message: clarifyMessage,
              metadataUpdates: {
                ...scenarioUpdates,
                currentStepId: 'clarify',
                flags: {
                  ...(scenarioUpdates.flags || {}),
                  [CLARIFY_PREVIOUS_STEP_KEY]: previousStepId,
                  [clarifyAttemptsKey]: String(newAttempts),
                },
              },
              nextStepId: 'clarify',
            };
          }
        }

        // If max attempts exceeded or answer is still unclear/irrelevant after max attempts,
        // save the answer as-is (even if it's "нерелевантно") and continue
        if (
          (validation.quality === 'unclear' || validation.quality === 'irrelevant') &&
          newAttempts >= MAX_CLARIFY_ATTEMPTS
        ) {
          logger.warn(
            `Max clarify attempts (${MAX_CLARIFY_ATTEMPTS}) exceeded for step ${previousStepId}. Saving answer as-is and continuing.`
          );
          // Save the answer as-is (even if it's not ideal) and continue
          if (previousStep.collectKey) {
            const collectValue = resolveCollectValueForStep(
              previousStep.collectKey,
              userMessageContent
            );
            const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
              ...scenarioUpdates,
              collectedData: {
                [previousStep.collectKey]: collectValue,
              },
              completedSteps: [previousStep.id],
              flags: {
                ...(scenarioUpdates.flags || {}),
                [CLARIFY_PREVIOUS_STEP_KEY]: undefined, // Clear the flag
                [clarifyAttemptsKey]: undefined, // Clear attempts counter
              },
            };
            session.metadata.collectedData = {
              ...session.metadata.collectedData,
              [previousStep.collectKey]: collectValue,
            };
            // Continue to next step (в т.ч. info_card «Интервью завершено», не только question)
            const nextStepId = resolveNextStep(previousStep.next, session.metadata.collectedData);
            if (nextStepId) {
              return prepareAssistantMessageForStepId(session, scenarioId, nextStepId, metadataUpdates);
            }
            // If no next step, return with completed step
            return {
              message: {
                id: uuidv4(),
                type: MessageType.TEXT,
                role: MessageRole.ASSISTANT,
                timestamp: new Date().toISOString(),
                sessionId: session.id,
                content: 'Понял, продолжаем дальше.',
              },
              metadataUpdates,
              nextStepId: null,
            };
          }
        }

        // Good answer - proceed with previous step
        // Save the answer and continue from previous step
        logger.info(
          `✅ Clarify successful! Saving answer to ${previousStep.collectKey} and continuing.`
        );
        if (previousStep.collectKey) {
          const collectValue = resolveCollectValueForStep(
            previousStep.collectKey,
            userMessageContent
          );
          logger.info(
            `💾 Saving clarified answer: ${previousStep.collectKey} = ${JSON.stringify(collectValue)}`
          );
          const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
            ...scenarioUpdates,
            collectedData: {
              [previousStep.collectKey]: collectValue,
            },
            completedSteps: [previousStep.id],
            flags: {
              ...(scenarioUpdates.flags || {}),
              [CLARIFY_PREVIOUS_STEP_KEY]: undefined, // Clear the flag
              [clarifyAttemptsKey]: undefined, // Clear attempts counter
            },
          };

          session.metadata.collectedData = {
            ...session.metadata.collectedData,
            [previousStep.collectKey]: collectValue,
          };

          // Resolve next step from previous step (в т.ч. report_ready info_card)
          const nextStepId = resolveNextStep(previousStep.next, session.metadata.collectedData);
          if (!nextStepId) {
            return {
              message: null,
              metadataUpdates,
              nextStepId: null,
            };
          }
          return prepareAssistantMessageForStepId(session, scenarioId, nextStepId, metadataUpdates);
        }
      }
    }
  }

  // Check context for non-clarify, non-completion-gap, non-pause, and non-choice steps.
  // 'greeting' is a scenario chooser (быстрый/детальный) — не прогоняем через context-redirect.
  if (
    currentStep.type === 'question' &&
    currentStep.id !== 'clarify' &&
    currentStep.id !== 'completion_gap' &&
    currentStep.id !== 'pause_reminder' &&
    currentStep.id !== 'greeting'
  ) {
    // Check if user is staying on topic
    const contextCheck = await checkContext({
      conversationHistory: [], // Minimal history - context manager can work with just current question
      currentStep: {
        id: currentStep.id,
        label: currentStep.label,
        instruction: currentStep.type === 'question' ? currentStep.instruction : undefined,
      },
      userMessage: userMessageContent,
    });

    // If user deviated significantly, save important info and prepare redirect hint
    if (contextCheck.shouldRedirect && !contextCheck.onTopic) {
      // Save important information if any
      if (contextCheck.importantInfo.length > 0) {
        // Try to extract and save important info (this is a simple implementation)
        // In future, could use more sophisticated extraction
        const importantInfoText = contextCheck.importantInfo.join('; ');
        logger.info(`Important info from deviation: ${importantInfoText}`);
        // Could save to a special field in collectedData for later processing
      }

      // Store redirect hint in flags to use when building next question
      session.metadata.flags = {
        ...(session.metadata.flags || {}),
        contextRedirectHint: contextCheck.deviation || 'Вернемся к вопросу',
      };

      // Continue to validation - but we'll add hint to next question
      // Don't block the flow, just prepare for redirect
    }
  }

  // Validate answer for non-clarify, non-completion-gap, and non-pause steps
  // pause_reminder doesn't need validation - "сейчас" or "позже" are both valid
  // greeting — это выбор сценария (быстрый/детальный), валидация не нужна и мешает ветвлению
  if (
    currentStep.type === 'question' &&
    currentStep.id !== 'clarify' &&
    currentStep.id !== 'completion_gap' &&
    currentStep.id !== 'pause_reminder' &&
    currentStep.id !== 'greeting'
  ) {
    let validation: ValidationResult;
    if (currentStep.collectKey === 'positionsCount') {
      const n = parsePositionsCountAnswer(userMessageContent);
      if (n !== null) {
        validation = { quality: 'good', reason: 'positionsCount fast path' };
      } else {
        validation = await validateAnswer({
          question: currentStep.label,
          answer: userMessageContent,
          collectedData: session.metadata.collectedData,
          stepId: currentStep.id,
        });
      }
    } else {
      validation = await validateAnswer({
        question: currentStep.label,
        answer: userMessageContent,
        collectedData: session.metadata.collectedData,
        stepId: currentStep.id,
      });
    }

    // If answer quality is poor, redirect to clarify
    if (validation.quality === 'unclear' || validation.quality === 'irrelevant') {
      const clarifyStep = getStep(scenarioId, 'clarify');
      if (clarifyStep && clarifyStep.type === 'question') {
        // Pass previous step context for clarify
        const clarifyMessage = await buildQuestionMessage(
          session,
          clarifyStep,
          currentStep.id,
          currentStep.instruction
        );
        // Use AI-generated question as primary (it's context-aware and better)
        // Use validator suggestion only if AI generation failed or suggestion is more specific
        const aiGeneratedQuestion = clarifyMessage.question;
        const useSuggestion =
          validation.suggestion &&
          !validation.suggestion.match(/^[A-Za-z]/) && // Russian only
          (!aiGeneratedQuestion || // AI generation failed
            aiGeneratedQuestion === clarifyStep.fallbackText || // AI returned fallback
            validation.suggestion.length > aiGeneratedQuestion.length * 0.8); // Suggestion is substantial

        if (useSuggestion && validation.suggestion) {
          const suggestion = validation.suggestion.trim();
          const hasPunctuation = /[.!?]$/.test(suggestion);
          if (hasPunctuation) {
            // Use suggestion as is, it's complete
            clarifyMessage.question = suggestion;
          } else {
            // Add fallbackText after suggestion with proper formatting
            clarifyMessage.question = `${suggestion}. ${clarifyStep.fallbackText}`;
          }
          logger.info(`Using validator suggestion for clarify: "${clarifyMessage.question}"`);
        } else if (validation.suggestion && validation.suggestion.match(/^[A-Za-z]/)) {
          // If suggestion is in English, use AI-generated question (or fallback)
          logger.warn(
            `Validator returned English suggestion: "${validation.suggestion}", using AI-generated question`
          );
        } else {
          // Use AI-generated question as is (it's better than suggestion)
          logger.info(`Using AI-generated question for clarify: "${clarifyMessage.question}"`);
        }

        // Store previous step ID to return later and initialize attempts counter
        const clarifyAttemptsKey = `${CLARIFY_ATTEMPTS_KEY}:${currentStep.id}`;
        const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
          ...scenarioUpdates,
          currentStepId: 'clarify',
          flags: {
            ...(scenarioUpdates.flags || {}),
            [CLARIFY_PREVIOUS_STEP_KEY]: currentStep.id,
            [clarifyAttemptsKey]: '0', // Initialize attempts counter as string
          },
        };

        session.metadata.currentStepId = 'clarify';
        session.metadata.flags = {
          ...(session.metadata.flags || {}),
          [CLARIFY_PREVIOUS_STEP_KEY]: currentStep.id,
          [clarifyAttemptsKey]: '0', // Initialize attempts counter as string
        };

        return {
          message: clarifyMessage,
          metadataUpdates,
          nextStepId: 'clarify',
        };
      }
    }
  }

  // Normal flow: save answer and proceed
  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    completedSteps: [currentStep.id],
    ...scenarioUpdates,
  };

  if (currentStep.type === 'question') {
    if (currentStep.collectKey) {
      const trimmedValue = userMessageContent.trim();
      const collectValue = resolveCollectValueForStep(currentStep.collectKey, userMessageContent);

      // Special handling for skills: merge additional skills with existing ones
      if (currentStep.collectKey === 'skillsAdditional' && session.metadata.collectedData.skills) {
        const existingSkills = Array.isArray(session.metadata.collectedData.skills)
          ? session.metadata.collectedData.skills
          : String(session.metadata.collectedData.skills)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
        const additionalSkills = trimmedValue
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const mergedSkills = [...existingSkills, ...additionalSkills];
        metadataUpdates.collectedData = {
          skills: mergedSkills,
          skillsAdditional: trimmedValue,
        };
        session.metadata.collectedData = {
          ...session.metadata.collectedData,
          skills: mergedSkills,
          skillsAdditional: trimmedValue,
        };
      } else {
        metadataUpdates.collectedData = {
          [currentStep.collectKey]: collectValue,
        };
        session.metadata.collectedData = {
          ...session.metadata.collectedData,
          [currentStep.collectKey]: collectValue,
        };
        logger.info(
          `Saved answer to ${currentStep.collectKey}: ${JSON.stringify(collectValue)}`
        );
      }

      // Когда пользователь сообщил желаемую должность, у нас впервые появляется
      // достаточно сигнала, чтобы scraper собрал релевантные вакансии.
      // Триггерим фоновый per-user скрейп — он не должен блокировать ответ ассистента.
      if (
        currentStep.collectKey === 'desired_role' &&
        session.userId &&
        authToken
      ) {
        triggerProfileDrivenScrape(session.userId, authToken).catch((err) => {
          logger.warn(`Profile-driven scrape trigger failed: ${String(err)}`);
        });
      }
    }
  }

  // Resolve next step using conditional logic
  let nextStepId: string | null = resolveNextStep(currentStep.next, session.metadata.collectedData);

  // Jack: если в ответе на «карьерный путь» уже есть «N лет», не дублировать шаг total_experience
  if (
    currentStep.type === 'question' &&
    currentStep.id === 'career_overview' &&
    session.metadata.collectedData.careerSummary !== undefined
  ) {
    const years = parseTotalExperienceYearsFromText(
      String(session.metadata.collectedData.careerSummary)
    );
    if (years !== null) {
      session.metadata.collectedData.totalExperience = years;
      metadataUpdates.collectedData = {
        ...(metadataUpdates.collectedData || {}),
        totalExperience: years,
      };
      const totalStep = getStep(scenarioId, 'total_experience');
      if (totalStep?.type === 'question' && totalStep.next !== undefined) {
        nextStepId = resolveNextStep(totalStep.next, session.metadata.collectedData);
      }
      metadataUpdates.completedSteps = Array.from(
        new Set([...(metadataUpdates.completedSteps || []), 'total_experience'])
      );
      logger.info(
        `📌 Parsed totalExperience=${years} from career_overview answer; skipping question total_experience, next=${nextStepId}`
      );
    }
  }

  logger.info(
    `Resolved next step for ${currentStep.id}: ${nextStepId} (collectedData: ${JSON.stringify(session.metadata.collectedData)})`
  );

  metadataUpdates.currentStepId = nextStepId ?? undefined;
  session.metadata.currentStepId = nextStepId ?? undefined;

  // Check profile completeness when reaching the end (additional step or no next step)
  if (!nextStepId || currentStep.id === 'additional') {
    logger.info(
      `🔍 Calling Profile Analyst for step: ${currentStep.id}, nextStepId: ${nextStepId}`
    );
    // Analyze profile completeness before finishing
    const profileAnalysis = await analyzeProfile({
      collectedData: session.metadata.collectedData,
      completedSteps: session.metadata.completedSteps || [],
      currentStepId: currentStep.id,
    });

    logger.info(
      `📊 Profile Analysis result: hasGaps=${profileAnalysis.hasGaps}, criticalGaps=${JSON.stringify(profileAnalysis.criticalGaps)}, completeness=${profileAnalysis.completeness}`
    );

    // If there are critical gaps, suggest filling them
    if (profileAnalysis.hasGaps && profileAnalysis.criticalGaps.length > 0) {
      logger.info(`✅ Critical gaps detected, transitioning to completion_gap`);
      const completionGapStep = getStep(scenarioId, 'completion_gap');
      if (completionGapStep && completionGapStep.type === 'question') {
        // Build list of missing fields in Russian
        const missingFieldsText = profileAnalysis.criticalGaps
          .map((field) => {
            const fieldNames: Record<string, string> = {
              desiredRole: 'желаемую должность',
              totalExperience: 'опыт работы',
              location: 'локацию',
              workFormat: 'формат работы',
              skills: 'навыки',
            };
            return fieldNames[field] || field;
          })
          .join(', ');

        const completionGapMessage = await buildQuestionMessage(session, completionGapStep);
        const contentList =
          typeof session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] === 'object' &&
          session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] !== null
            ? (session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] as {
                docId?: string;
                chunks: Array<{
                  chunkId: string;
                  type: 'text';
                  text: string;
                  page?: number;
                  section?: string;
                  tags?: string[];
                  confidence?: number;
                  lang?: 'ru' | 'en' | 'unknown';
                }>;
              })
            : undefined;
        const retrieval = await retrieveContext({
          sessionId: session.id,
          scenarioId,
          query: `Критичные пробелы профиля: ${missingFieldsText}`,
          topK: 3,
          collectedData: session.metadata.collectedData,
          contentList,
          authToken,
        });
        const retrievalHints = retrieval.items
          .slice(0, 2)
          .map((item) => item.text.replace(/^.+?:\s*/, '').slice(0, 140))
          .filter((v) => v.length > 0);
        // Modify question text to include missing fields
        completionGapMessage.question = `Я вижу, что мы не обсудили ${missingFieldsText}. Хотите заполнить их сейчас или продолжить как есть?${
          retrievalHints.length > 0
            ? `\n\nЧто уже вижу в вашем профиле:\n- ${retrievalHints.join('\n- ')}`
            : ''
        }`;

        const gapMetadataUpdates: PreparedStepResult['metadataUpdates'] = {
          ...metadataUpdates,
          currentStepId: 'completion_gap',
          flags: {
            ...(metadataUpdates.flags || {}),
            [COMPLETION_GAP_FIELDS_KEY]: JSON.stringify(profileAnalysis.criticalGaps),
          },
        };

        session.metadata.currentStepId = 'completion_gap';
        session.metadata.flags = {
          ...(session.metadata.flags || {}),
          [COMPLETION_GAP_FIELDS_KEY]: JSON.stringify(profileAnalysis.criticalGaps),
        };

        return {
          message: completionGapMessage,
          metadataUpdates: gapMetadataUpdates,
          nextStepId: 'completion_gap',
        };
      }
    }

    // Profile is complete or user chose to continue - enter free chat mode
    // Check if user message is not a profile command (already handled above)
    if (!isProfileCommand) {
      // Enter free chat mode
      const conversationHistory = (session.messages || [])
        .filter(
          (msg) =>
            msg.type === MessageType.TEXT &&
            (msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT)
        )
        .slice(-10) // Last 10 messages for context
        .map((msg) => ({
          role: msg.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
          content: 'content' in msg ? String(msg.content) : '',
        }));

      const contentList =
        typeof session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] === 'object' &&
        session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] !== null
          ? (session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] as {
              docId?: string;
              chunks: Array<{
                chunkId: string;
                type: 'text';
                text: string;
                page?: number;
                section?: string;
                tags?: string[];
                confidence?: number;
                lang?: 'ru' | 'en' | 'unknown';
              }>;
            })
          : undefined;
      const retrieval = await retrieveContext({
        sessionId: session.id,
        scenarioId,
        query: userMessageContent,
        topK: 3,
        collectedData: session.metadata.collectedData,
        contentList,
        authToken,
      });
      const contextText = retrieval.items.map((item) => `- ${item.text}`).join('\n');
      const enrichedMessage =
        contextText.length > 0
          ? `${userMessageContent}\n\nРелевантный контекст профиля:\n${contextText}`
          : userMessageContent;

      const freeChatResponse = await generateFreeChatResponse({
        message: enrichedMessage,
        collectedData: session.metadata.collectedData,
        authToken,
        conversationHistory,
      });

      const freeChatMessage: Message = {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.ASSISTANT,
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        content: freeChatResponse,
      };

      return {
        message: freeChatMessage,
        metadataUpdates: {
          ...metadataUpdates,
          currentStepId: undefined, // Keep as null/undefined for free chat
        },
        nextStepId: null,
      };
    }
  }

  // If nextStepId is null and we're not in additional step, enter free chat mode
  if (!nextStepId && currentStep.id !== 'additional') {
    // Check if user message is not a profile command (already handled above)
    if (!isProfileCommand) {
      const conversationHistory = (session.messages || [])
        .filter(
          (msg) =>
            msg.type === MessageType.TEXT &&
            (msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT)
        )
        .slice(-10)
        .map((msg) => ({
          role: msg.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
          content: 'content' in msg ? String(msg.content) : '',
        }));

      const contentList =
        typeof session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] === 'object' &&
        session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] !== null
          ? (session.metadata.collectedData[RESUME_CONTENT_LIST_KEY] as {
              docId?: string;
              chunks: Array<{
                chunkId: string;
                type: 'text';
                text: string;
                page?: number;
                section?: string;
                tags?: string[];
                confidence?: number;
                lang?: 'ru' | 'en' | 'unknown';
              }>;
            })
          : undefined;
      const retrieval = await retrieveContext({
        sessionId: session.id,
        scenarioId,
        query: userMessageContent,
        topK: 3,
        collectedData: session.metadata.collectedData,
        contentList,
        authToken,
      });
      const contextText = retrieval.items.map((item) => `- ${item.text}`).join('\n');
      const enrichedMessage =
        contextText.length > 0
          ? `${userMessageContent}\n\nРелевантный контекст профиля:\n${contextText}`
          : userMessageContent;

      const freeChatResponse = await generateFreeChatResponse({
        message: enrichedMessage,
        collectedData: session.metadata.collectedData,
        authToken,
        conversationHistory,
      });

      const freeChatMessage: Message = {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.ASSISTANT,
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        content: freeChatResponse,
      };

      return {
        message: freeChatMessage,
        metadataUpdates: {
          ...metadataUpdates,
          currentStepId: undefined,
        },
        nextStepId: null,
      };
    }
  }

  // Update completed steps
  if (metadataUpdates.completedSteps) {
    session.metadata.completedSteps = Array.from(
      new Set([...(session.metadata.completedSteps || []), ...metadataUpdates.completedSteps])
    );
  }

  // Build next step message if nextStepId exists
  if (!nextStepId) {
    // No next step - finish dialogue or enter free chat
    logger.info(`No next step after ${currentStep.id}, finishing dialogue`);
    return {
      message: null,
      metadataUpdates,
      nextStepId: null,
    };
  }

  const nextStep = getStep(scenarioId, nextStepId);
  if (!nextStep) {
    logger.error(`Next step ${nextStepId} not found in scenario ${scenarioId} for session ${session.id}`);
    return {
      message: null,
      metadataUpdates,
      nextStepId,
    };
  }

  logger.info(`Building message for next step: ${nextStepId} (type: ${nextStep.type})`);

  if (nextStep.type === 'question') {
    const message = await buildQuestionMessage(session, nextStep);

    // Check if we need to add redirect hint from context check
    const redirectHint = session.metadata.flags?.['contextRedirectHint'] as string | undefined;
    if (redirectHint) {
      // Add soft redirect hint to the question
      message.question = `${redirectHint}. ${message.question}`;
      // Clear the hint after using it
      metadataUpdates.flags = {
        ...(metadataUpdates.flags || {}),
        contextRedirectHint: undefined,
      };
      session.metadata.flags = {
        ...(session.metadata.flags || {}),
        contextRedirectHint: undefined,
      };
    }

    const sentFlagKey = getStepSentFlagKey(nextStep.id);
    metadataUpdates.flags = {
      ...(metadataUpdates.flags || {}),
      [sentFlagKey]: true,
    };
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [sentFlagKey]: true,
    };

    return {
      message,
      metadataUpdates,
      nextStepId,
    };
  }

  if (nextStep.type === 'info_card') {
    const message = buildInfoCardMessage(session, nextStep);
    const sentFlagKey = getStepSentFlagKey(nextStep.id);
    metadataUpdates.flags = {
      ...(metadataUpdates.flags || {}),
      [sentFlagKey]: true,
    };
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [sentFlagKey]: true,
    };

    // Special handling for profile_snapshot: don't auto-advance, wait for user action
    if (nextStep.id === 'profile_snapshot') {
      return {
        message,
        metadataUpdates,
        // Don't set nextStepId - wait for user to click "Continue" button
      };
    }

    // For other info_card steps, auto-advance (existing behavior)
    const infoCardNextStepId = resolveNextStep(nextStep.next, session.metadata.collectedData);
    return {
      message,
      metadataUpdates,
      nextStepId: infoCardNextStepId ?? undefined,
    };
  }

  if (nextStep.type === 'command') {
    const message = buildCommandMessage(session, nextStep);
    const sentFlagKey = getStepSentFlagKey(nextStep.id);
    metadataUpdates.flags = {
      ...(metadataUpdates.flags || {}),
      [sentFlagKey]: true,
    };
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [sentFlagKey]: true,
    };

    // For command steps, next step is determined by command selection
    // So we don't resolve it here, it will be handled by command handler
    return {
      message,
      metadataUpdates,
      nextStepId: nextStepId ?? undefined,
    };
  }

  logger.warn(
    `Step ${(nextStep as { id: string; type: string }).id} of type ${(nextStep as { id: string; type: string }).type} is not supported yet.`
  );
  return {
    message: null,
    metadataUpdates,
    nextStepId,
  };
}

/**
 * Handles command selection from user
 */
export async function handleCommand(
  session: ConversationSession,
  commandId: string,
  action: string,
  authToken?: string
): Promise<PreparedStepResult> {
  const scenarioUpdates = ensureScenarioMetadata(session);
  const { currentStepId, scenarioId } = session.metadata;
  const currentStep = getStep(scenarioId, currentStepId);

  logger.info(`Handling command: ${commandId} (action: ${action}) for step: ${currentStepId}`);

  if (isInterviewPrepSession(session) && action.startsWith('interview_mode:')) {
    const mode = normalizeInterviewMode(action.replace('interview_mode:', ''));
    if (mode) {
      const result = await buildInterviewModeMessage(
        session,
        mode,
        `Начать режим: ${INTERVIEW_MODE_LABELS[mode]}`,
        authToken
      );
      return {
        message: result.message,
        metadataUpdates: result.metadataUpdates,
        nextStepId: 'mode_select',
      };
    }
  }

  // Handle different command actions
  switch (action) {
    case 'repeat_question':
      // Repeat the current question
      if (currentStep && currentStep.type === 'question') {
        const message = await buildQuestionMessage(session, currentStep);
        return {
          message,
          metadataUpdates: scenarioUpdates,
          nextStepId: currentStepId ?? undefined,
        };
      }
      break;

    case 'edit_last_answer': {
      // Go back to previous step to edit answer
      const completedSteps = session.metadata.completedSteps || [];
      if (completedSteps.length > 0) {
        const previousStepId = completedSteps[completedSteps.length - 1];
        const previousStep = getStep(scenarioId, previousStepId);
        if (previousStep && previousStep.type === 'question') {
          // Remove from completed steps
          const updatedCompletedSteps = completedSteps.filter((id) => id !== previousStepId);
          // Remove collected data for that step
          const updatedCollectedData = { ...session.metadata.collectedData };
          if (previousStep.collectKey) {
            delete updatedCollectedData[previousStep.collectKey];
          }

          const message = await buildQuestionMessage(session, previousStep);
          const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
            ...scenarioUpdates,
            currentStepId: previousStepId,
            completedSteps: updatedCompletedSteps,
            collectedData: updatedCollectedData,
          };

          session.metadata.currentStepId = previousStepId;
          session.metadata.completedSteps = updatedCompletedSteps;
          session.metadata.collectedData = updatedCollectedData;

          return {
            message,
            metadataUpdates,
            nextStepId: previousStepId,
          };
        }
      }
      break;
    }

    case 'pause': {
      // Pause the dialogue
      const pauseMetadataUpdates: PreparedStepResult['metadataUpdates'] = {
        ...scenarioUpdates,
        flags: {
          ...(scenarioUpdates.flags || {}),
          paused: true,
        },
      };
      session.metadata.flags = {
        ...(session.metadata.flags || {}),
        paused: true,
      };

      const pauseMessage: Message = {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.ASSISTANT,
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        content: 'Я сохраняю всё. Вернёмся, когда будете готовы.',
      };

      return {
        message: pauseMessage,
        metadataUpdates: pauseMetadataUpdates,
        nextStepId: currentStepId ?? undefined,
      };
    }

    case 'resume': {
      // Resume the dialogue
      const resumeMetadataUpdates: PreparedStepResult['metadataUpdates'] = {
        ...scenarioUpdates,
        flags: {
          ...(scenarioUpdates.flags || {}),
          paused: false,
        },
      };
      session.metadata.flags = {
        ...(session.metadata.flags || {}),
        paused: false,
      };

      // Continue from current step
      if (currentStep && currentStep.type === 'question') {
        const message = await buildQuestionMessage(session, currentStep);
        return {
          message,
          metadataUpdates: resumeMetadataUpdates,
          nextStepId: currentStepId ?? undefined,
        };
      }
      break;
    }

    default:
      logger.warn(`Unknown command action: ${action}`);
  }

  // If command step has next defined, resolve it
  if (currentStep && currentStep.type === 'command') {
    const nextStepId = resolveNextStep(currentStep.next, session.metadata.collectedData);
    if (nextStepId) {
      const nextStep = getStep(scenarioId, nextStepId);
      if (nextStep) {
        if (nextStep.type === 'question') {
          const message = await buildQuestionMessage(session, nextStep);
          const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
            ...scenarioUpdates,
            currentStepId: nextStepId,
          };
          session.metadata.currentStepId = nextStepId;

          return {
            message,
            metadataUpdates,
            nextStepId,
          };
        }
      }
    }
  }

  return {
    message: null,
    metadataUpdates: scenarioUpdates,
    nextStepId: currentStepId ?? undefined,
  };
}
