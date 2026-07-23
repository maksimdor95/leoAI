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
import { getSessionUiLocale, resolveQuestionStepCopy } from '../utils/scenarioStepLocale';
import {
  buildMockBriefingMessage,
  getRescueAttemptLimit,
  getRescueCountKey,
  inferSeniorityFromLevel,
  isMockReadySignal,
  isModeStartCommand,
  isPrepReadySignal,
  LessonPhase,
  MockPhase,
  resolveCandidateSeniorityLevel,
  shouldEmitDiagnosticsPack,
  shouldTriggerFullRescue,
  shouldTriggerMicroRescue,
} from '../utils/interviewPrepProtocol';
import {
  buildMockGateBlockedMessage,
  buildReadinessChecklist,
  computePrepProgress,
  evaluateMockGate,
} from '../utils/prepActivities';
import {
  mergePrepArtifacts,
  packTitle,
  type PrepPackType,
} from '../utils/prepArtifacts';
import {
  normalizeVacancyPrepInput,
  stripHtmlFromText,
} from '../utils/vacancyPrepText';
import { enrichQuickPathCollectedData } from '../utils/quickPathEnrichment';
import {
  buildPrepRetentionState,
  buildPriorPrepSnapshot,
  buildReturningUserWelcome,
  buildStarBankEntryFromAnswer,
  extractStarEntriesFromCollected,
  getDiagnosticsPackMinAnswers,
  mergeStarBankEntries,
  type PrepRetentionState,
} from '../utils/prepRetention';
import { appendUserStarBankEntry, loadUserStarBank, saveUserStarBank } from './prepRetentionStore';
import { getUserSessions } from './sessionService';
import { logger } from '../utils/logger';
import { triggerProfileDrivenScrape } from './integrationService';
import { enrichAndPersistProfile } from './profileEnrichmentService';

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
  if (isResumePathMode(collected) && step.id === 'resume_upload') {
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

/** Путь «готовое резюме» в Jack-сценарии. */
export function isResumePathMode(collected: Record<string, unknown>): boolean {
  const mode = String(collected.scenarioMode || '')
    .toLowerCase()
    .trim();
  return mode === 'готовое резюме' || (mode.includes('резюме') && !mode.includes('детал'));
}

export function hasDesiredRoleInCollected(collected: Record<string, unknown>): boolean {
  const role = collected.desired_role ?? collected.desiredRole;
  return typeof role === 'string' && role.trim().length > 0;
}

export function hasResumeExtractedSignal(collected: Record<string, unknown>): boolean {
  if (hasDesiredRoleInCollected(collected)) return true;
  if (typeof collected.careerSummary === 'string' && collected.careerSummary.trim().length > 20) {
    return true;
  }
  for (let i = 1; i <= 3; i += 1) {
    const role = collected[`position_${i}_role`];
    if (typeof role === 'string' && role.trim()) return true;
  }
  const skills = collected.skills_hard ?? collected.skills;
  if (typeof skills === 'string' && skills.trim().length > 2) return true;
  if (Array.isArray(skills) && skills.length > 0) return true;
  return false;
}

/** Первый шаг уточнения при слабом матче на resume-path. */
export function pickResumeClarifyStepId(collected: Record<string, unknown>): string | null {
  if (!hasDesiredRoleInCollected(collected)) return 'quick_role';
  const exp = collected.totalExperience;
  const hasExp =
    (typeof exp === 'number' && exp > 0) ||
    (typeof exp === 'string' && exp.trim() !== '') ||
    (typeof collected.careerSummary === 'string' && collected.careerSummary.trim().length > 10);
  if (!hasExp) return 'quick_experience';
  const loc = collected.desired_location ?? collected.desiredLocation;
  if (typeof loc !== 'string' || !loc.trim()) return 'quick_location';
  return null;
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

const PROFILE_GAP_ALWAYS_SKIP = new Set([
  'greeting',
  'resume_upload',
  'pause_reminder',
  'privacy_info',
  'clarify',
  'completion_gap',
]);

function hasCareerNarrativeForGapSkip(collected: Record<string, unknown>): boolean {
  if (typeof collected.careerSummary === 'string' && collected.careerSummary.trim().length > 10) {
    return true;
  }
  return isCollectedFilledForImport(collected.position_1_role);
}

/** Шаги, которые не спрашиваем в режиме «Заполнить пробелы». */
export function shouldSkipStepForProfileGaps(
  step: ScenarioStep,
  collected: Record<string, unknown>
): boolean {
  if (shouldSkipStepOnResumeImport(step, collected)) return true;
  if (PROFILE_GAP_ALWAYS_SKIP.has(step.id)) return true;
  // После резюме с карьерным описанием не гоняем по блоку позиций заново
  if (hasCareerNarrativeForGapSkip(collected)) {
    if (step.id === 'positions_count' || step.id.startsWith('position_')) {
      return true;
    }
  }
  return false;
}

/**
 * Первый пустой вопрос профиля (без info_card / рестарта сценария).
 * Для кнопки «Заполнить пробелы» после resume_ready / quick_ready.
 */
export function findFirstProfileGapStepId(
  scenario: ScenarioDefinition,
  collected: Record<string, unknown>
): string | null {
  for (const step of scenario.steps) {
    if (step.type !== 'question' || !step.collectKey) continue;
    if (shouldSkipStepForProfileGaps(step, collected)) continue;
    if (!isCollectedFilledForImport(collected[step.collectKey])) {
      return step.id;
    }
  }
  return null;
}

const FILL_PROFILE_GAPS_FLAG = 'fillProfileGaps';

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

  if (isResumePathMode(session.metadata.collectedData)) {
    const effectiveScenarioId = scenarioId || DEFAULT_SCENARIO_ID;
    const enriched = enrichQuickPathCollectedData(
      session.metadata.collectedData as Record<string, unknown>
    );
    session.metadata.collectedData = enriched;
    const completed = Array.from(
      new Set([...(session.metadata.completedSteps || []), 'resume_upload'])
    );
    session.metadata.completedSteps = completed;

    if (!hasResumeExtractedSignal(enriched)) {
      session.metadata.collectedData = {
        ...enriched,
        scenarioMode: 'быстрый подбор',
      };
      logger.info('Resume import: insufficient extracted data, falling back to quick_role');
      return prepareAssistantMessageForStepId(session, effectiveScenarioId, 'quick_role', {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
        completedSteps: completed,
      });
    }

    if (!hasDesiredRoleInCollected(enriched)) {
      logger.info('Resume import: no desired_role in resume, asking via quick_role');
      return prepareAssistantMessageForStepId(session, effectiveScenarioId, 'quick_role', {
        ...scenarioUpdates,
        collectedData: enriched,
        completedSteps: completed,
      });
    }

    logger.info('Resume import: profile ready, advancing to resume_ready');
    return prepareAssistantMessageForStepId(session, effectiveScenarioId, 'resume_ready', {
      ...scenarioUpdates,
      collectedData: enriched,
      completedSteps: completed,
    });
  }

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
  const uiLocale = getSessionUiLocale(session.metadata);

  // For clarify step, enhance instruction with previous step context
  let enhancedInstruction = step.instruction;
  if (step.id === 'clarify' && previousStepId && previousStepInstruction) {
    enhancedInstruction =
      uiLocale === 'en'
        ? `${step.instruction}\n\nIMPORTANT: The previous question was about "${previousStepInstruction}". Clarify the answer to that question only — do not ask about a different topic.`
        : `${step.instruction}\n\nВАЖНО: Предыдущий вопрос был про "${previousStepInstruction}". Нужно уточнить ответ именно на этот предыдущий вопрос, а не задавать новый вопрос на другую тему.`;
    logger.info(`🔧 Enhanced clarify instruction with previous step context: ${previousStepId}`);
  }

  const localized = resolveQuestionStepCopy(session.metadata.scenarioId, step.id, uiLocale, {
    fallbackText: step.fallbackText,
    placeholder: step.placeholder,
    instruction: enhancedInstruction,
  });

  let questionText = localized.fallbackText;
  const useFallbackOnly = step.id === 'greeting';

  if (!useFallbackOnly) {
    try {
      logger.info(`🤖 Attempting to generate question text via AI for step: ${step.id}`);
      const generated = await generateStepQuestionText({
        stepId: step.id,
        instruction: localized.instruction,
        fallbackText: localized.fallbackText,
        collectedData: session.metadata.collectedData,
        locale: uiLocale,
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
      logger.warn(`   Using fallback text: "${localized.fallbackText}"`);
    }
  }

  return {
    id: uuidv4(),
    type: MessageType.QUESTION,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    question: questionText,
    placeholder: localized.placeholder ?? step.placeholder,
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
      description:
        `${step.description}\n\nПосле «Продолжить» LEO проанализирует профиль и обновит карьерный снимок.`,
      cards:
        cards.length > 0 ? cards : [{ title: 'Профиль', content: 'Пока нет собранных данных' }],
    };
  }

  if (step.id === 'quick_ready') {
    const collectedData = session.metadata.collectedData;
    const cards: Array<{ title: string; content: string; icon?: string }> = [];
    if (collectedData.desired_role) {
      cards.push({
        icon: '💼',
        title: 'Роль',
        content: String(collectedData.desired_role),
      });
    }
    if (collectedData.careerSummary) {
      cards.push({
        icon: '📋',
        title: 'Опыт',
        content: String(collectedData.careerSummary),
      });
    }
    if (collectedData.desired_location) {
      cards.push({
        icon: '📍',
        title: 'Локация и условия',
        content: String(collectedData.desired_location),
      });
    }

    const msg: InfoCardMessage = {
      id: uuidv4(),
      type: MessageType.INFO_CARD,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      title: step.title,
      description: step.description,
      cards:
        cards.length > 0
          ? cards
          : [{ title: 'Профиль', content: 'Данные быстрого подбора пока не сохранены' }],
    };
    if (step.commands && step.commands.length > 0) {
      msg.commands = step.commands;
    }
    return msg;
  }

  if (step.id === 'resume_ready') {
    const collectedData = session.metadata.collectedData;
    const cards: Array<{ title: string; content: string; icon?: string }> = [];
    if (collectedData.desired_role) {
      cards.push({
        icon: '💼',
        title: 'Роль',
        content: String(collectedData.desired_role),
      });
    }
    if (collectedData.careerSummary) {
      cards.push({
        icon: '📋',
        title: 'Опыт',
        content: String(collectedData.careerSummary),
      });
    }
    if (collectedData.skills_hard || collectedData.skills) {
      cards.push({
        icon: '🛠',
        title: 'Навыки',
        content: String(collectedData.skills_hard || collectedData.skills),
      });
    }
    if (collectedData.desired_location) {
      cards.push({
        icon: '📍',
        title: 'Локация и условия',
        content: String(collectedData.desired_location),
      });
    }

    const msg: InfoCardMessage = {
      id: uuidv4(),
      type: MessageType.INFO_CARD,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      title: step.title,
      description: step.description,
      cards:
        cards.length > 0
          ? cards
          : [{ title: 'Профиль', content: 'Данные из резюме пока не сохранены' }],
    };
    if (step.commands && step.commands.length > 0) {
      msg.commands = step.commands;
    }
    return msg;
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

export function wantsDetailedProfileAnalysis(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  if (normalized.includes('детализ') || normalized.includes('развернут')) {
    return true;
  }
  if (/перейти\s+(к\s+)?детальн/.test(normalized)) {
    return true;
  }
  if (/детальн\w*\s+анализ/.test(normalized)) {
    return true;
  }
  if (normalized.includes('полный') && (normalized.includes('профил') || normalized.includes('разбор'))) {
    return true;
  }
  return false;
}

async function buildFreeChatAssistantReply(
  session: ConversationSession,
  scenarioId: string,
  userMessageContent: string,
  metadataUpdates: PreparedStepResult['metadataUpdates'],
  authToken?: string
): Promise<PreparedStepResult> {
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

  return {
    message: {
      id: uuidv4(),
      type: MessageType.TEXT,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      content: freeChatResponse,
    },
    metadataUpdates,
    nextStepId: null,
  };
}

function buildQuickReadyDetailedAnalysisTransition(
  session: ConversationSession,
  scenarioUpdates: PreparedStepResult['metadataUpdates']
): PreparedStepResult['metadataUpdates'] {
  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    ...scenarioUpdates,
    collectedData: {
      scenarioMode: 'детализированный анализ',
    },
    completedSteps: ['quick_ready'],
  };
  session.metadata.collectedData = {
    ...session.metadata.collectedData,
    scenarioMode: 'детализированный анализ',
  };
  return metadataUpdates;
}

async function handleFillProfileGapsCommand(
  session: ConversationSession,
  scenarioId: string,
  scenarioUpdates: PreparedStepResult['metadataUpdates'],
  fallbackStepId: string | null | undefined
): Promise<PreparedStepResult> {
  const effectiveScenarioId = scenarioId || DEFAULT_SCENARIO_ID;
  const scenario = getScenario(effectiveScenarioId);
  const completed = Array.from(
    new Set([...(session.metadata.completedSteps || []), 'resume_ready', 'quick_ready'])
  );
  session.metadata.completedSteps = completed;

  const gapStepId = findFirstProfileGapStepId(scenario, session.metadata.collectedData);
  if (!gapStepId) {
    const stayOn = fallbackStepId || 'resume_ready';
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      [FILL_PROFILE_GAPS_FLAG]: false,
    };
    return {
      message: {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.ASSISTANT,
        timestamp: new Date().toISOString(),
        sessionId: session.id,
        content:
          'Ключевые поля профиля уже заполнены. Нажмите «Показать рекомендации», чтобы открыть подбор вакансий. Поправить данные можно во вкладке «Профиль».',
      },
      metadataUpdates: {
        ...scenarioUpdates,
        completedSteps: completed,
        currentStepId: stayOn,
        flags: {
          ...(scenarioUpdates?.flags || {}),
          [FILL_PROFILE_GAPS_FLAG]: false,
        },
      },
      nextStepId: stayOn,
    };
  }

  logger.info(`fill_profile_gaps: starting from ${gapStepId}`);
  session.metadata.flags = {
    ...(session.metadata.flags || {}),
    [FILL_PROFILE_GAPS_FLAG]: true,
  };
  return prepareAssistantMessageForStepId(session, effectiveScenarioId, gapStepId, {
    ...scenarioUpdates,
    completedSteps: completed,
    flags: {
      ...(scenarioUpdates?.flags || {}),
      ...(session.metadata.flags || {}),
      [FILL_PROFILE_GAPS_FLAG]: true,
    },
  });
}

async function handleResumeReadyReply(
  session: ConversationSession,
  scenarioId: string,
  userMessageContent: string,
  scenarioUpdates: PreparedStepResult['metadataUpdates']
): Promise<PreparedStepResult> {
  const lower = userMessageContent.toLowerCase();
  if (
    wantsDetailedProfileAnalysis(userMessageContent) ||
    lower.includes('пробел') ||
    lower.includes('заполнить')
  ) {
    return handleFillProfileGapsCommand(session, scenarioId, scenarioUpdates, 'resume_ready');
  }

  return {
    message: {
      id: uuidv4(),
      type: MessageType.TEXT,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      content:
        'Нажмите «Показать рекомендации», чтобы открыть подбор вакансий, или «Заполнить пробелы» — уточним только пустые поля. Поправить данные — вкладка «Профиль».',
    },
    metadataUpdates: scenarioUpdates,
    nextStepId: null,
  };
}

async function handleQuickReadyReply(
  session: ConversationSession,
  scenarioId: string,
  userMessageContent: string,
  scenarioUpdates: PreparedStepResult['metadataUpdates'],
  _authToken?: string
): Promise<PreparedStepResult> {
  if (wantsDetailedProfileAnalysis(userMessageContent)) {
    logger.info('User chose detailed analysis from quick_ready, advancing to career_overview');
    const metadataUpdates = buildQuickReadyDetailedAnalysisTransition(session, scenarioUpdates);
    return prepareAssistantMessageForStepId(session, scenarioId, 'career_overview', metadataUpdates);
  }

  return {
    message: {
      id: uuidv4(),
      type: MessageType.TEXT,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      content:
        'Используйте кнопки «Вакансии» или «Детальный анализ». Чтобы поправить данные — вкладка «Профиль».',
    },
    metadataUpdates: scenarioUpdates,
    nextStepId: null,
  };
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
      ...(metadataUpdates.flags || {}),
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
      ...(metadataUpdates.flags || {}),
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
      ...(metadataUpdates.flags || {}),
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

function parseInterviewModeToken(token: string): InterviewPrepMode | null {
  const normalized = token.trim().toLowerCase();
  const modes: InterviewPrepMode[] = [
    'diagnostics',
    'theory',
    'case',
    'mock',
    'star',
    'employer_questions',
  ];
  return modes.includes(normalized as InterviewPrepMode) ? (normalized as InterviewPrepMode) : null;
}

const INTERVIEW_MODE_COMMAND_MAX_LEN = 100;

function resolveInterviewModeLabel(label: string): InterviewPrepMode | null {
  const v = label.toLowerCase().trim();
  if (v.includes('диагност')) return 'diagnostics';
  if (v.includes('теор')) return 'theory';
  if (v.includes('кейс')) return 'case';
  if (v.includes('мок')) return 'mock';
  if (v.includes('star') || v.includes('поведен')) return 'star';
  if (v.includes('работодател')) return 'employer_questions';
  return null;
}

/** Распознать явную команду смены режима в коротком сообщении (не в развёрнутом ответе). */
export function detectInterviewModeCommandFromUserText(raw: string): InterviewPrepMode | null {
  const value = raw.trim();
  if (!value || value.length > INTERVIEW_MODE_COMMAND_MAX_LEN) {
    return null;
  }

  const startModeMatch = value.match(/^начать режим:\s*(.+)$/i);
  if (startModeMatch) {
    return resolveInterviewModeLabel(startModeMatch[1]);
  }

  if (/^(диагностика|diagnostics)$/i.test(value)) return 'diagnostics';
  if (/^(теория|theory)$/i.test(value)) return 'theory';
  if (/^(кейс|case)$/i.test(value)) return 'case';
  if (/^(мок-интервью|мок|mock)$/i.test(value)) return 'mock';
  if (/^(star|стар)$/i.test(value)) return 'star';
  if (/^(вопросы работодателю|employer_questions?)$/i.test(value)) {
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
  prepPlan: InterviewPrepPlanDay[],
  retentionWelcome?: string
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
    description: [
      retentionWelcome,
      'Маршрут из коротких шагов в чате (~3 ч). Начните с «Следующего шага» во вкладке «Подготовка» — LEO сам откроет нужный режим. Полный разбор вакансии — справочно, ниже.',
    ]
      .filter(Boolean)
      .join('\n\n'),
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
        planDays: prepPlan.slice(0, 7).map((day) => ({
          day: day.day,
          focus: day.focus,
          tasks: day.tasks.slice(0, 5),
        })),
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

const PREP_COMPLETE_CARD_TITLE = 'Подготовка завершена!';

function formatChecklistForCard(collected: Record<string, unknown>, prepPlan: InterviewPrepPlanDay[]): string {
  const progress = computePrepProgress(prepPlan, collected);
  const checklist = buildReadinessChecklist(collected, progress);
  return checklist.map((item) => `${item.done ? '✓' : '○'} ${item.label}`).join('\n');
}

function buildPrepCompleteCard(
  session: ConversationSession,
  profile: VacancyProfile | undefined,
  prepPlan: InterviewPrepPlanDay[],
  collectedData: Record<string, unknown>,
  mockSummary: string,
  debrief: string
): InfoCardMessage {
  const roleLine = [profile?.role, profile?.level].filter(Boolean).join(' · ') || 'Вакансия';
  const progress = computePrepProgress(prepPlan, {
    ...collectedData,
    mockPhase: 'complete',
    prepComplete: true,
  });

  return {
    id: uuidv4(),
    type: MessageType.INFO_CARD,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    title: PREP_COMPLETE_CARD_TITLE,
    packType: 'prep_complete',
    description:
      debrief.trim() ||
      'Мок-интервью завершено. Скачайте PDF-отчёт — это сжатая выжимка перед реальным собеседованием.',
    cards: [
      {
        title: '📊 Готовность',
        content: `${progress.overallPercent}% · ${roleLine}`,
        icon: '📊',
      },
      {
        title: '✓ Чеклист',
        content: formatChecklistForCard(
          { ...collectedData, mockPhase: 'complete' },
          prepPlan
        ),
        icon: '✓',
      },
      {
        title: '📝 Итог мока',
        content: mockSummary.slice(0, 1200) || 'Итог мок-интервью сохранён в отчёте.',
        icon: '📝',
      },
      {
        title: '📄 PDF-отчёт',
        content:
          'Полный отчёт: профиль вакансии, карта компетенций, STAR, пробелы и шпаргалки — без дампа чата.',
        icon: '📄',
      },
    ],
    commands: [
      { id: 'download_prep_report', label: 'Скачать PDF-отчёт', action: 'download_prep_report' },
      { id: 'new_vacancy', label: 'Новая вакансия', action: 'new_vacancy' },
    ],
  };
}

function getInterviewConversationHistory(session: ConversationSession, mode?: InterviewPrepMode) {
  const activeMode =
    mode ?? (session.metadata.collectedData.activeMode as InterviewPrepMode | undefined);

  return (session.messages || [])
    .filter(
      (msg) =>
        (msg.role === MessageRole.USER || msg.role === MessageRole.ASSISTANT) &&
        (msg.type === MessageType.TEXT || msg.type === MessageType.QUESTION)
    )
    .filter((msg) => !activeMode || msg.interviewMode === activeMode)
    .slice(-10)
    .map((msg) => ({
      role: msg.role === MessageRole.USER ? ('user' as const) : ('assistant' as const),
      content: 'content' in msg ? String(msg.content) : 'question' in msg ? String(msg.question) : '',
    }));
}

function mergeCollectedWithPrepProgress(
  collectedData: Record<string, unknown>,
  prepPlan: InterviewPrepPlanDay[] | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...collectedData, ...patch };
  if (prepPlan?.length) {
    merged.prepProgress = computePrepProgress(prepPlan, merged);
  }
  return merged;
}

function buildInterviewTextMessage(
  session: ConversationSession,
  content: string,
  interviewMode?: InterviewPrepMode,
  packType?: PrepPackType
): Message {
  return {
    id: uuidv4(),
    type: MessageType.TEXT,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId: session.id,
    content,
    ...(interviewMode ? { interviewMode } : {}),
    ...(packType ? { packType } : {}),
  };
}

function withPackArtifact(
  session: ConversationSession,
  content: string,
  mode: InterviewPrepMode,
  packType: PrepPackType,
  baseCollected: Record<string, unknown>,
  metadataPatch: Record<string, unknown>,
  prepPlan?: InterviewPrepPlanDay[]
): { message: Message; collectedData: Record<string, unknown> } {
  const message = buildInterviewTextMessage(session, content, mode, packType);
  let collectedData = mergePrepArtifacts(baseCollected, metadataPatch, {
    packType,
    mode,
    title: packTitle(packType, mode),
    content,
    messageId: message.id,
  });
  if (prepPlan?.length) {
    collectedData = mergeCollectedWithPrepProgress(baseCollected, prepPlan, collectedData);
  }
  return { message, collectedData };
}

function buildInterviewQuestionMessage(
  session: ConversationSession,
  question: string,
  placeholder?: string,
  interviewMode?: InterviewPrepMode
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
    ...(interviewMode ? { interviewMode } : {}),
  };
}

/** Помечает сообщение пользователя режимом подготовки (activeMode или явный выбор в тексте). */
export function tagUserMessageWithInterviewMode(
  session: ConversationSession,
  message: Message
): Message {
  if (!isInterviewPrepSession(session) || message.type !== MessageType.TEXT) {
    return message;
  }
  const activeMode = session.metadata.collectedData.activeMode as InterviewPrepMode | undefined;
  if (!activeMode) {
    return message;
  }
  return { ...message, interviewMode: activeMode };
}

export function parseInterviewModeFromAction(action: string): InterviewPrepMode | null {
  if (!action.startsWith('interview_mode:')) {
    return null;
  }
  return parseInterviewModeToken(action.replace('interview_mode:', ''));
}

async function buildInterviewModeMessage(
  session: ConversationSession,
  mode: InterviewPrepMode,
  userMessageContent: string,
  authToken?: string
): Promise<{ message: Message; metadataUpdates: PreparedStepResult['metadataUpdates'] }> {
  const collectedData = session.metadata.collectedData;
  const vacancyProfile = collectedData.vacancyProfile as VacancyProfile | undefined;
  const prepPlan = (collectedData.prepPlan as InterviewPrepPlanDay[] | undefined) ?? [];
  const previousMode = collectedData.activeMode as InterviewPrepMode | undefined;
  const conversationHistory = getInterviewConversationHistory(session, mode);

  const baseMetadata: PreparedStepResult['metadataUpdates'] = {
    collectedData: { activeMode: mode },
    currentStepId: 'mode_select',
  };

  if (mode === 'mock') {
    return buildMockModeMessage(
      session,
      userMessageContent,
      collectedData,
      vacancyProfile,
      prepPlan,
      previousMode,
      conversationHistory,
      authToken
    );
  }

  if (mode === 'theory') {
    return buildTheoryModeMessage(
      session,
      userMessageContent,
      collectedData,
      vacancyProfile,
      prepPlan,
      previousMode,
      conversationHistory,
      authToken
    );
  }

  if (mode === 'diagnostics') {
    return buildDiagnosticsModeMessage(
      session,
      userMessageContent,
      collectedData,
      vacancyProfile,
      prepPlan,
      previousMode,
      conversationHistory,
      authToken
    );
  }

  if (mode === 'employer_questions') {
    return buildEmployerQuestionsModeMessage(
      session,
      userMessageContent,
      collectedData,
      vacancyProfile,
      prepPlan,
      previousMode,
      conversationHistory,
      authToken
    );
  }

  const seniorityLevel = resolveCandidateSeniorityLevel(
    vacancyProfile?.level,
    collectedData.candidateSeniority as string | undefined
  );

  const shouldGrade =
    previousMode === mode &&
    (mode === 'case' || mode === 'star') &&
    userMessageContent.trim().length > 20 &&
    !isModeStartCommand(userMessageContent);

  const grading = shouldGrade
    ? await gradeInterviewAnswer({
        mode,
        answer: userMessageContent,
        vacancyProfile,
        collectedData,
        authToken,
      })
    : null;

  if (shouldGrade && mode === 'case') {
    logger.info(`event=case_answer_submitted sessionId=${session.id}`);
  }

  const rescueKey = getRescueCountKey(mode);
  const rescueCount = Number(collectedData[rescueKey] ?? 0);
  const rescueLimit = getRescueAttemptLimit(seniorityLevel);
  const useRescue =
    shouldGrade &&
    grading != null &&
    shouldTriggerFullRescue(grading, userMessageContent, mode) &&
    rescueCount < rescueLimit;

  const responsePhase = useRescue ? 'rescue' : 'default';

  const response = await generateInterviewModeResponse({
    mode,
    userMessage: userMessageContent,
    vacancyProfile,
    prepPlan,
    collectedData,
    conversationHistory,
    grading: grading ?? undefined,
    responsePhase,
    authToken,
  });

  const modeHistoryKey = `${mode}History`;
  const modeHistory = Array.isArray(collectedData[modeHistoryKey])
    ? (collectedData[modeHistoryKey] as unknown[])
    : [];

  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    ...baseMetadata,
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
          responsePhase,
        },
      ],
      lastResponsePhase: responsePhase,
      ...(useRescue
        ? {
            [rescueKey]: rescueCount + 1,
            lastRescueAt: new Date().toISOString(),
            rescueTriggered: true,
          }
        : {}),
    },
  };

  if (useRescue) {
    const packed = withPackArtifact(
      session,
      response,
      mode,
      'rescue_cheatsheet',
      collectedData,
      metadataUpdates.collectedData as Record<string, unknown>,
      prepPlan
    );
    return { message: packed.message, metadataUpdates: { ...metadataUpdates, collectedData: packed.collectedData } };
  }

  let packType: PrepPackType | undefined;
  if (shouldGrade && grading?.modelStructure?.length) {
    packType = mode === 'star' ? 'star_pack' : mode === 'case' ? 'case_structure' : undefined;
  }

  if (packType) {
    const packed = withPackArtifact(
      session,
      response,
      mode,
      packType,
      collectedData,
      metadataUpdates.collectedData as Record<string, unknown>,
      prepPlan
    );
    return { message: packed.message, metadataUpdates: { ...metadataUpdates, collectedData: packed.collectedData } };
  }

  if (shouldGrade && mode === 'star' && grading) {
    const starEntry = buildStarBankEntryFromAnswer({
      sessionId: session.id,
      collectedData,
      userMessage: userMessageContent,
      grading,
    });
    if (starEntry && session.userId) {
      void appendUserStarBankEntry(session.userId, starEntry).catch(() => undefined);
      const sessionBank = Array.isArray(collectedData.starBank)
        ? (collectedData.starBank as ReturnType<typeof mergeStarBankEntries>)
        : [];
      metadataUpdates.collectedData = {
        ...metadataUpdates.collectedData,
        starBank: mergeStarBankEntries(sessionBank, [starEntry]),
      };
    }
  }

  return {
    message: buildInterviewTextMessage(session, response, mode),
    metadataUpdates,
  };
}

async function buildTheoryModeMessage(
  session: ConversationSession,
  userMessageContent: string,
  collectedData: Record<string, unknown>,
  vacancyProfile: VacancyProfile | undefined,
  prepPlan: InterviewPrepPlanDay[],
  previousMode: InterviewPrepMode | undefined,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  authToken?: string
): Promise<{ message: Message; metadataUpdates: PreparedStepResult['metadataUpdates'] }> {
  const mode: InterviewPrepMode = 'theory';
  let lessonPhase = collectedData.lesson_phase as LessonPhase | undefined;
  const startingTheory =
    previousMode !== 'theory' || isModeStartCommand(userMessageContent) || !lessonPhase;

  if (startingTheory) {
    lessonPhase = 'learn';
    const learnPrompt =
      userMessageContent.trim().length > 0 && !isModeStartCommand(userMessageContent)
        ? userMessageContent
        : 'Начни микро-урок по первой приоритетной теме из плана подготовки для этой вакансии.';
    const response = await generateInterviewModeResponse({
      mode,
      userMessage: learnPrompt,
      vacancyProfile,
      prepPlan,
      collectedData: { ...collectedData, lesson_phase: 'learn' },
      conversationHistory,
      responsePhase: 'theory_learn',
      authToken,
    });
    logger.info(`event=theory_learn_started sessionId=${session.id}`);
    return {
      message: buildInterviewTextMessage(session, response, mode),
      metadataUpdates: {
        collectedData: { activeMode: mode, lesson_phase: 'learn' },
        currentStepId: 'mode_select',
      },
    };
  }

  if (lessonPhase === 'learn' && isPrepReadySignal(userMessageContent)) {
    const response = await generateInterviewModeResponse({
      mode,
      userMessage:
        'Кандидат готов к мини-проверке. Задай один короткий вопрос по теме последнего урока.',
      vacancyProfile,
      prepPlan,
      collectedData: { ...collectedData, lesson_phase: 'check' },
      conversationHistory,
      responsePhase: 'theory_check',
      authToken,
    });
    return {
      message: buildInterviewQuestionMessage(session, response.trim(), undefined, mode),
      metadataUpdates: {
        collectedData: { activeMode: mode, lesson_phase: 'check' },
        currentStepId: 'mode_select',
      },
    };
  }

  if (lessonPhase === 'check' && userMessageContent.trim().length > 15) {
    const response = await generateInterviewModeResponse({
      mode,
      userMessage: userMessageContent,
      vacancyProfile,
      prepPlan,
      collectedData,
      conversationHistory,
      responsePhase: 'default',
      authToken,
    });
    const patch = {
      activeMode: mode,
      lesson_phase: undefined,
      theoryLessonsCompleted: Number(collectedData.theoryLessonsCompleted ?? 0) + 1,
    };
    const packed = withPackArtifact(
      session,
      response,
      mode,
      'theory_cheatsheet',
      collectedData,
      patch,
      prepPlan
    );
    return {
      message: packed.message,
      metadataUpdates: {
        collectedData: packed.collectedData,
        currentStepId: 'mode_select',
      },
    };
  }

  const response = await generateInterviewModeResponse({
    mode,
    userMessage: userMessageContent,
    vacancyProfile,
    prepPlan,
    collectedData: { ...collectedData, lesson_phase: lessonPhase ?? 'learn' },
    conversationHistory,
    responsePhase: lessonPhase === 'check' ? 'theory_check' : 'theory_learn',
    authToken,
  });

  return {
    message:
      lessonPhase === 'check'
        ? buildInterviewQuestionMessage(session, response.trim(), undefined, mode)
        : buildInterviewTextMessage(session, response, mode),
    metadataUpdates: {
      collectedData: { activeMode: mode, lesson_phase: lessonPhase ?? 'learn' },
      currentStepId: 'mode_select',
    },
  };
}

async function buildDiagnosticsModeMessage(
  session: ConversationSession,
  userMessageContent: string,
  collectedData: Record<string, unknown>,
  vacancyProfile: VacancyProfile | undefined,
  prepPlan: InterviewPrepPlanDay[],
  previousMode: InterviewPrepMode | undefined,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  authToken?: string
): Promise<{ message: Message; metadataUpdates: PreparedStepResult['metadataUpdates'] }> {
  const mode: InterviewPrepMode = 'diagnostics';
  const diagnosticsHistory = Array.isArray(collectedData.diagnosticsHistory)
    ? (collectedData.diagnosticsHistory as unknown[])
    : [];
  const isFollowUp =
    previousMode === mode &&
    userMessageContent.trim().length > 5 &&
    !isModeStartCommand(userMessageContent);

  if (isFollowUp) {
    diagnosticsHistory.push({
      at: new Date().toISOString(),
      userMessage: userMessageContent,
    });
  }

  const emitPack =
    isFollowUp &&
    shouldEmitDiagnosticsPack(
      diagnosticsHistory.length,
      userMessageContent,
      getDiagnosticsPackMinAnswers(
        collectedData.prepRetention as PrepRetentionState | undefined
      )
    );

  const responsePhase = emitPack ? 'diagnostics_pack' : 'default';
  const response = await generateInterviewModeResponse({
    mode,
    userMessage: emitPack
      ? `Сформируй итоговую карту пробелов на основе диалога:\n${JSON.stringify(diagnosticsHistory.slice(-8))}`
      : userMessageContent,
    vacancyProfile,
    prepPlan,
    collectedData: { ...collectedData, diagnosticsHistory },
    conversationHistory,
    responsePhase,
    authToken,
  });

  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    collectedData: {
      activeMode: mode,
      diagnosticsHistory,
      ...(emitPack ? { diagnosticsPackComplete: true } : {}),
    },
    currentStepId: 'mode_select',
  };

  if (emitPack) {
    logger.info(`event=diagnostics_pack_emitted sessionId=${session.id}`);
    const patch = {
      activeMode: mode,
      diagnosticsHistory,
      diagnosticsPackComplete: true,
    };
    const packed = withPackArtifact(
      session,
      response,
      mode,
      'diagnostics_map',
      collectedData,
      patch,
      prepPlan
    );
    return {
      message: packed.message,
      metadataUpdates: {
        collectedData: packed.collectedData,
        currentStepId: 'mode_select',
      },
    };
  }

  return {
    message: buildInterviewQuestionMessage(session, response.trim(), undefined, mode),
    metadataUpdates,
  };
}

async function buildEmployerQuestionsModeMessage(
  session: ConversationSession,
  userMessageContent: string,
  collectedData: Record<string, unknown>,
  vacancyProfile: VacancyProfile | undefined,
  prepPlan: InterviewPrepPlanDay[],
  previousMode: InterviewPrepMode | undefined,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  authToken?: string
): Promise<{ message: Message; metadataUpdates: PreparedStepResult['metadataUpdates'] }> {
  const mode: InterviewPrepMode = 'employer_questions';
  const packComplete = Boolean(collectedData.employerQuestionsPackComplete);
  const starting =
    previousMode !== mode || isModeStartCommand(userMessageContent) || !packComplete;

  if (starting) {
    const response = await generateInterviewModeResponse({
      mode,
      userMessage:
        'Сформируй PACK: 8–12 вопросов работодателю по вакансии. Сгруппируй по роли, команде и метрикам успеха.',
      vacancyProfile,
      prepPlan,
      collectedData,
      conversationHistory,
      responsePhase: 'employer_questions_pack',
      authToken,
    });
    const patch = {
      activeMode: mode,
      employerQuestionsPackComplete: true,
    };
    const packed = withPackArtifact(
      session,
      response,
      mode,
      'employer_questions',
      collectedData,
      patch,
      prepPlan
    );
    logger.info(`event=employer_questions_pack_emitted sessionId=${session.id}`);
    return {
      message: packed.message,
      metadataUpdates: {
        collectedData: packed.collectedData,
        currentStepId: 'mode_select',
      },
    };
  }

  const response = await generateInterviewModeResponse({
    mode,
    userMessage: userMessageContent,
    vacancyProfile,
    prepPlan,
    collectedData,
    conversationHistory,
    authToken,
  });

  return {
    message: buildInterviewTextMessage(session, response, mode),
    metadataUpdates: {
      collectedData: { activeMode: mode },
      currentStepId: 'mode_select',
    },
  };
}

async function buildMockModeMessage(
  session: ConversationSession,
  userMessageContent: string,
  collectedData: Record<string, unknown>,
  vacancyProfile: VacancyProfile | undefined,
  prepPlan: InterviewPrepPlanDay[],
  previousMode: InterviewPrepMode | undefined,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  authToken?: string
): Promise<{ message: Message; metadataUpdates: PreparedStepResult['metadataUpdates'] }> {
  const mode: InterviewPrepMode = 'mock';
  let mockPhase = collectedData.mockPhase as MockPhase | undefined;
  const mockAnswers = Array.isArray(collectedData.mockAnswers)
    ? (collectedData.mockAnswers as unknown[])
    : [];
  const startingMock =
    previousMode !== 'mock' || isModeStartCommand(userMessageContent) || mockPhase === 'complete';

  const gate = evaluateMockGate(collectedData);
  if (
    (startingMock || mockPhase === 'briefing' || isMockReadySignal(userMessageContent)) &&
    !gate.allowed
  ) {
    logger.info(`event=mock_gate_blocked sessionId=${session.id} blockers=${gate.blockers.length}`);
    return {
      message: buildInterviewTextMessage(session, buildMockGateBlockedMessage(gate.blockers), mode),
      metadataUpdates: {
        collectedData: mergeCollectedWithPrepProgress(collectedData, prepPlan, { activeMode: mode }),
        currentStepId: 'mode_select',
      },
    };
  }

  if ((startingMock || mockPhase === 'briefing') && !isMockReadySignal(userMessageContent)) {
    logger.info(`event=mock_briefing_started sessionId=${session.id}`);
    return {
      message: buildInterviewTextMessage(
        session,
        buildMockBriefingMessage(vacancyProfile?.role),
        mode
      ),
      metadataUpdates: {
        collectedData: mergeCollectedWithPrepProgress(collectedData, prepPlan, {
          activeMode: mode,
          mockPhase: 'briefing',
          mockAnswers: [],
          mockInterview: { currentQuestionIndex: 0, answers: [] },
          lastResponsePhase: 'mock_briefing',
        }),
        currentStepId: 'mode_select',
      },
    };
  }

  if (
    isMockReadySignal(userMessageContent) &&
    mockPhase !== 'active' &&
    mockPhase !== 'complete'
  ) {
    mockPhase = 'active';
    const response = await generateInterviewModeResponse({
      mode,
      userMessage: 'Задай первый вопрос мок-интервью. Один вопрос, без вступления.',
      vacancyProfile,
      prepPlan,
      collectedData: { ...collectedData, mockPhase: 'active' },
      conversationHistory,
      responsePhase: 'mock_active',
      authToken,
    });
    logger.info(`event=mock_active_started sessionId=${session.id}`);
    return {
      message: buildInterviewQuestionMessage(session, response.trim(), undefined, mode),
      metadataUpdates: {
        collectedData: mergeCollectedWithPrepProgress(collectedData, prepPlan, {
          activeMode: mode,
          mockPhase: 'active',
          mockAnswers: [],
          mockInterview: { currentQuestionIndex: 1, answers: [] },
          lastResponsePhase: 'mock_active',
        }),
        currentStepId: 'mode_select',
      },
    };
  }

  const shouldGrade =
    mockPhase === 'active' &&
    userMessageContent.trim().length > 20 &&
    !isModeStartCommand(userMessageContent);

  const grading = shouldGrade
    ? await gradeInterviewAnswer({
        mode,
        answer: userMessageContent,
        vacancyProfile,
        collectedData,
        authToken,
      })
    : null;

  const responsePhase = shouldTriggerMicroRescue(grading, mode, mockPhase)
    ? 'mock_micro_rescue'
    : 'mock_active';

  const response = await generateInterviewModeResponse({
    mode,
    userMessage: userMessageContent,
    vacancyProfile,
    prepPlan,
    collectedData,
    conversationHistory,
    grading: grading ?? undefined,
    responsePhase: shouldGrade ? responsePhase : 'mock_active',
    authToken,
  });

  const metadataUpdates: PreparedStepResult['metadataUpdates'] = {
    collectedData: {
      activeMode: mode,
      mockPhase: mockPhase ?? 'active',
      lastInterviewGrade: grading ?? undefined,
      lastResponsePhase: shouldGrade ? responsePhase : 'mock_active',
    },
    currentStepId: 'mode_select',
  };

  if (!shouldGrade) {
    return {
      message: buildInterviewTextMessage(session, response, mode),
      metadataUpdates,
    };
  }

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
      vacancyProfile,
      answers: nextMockAnswers,
      authToken,
    });
    const debrief = await generateInterviewModeResponse({
      mode,
      userMessage: `Итог мок-интервью для debrief:\n${summary}`,
      vacancyProfile,
      prepPlan,
      collectedData: metadataUpdates.collectedData,
      conversationHistory,
      responsePhase: 'mock_debrief',
      authToken,
    });
    logger.info(`event=mock_interview_completed sessionId=${session.id}`);
    let mergedCollected = mergeCollectedWithPrepProgress(collectedData, prepPlan, {
      ...metadataUpdates.collectedData,
      mockPhase: 'complete',
      mockSummary: summary,
      prepComplete: true,
      lastResponsePhase: 'mock_debrief',
    });
    mergedCollected = mergePrepArtifacts(mergedCollected, {}, {
      packType: 'mock_summary',
      mode: 'mock',
      title: packTitle('mock_summary', 'mock'),
      content: summary,
    });
    metadataUpdates.collectedData = mergedCollected;
    metadataUpdates.currentStepId = 'prep_complete';
    const completeCard = buildPrepCompleteCard(
      session,
      vacancyProfile,
      prepPlan,
      mergedCollected,
      summary,
      debrief
    );
    mergedCollected = mergePrepArtifacts(mergedCollected, {}, {
      packType: 'prep_complete',
      mode: 'mock',
      title: PREP_COMPLETE_CARD_TITLE,
      content: [debrief, summary].filter(Boolean).join('\n\n'),
      messageId: completeCard.id,
    });
    metadataUpdates.collectedData = mergedCollected;
    return {
      message: completeCard,
      metadataUpdates,
    };
  }

  return {
    message: buildInterviewTextMessage(session, response, mode),
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
    const vacancyText =
      normalizeVacancyPrepInput(userMessageContent) ?? stripHtmlFromText(userMessageContent.trim());

    if (isUrlOnlyVacancyInput(vacancyText)) {
      logger.info(`event=interview_prep_started sessionId=${session.id} source=url_only`);
      return {
        message: buildInterviewTextMessage(
          session,
          'Вижу ссылку на вакансию. Я не буду выдумывать детали по одной ссылке: вставь, пожалуйста, текст вакансии или хотя бы ключевые требования. После этого соберу профиль роли и план подготовки.'
        ),
        metadataUpdates: {
          collectedData: {
            vacancySource: 'url',
            vacancyUrl: vacancyText.trim(),
          },
          currentStepId: 'vacancy_input',
        },
        nextStepId: 'vacancy_input',
      };
    }

    logger.info(`event=interview_prep_started sessionId=${session.id} source=${detectVacancySource(vacancyText)}`);
    const profile = await extractVacancyProfile({
      vacancyText: vacancyText,
      source: detectVacancySource(vacancyText),
      authToken,
    });
    logger.info(`event=vacancy_profile_extracted sessionId=${session.id} role=${profile.role ?? 'unknown'}`);

    const priorSessions = (await getUserSessions(session.userId)).filter(
      (item) => item.id !== session.id
    );
    const prepRetention = buildPrepRetentionState({
      priorSessions,
      newProfile: profile,
    });
    const latestPriorSession = priorSessions
      .filter(
        (item) =>
          item.id !== session.id &&
          Boolean(item.metadata.collectedData?.vacancyProfile && item.metadata.collectedData?.prepPlan)
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const priorPrepSnapshot = latestPriorSession
      ? buildPriorPrepSnapshot(latestPriorSession) ?? undefined
      : undefined;
    const sessionStarEntries = priorSessions.flatMap((item) =>
      extractStarEntriesFromCollected(item.metadata.collectedData ?? {}, item.id)
    );
    const persistedStarBank = session.userId ? await loadUserStarBank(session.userId) : [];
    const starBank = mergeStarBankEntries(persistedStarBank, sessionStarEntries);
    if (session.userId && starBank.length > 0) {
      await saveUserStarBank(session.userId, starBank);
    }

    const candidateSeniority = inferSeniorityFromLevel(profile.level);
    const prepPlan = await generateInterviewPrepPlan({
      vacancyProfile: profile,
      availableDays: 5,
      authToken,
      candidateSeniority,
      prepContext: prepRetention.isReturningUser
        ? {
            priorFatalGaps: prepRetention.priorFatalGaps,
            prepSessionNumber: prepRetention.prepSessionNumber,
            sameRoleTrack: prepRetention.sameRoleTrack,
          }
        : undefined,
    });
    logger.info(
      `event=prep_plan_generated sessionId=${session.id} days=${prepPlan.length} returning=${prepRetention.isReturningUser}`
    );

    const retentionWelcome = buildReturningUserWelcome(
      prepRetention,
      profile.role ?? 'новой роли',
      starBank.length
    );

    return {
      message: buildVacancyProfileCard(session, profile, prepPlan, retentionWelcome),
      metadataUpdates: {
        collectedData: mergeCollectedWithPrepProgress(
          session.metadata.collectedData ?? {},
          prepPlan,
          {
            vacancySource: detectVacancySource(vacancyText),
            vacancyRawText: vacancyText,
            vacancyProfile: profile,
            prepPlan,
            candidateSeniority,
            prepRetention,
            prepVacancyHistory: prepRetention.prepVacancyHistory,
            priorPrepSnapshot,
            starBank,
          }
        ),
        completedSteps: ['vacancy_input'],
        currentStepId: 'mode_select',
      },
      nextStepId: 'mode_select',
    };
  }

  const explicitMode = detectInterviewModeCommandFromUserText(userMessageContent);
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
  const prepPlan = session.metadata.collectedData.prepPlan as InterviewPrepPlanDay[] | undefined;
  if (result.metadataUpdates?.collectedData && prepPlan?.length) {
    const merged = {
      ...session.metadata.collectedData,
      ...result.metadataUpdates.collectedData,
    };
    result.metadataUpdates.collectedData = {
      ...result.metadataUpdates.collectedData,
      prepProgress: computePrepProgress(prepPlan, merged),
    };
  }
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

export async function analyzeVacancyFromText(
  session: ConversationSession,
  vacancyText: string,
  _displayLabel: string,
  authToken?: string
): Promise<PreparedStepResult> {
  const scenarioUpdates = ensureScenarioMetadata(session);
  const scenarioId = session.metadata.scenarioId;
  if (!scenarioId || !isInterviewPrepSession(session)) {
    return { message: null, metadataUpdates: scenarioUpdates };
  }

  const normalized =
    normalizeVacancyPrepInput(vacancyText) ?? stripHtmlFromText(vacancyText.trim());
  if (normalized.length < 40) {
    return {
      message: buildInterviewTextMessage(
        session,
        'Не удалось распознать текст вакансии. Вставь описание роли или ключевые требования.'
      ),
      metadataUpdates: { ...scenarioUpdates, currentStepId: 'vacancy_input' },
      nextStepId: 'vacancy_input',
    };
  }

  const vacancyStep = getStep(scenarioId, 'vacancy_input');
  if (!vacancyStep) {
    return { message: null, metadataUpdates: scenarioUpdates };
  }

  session.metadata.collectedData = {
    ...session.metadata.collectedData,
    interviewMode: 'разбор вакансии',
  };
  session.metadata.currentStepId = 'vacancy_input';

  const result = await handleInterviewPrepReply(session, vacancyStep, normalized, authToken);
  const completedSteps = Array.from(
    new Set([
      ...(session.metadata.completedSteps || []),
      'greeting',
      ...(result.metadataUpdates?.completedSteps || []),
    ])
  );

  return {
    ...result,
    metadataUpdates: {
      ...scenarioUpdates,
      ...result.metadataUpdates,
      completedSteps,
      flags: {
        ...(session.metadata.flags || {}),
        ...(result.metadataUpdates?.flags || {}),
        [getStepSentFlagKey('greeting')]: true,
        [getStepSentFlagKey('vacancy_input')]: true,
      },
    },
  };
}

/** Сессия interview-prep из Jack: без приветствия, сразу к разбору вакансии. */
export function prepareVacancyAnalyzeSession(
  session: ConversationSession
): Partial<ConversationSessionMetadata> {
  const scenarioUpdates = ensureScenarioMetadata(session);
  return {
    ...scenarioUpdates,
    currentStepId: 'vacancy_input',
    completedSteps: Array.from(
      new Set([...(session.metadata.completedSteps || []), 'greeting'])
    ),
    collectedData: {
      ...session.metadata.collectedData,
      interviewMode: 'разбор вакансии',
    },
    flags: {
      ...(session.metadata.flags || {}),
      [getStepSentFlagKey('greeting')]: true,
    },
  };
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

  // Jack «Разбор вакансии»: полный текст вакансии — сразу в анализ (greeting или vacancy_input).
  if (isInterviewPrepSession(session)) {
    const autoVacancyText = normalizeVacancyPrepInput(userMessageContent);
    if (
      autoVacancyText &&
      (currentStep.id === 'greeting' || currentStep.id === 'vacancy_input')
    ) {
      const vacancyStep = getStep(scenarioId, 'vacancy_input');
      if (vacancyStep) {
        session.metadata.collectedData = {
          ...session.metadata.collectedData,
          interviewMode: 'разбор вакансии',
        };
        return handleInterviewPrepReply(session, vacancyStep, autoVacancyText, authToken);
      }
    }
  }

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
        if (authToken) {
          await enrichAndPersistProfile(session, authToken, 'profile_snapshot');
        }
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
    } else if (currentStep.id === 'quick_ready') {
      return handleQuickReadyReply(
        session,
        scenarioId,
        userMessageContent,
        scenarioUpdates,
        authToken
      );
    } else if (currentStep.id === 'resume_ready') {
      return handleResumeReadyReply(session, scenarioId, userMessageContent, scenarioUpdates);
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
  // 'resume_upload' — ждём файл или длинную вставку текста резюме.
  if (
    currentStep.type === 'question' &&
    currentStep.id !== 'clarify' &&
    currentStep.id !== 'completion_gap' &&
    currentStep.id !== 'pause_reminder' &&
    currentStep.id !== 'greeting' &&
    currentStep.id !== 'resume_upload'
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

  if (currentStep.type === 'question' && currentStep.id === 'resume_upload') {
    const trimmed = userMessageContent.trim();
    if (trimmed.length < 40) {
      return {
        message: {
          id: uuidv4(),
          type: MessageType.TEXT,
          role: MessageRole.ASSISTANT,
          timestamp: new Date().toISOString(),
          sessionId: session.id,
          content:
            'Загрузите PDF или DOCX через зону ниже или вставьте полный текст резюме. Если удобнее — выберите «Быстрый подбор».',
        },
        metadataUpdates: scenarioUpdates,
        nextStepId: 'resume_upload',
      };
    }
  }

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

      if (currentStep.collectKey === 'desired_start' && authToken) {
        const enriched = await enrichAndPersistProfile(session, authToken, 'desired_start');
        if (enriched) {
          metadataUpdates.collectedData = {
            ...(metadataUpdates.collectedData || {}),
            __enriched: enriched,
          };
        }
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

  // Режим «Заполнить пробелы»: прыгаем только на пустые поля, без линейного прогона уже заполненных
  if (session.metadata.flags?.[FILL_PROFILE_GAPS_FLAG] === true) {
    const gapId = findFirstProfileGapStepId(
      getScenario(scenarioId),
      session.metadata.collectedData
    );
    if (gapId) {
      nextStepId = gapId;
      logger.info(`fillProfileGaps: next gap step ${gapId}`);
    } else {
      const readyStep = isResumePathMode(session.metadata.collectedData)
        ? 'resume_ready'
        : 'quick_ready';
      nextStepId = readyStep;
      metadataUpdates.flags = {
        ...(metadataUpdates.flags || {}),
        [FILL_PROFILE_GAPS_FLAG]: false,
      };
      session.metadata.flags = {
        ...(session.metadata.flags || {}),
        [FILL_PROFILE_GAPS_FLAG]: false,
      };
      logger.info(`fillProfileGaps: done, returning to ${readyStep}`);
    }
  }

  if (nextStepId === 'quick_ready') {
    const enriched = enrichQuickPathCollectedData(
      session.metadata.collectedData as Record<string, unknown>
    );
    session.metadata.collectedData = enriched;
    metadataUpdates.collectedData = {
      ...(metadataUpdates.collectedData || {}),
      ...enriched,
    };
    logger.info('Enriched Quick Path collectedData before quick_ready screen');
  }

  if (nextStepId === 'resume_ready') {
    const enriched = enrichQuickPathCollectedData(
      session.metadata.collectedData as Record<string, unknown>
    );
    session.metadata.collectedData = enriched;
    metadataUpdates.collectedData = {
      ...(metadataUpdates.collectedData || {}),
      ...enriched,
    };
    logger.info('Enriched resume-path collectedData before resume_ready screen');
    if (authToken) {
      const enrichedProfile = await enrichAndPersistProfile(session, authToken, 'resume_ready');
      if (enrichedProfile) {
        metadataUpdates.collectedData = {
          ...(metadataUpdates.collectedData || {}),
          __enriched: enrichedProfile,
        };
      }
    }
  }

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
    const mode = parseInterviewModeToken(action.replace('interview_mode:', ''));
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

    case 'open_vacancies':
    case 'show_recommendations': {
      // UI-only: frontend opens the vacancies tab; keep session on ready screen.
      return {
        message: null,
        metadataUpdates: scenarioUpdates,
        nextStepId: currentStepId ?? undefined,
      };
    }

    case 'fill_profile_gaps': {
      return handleFillProfileGapsCommand(
        session,
        scenarioId || DEFAULT_SCENARIO_ID,
        scenarioUpdates,
        currentStepId
      );
    }

    case 'resume_start_quick': {
      const effectiveScenarioId = scenarioId || DEFAULT_SCENARIO_ID;
      session.metadata.collectedData = {
        ...session.metadata.collectedData,
        scenarioMode: 'быстрый подбор',
      };
      return prepareAssistantMessageForStepId(session, effectiveScenarioId, 'quick_role', {
        ...scenarioUpdates,
        collectedData: session.metadata.collectedData,
      });
    }

    case 'resume_weak_match': {
      const effectiveScenarioId = scenarioId || DEFAULT_SCENARIO_ID;
      const clarifyStepId = pickResumeClarifyStepId(session.metadata.collectedData);
      if (clarifyStepId) {
        logger.info(`Resume weak match: clarifying via step ${clarifyStepId}`);
        return prepareAssistantMessageForStepId(
          session,
          effectiveScenarioId,
          clarifyStepId,
          scenarioUpdates
        );
      }
      break;
    }

    case 'start_detailed_analysis': {
      // С resume_ready больше не рестартуем детальный путь — только пробелы
      if (currentStepId === 'resume_ready') {
        return handleFillProfileGapsCommand(
          session,
          scenarioId || DEFAULT_SCENARIO_ID,
          scenarioUpdates,
          currentStepId
        );
      }
      if (currentStepId === 'quick_ready') {
        logger.info(`User chose detailed analysis command from ${currentStepId}`);
        const metadataUpdates = buildQuickReadyDetailedAnalysisTransition(session, scenarioUpdates);
        const effectiveScenarioId = scenarioId || DEFAULT_SCENARIO_ID;
        return prepareAssistantMessageForStepId(
          session,
          effectiveScenarioId,
          'career_overview',
          metadataUpdates
        );
      }
      break;
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
