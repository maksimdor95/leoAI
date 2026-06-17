/**
 * AI Client
 * Calls AI/NLP service (Yandex GPT integration) via REST
 */

import axios from 'axios';
import { Message, MessageRole, MessageType } from '../types/message';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3003';

function buildAuthHeaders(token?: string): Record<string, string> {
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'X-Auth-Token': `Bearer ${token}`,
  };
}

export type AssistantAudio = {
  audioBase64: string;
  mimeType: string;
  format?: 'mp3' | 'oggopus';
};

interface AIProcessMessageResponse {
  status: 'success';
  sessionId: string;
  userId: string;
  aiMessage: {
    message: {
      role: 'assistant' | 'system' | 'user';
      text: string;
    };
    usage?: {
      inputTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
  facts?: Record<string, unknown>;
}

type AIHistoryEntry = {
  role: 'user' | 'assistant';
  content: string;
};

export async function sendMessageToAI(params: {
  sessionId: string;
  userId: string;
  content: string;
  history?: AIHistoryEntry[];
}): Promise<{ messages: Message[]; facts?: Record<string, unknown> }> {
  try {
    const response = await axios.post<AIProcessMessageResponse>(
      `${AI_SERVICE_URL}/api/ai/process-message`,
      {
        sessionId: params.sessionId,
        userId: params.userId,
        message: params.content,
        history: params.history?.map((entry) => ({ role: entry.role, text: entry.content })),
      },
      {
        timeout: 15000,
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI service returned non-success status');
    }

    const aiText = response.data.aiMessage.message.text || '';

    const aiMessages: Message[] = [
      {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.ASSISTANT,
        timestamp: new Date().toISOString(),
        sessionId: params.sessionId,
        content: aiText,
      },
    ];

    return {
      messages: aiMessages,
      facts: response.data.facts,
    };
  } catch (error: unknown) {
    logger.error('Error calling AI service:', error);
    throw error;
  }
}

interface GenerateStepRequest {
  stepId: string;
  instruction: string;
  fallbackText: string;
  collectedData?: Record<string, unknown>;
  tone?: 'default' | 'friendly' | 'formal';
}

interface GenerateStepResponse {
  status: 'success';
  text: string;
}

export async function generateStepQuestionText(params: GenerateStepRequest): Promise<string> {
  try {
    const response = await axios.post<GenerateStepResponse>(
      `${AI_SERVICE_URL}/api/ai/generate-step`,
      {
        stepId: params.stepId,
        instruction: params.instruction,
        fallbackText: params.fallbackText,
        facts: params.collectedData ?? {},
        tone: params.tone ?? 'friendly',
      },
      {
        timeout: 10000,
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI generate-step returned non-success status');
    }

    return response.data.text;
  } catch (error: unknown) {
    logger.error('Error generating step question text:', error);
    throw error;
  }
}

interface ValidateAnswerRequest {
  question: string;
  answer: string;
  collectedData?: Record<string, unknown>;
  stepId: string;
}

export interface ValidationResult {
  quality: 'good' | 'unclear' | 'irrelevant';
  reason: string;
  suggestion?: string;
}

interface ValidateAnswerResponse {
  status: 'success';
  validation: ValidationResult;
}

export async function validateAnswer(params: ValidateAnswerRequest): Promise<ValidationResult> {
  try {
    const response = await axios.post<ValidateAnswerResponse>(
      `${AI_SERVICE_URL}/api/ai/validate-answer`,
      {
        question: params.question,
        answer: params.answer,
        collectedData: params.collectedData ?? {},
        stepId: params.stepId,
      },
      {
        timeout: 10000,
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI validate-answer returned non-success status');
    }

    return response.data.validation;
  } catch (error: unknown) {
    logger.warn('Error validating answer, assuming good quality:', error);
    // Fallback to good quality on error to not block the flow
    return {
      quality: 'good',
      reason: 'Validation service unavailable, assuming good quality',
    };
  }
}

interface AnalyzeProfileRequest {
  collectedData?: Record<string, unknown>;
  completedSteps?: string[];
  currentStepId: string;
}

export interface ProfileAnalysisResult {
  completeness: number; // 0.0 - 1.0
  hasGaps: boolean;
  criticalGaps: string[];
  missingFields: string[];
  contradictions: string[];
  readyForMatching: boolean;
}

interface AnalyzeProfileResponse {
  status: 'success';
  analysis: ProfileAnalysisResult;
}

export async function analyzeProfile(
  params: AnalyzeProfileRequest
): Promise<ProfileAnalysisResult> {
  try {
    const response = await axios.post<AnalyzeProfileResponse>(
      `${AI_SERVICE_URL}/api/ai/analyze-profile`,
      {
        collectedData: params.collectedData ?? {},
        completedSteps: params.completedSteps ?? [],
        currentStepId: params.currentStepId,
      },
      {
        timeout: 15000,
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI analyze-profile returned non-success status');
    }

    return response.data.analysis;
  } catch (error: unknown) {
    logger.warn('Error analyzing profile, assuming incomplete:', error);
    // Fallback to incomplete profile on error
    return {
      completeness: 0.5,
      hasGaps: true,
      criticalGaps: [],
      missingFields: [],
      contradictions: [],
      readyForMatching: false,
    };
  }
}

interface CheckContextRequest {
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    text: string;
  }>;
  currentStep: {
    id: string;
    label: string;
    instruction?: string;
  };
  userMessage: string;
}

export interface ContextCheckResult {
  onTopic: boolean;
  deviation: string;
  shouldRedirect: boolean;
  importantInfo: string[];
}

interface CheckContextResponse {
  status: 'success';
  contextCheck: ContextCheckResult;
}

export async function checkContext(params: CheckContextRequest): Promise<ContextCheckResult> {
  try {
    const response = await axios.post<CheckContextResponse>(
      `${AI_SERVICE_URL}/api/ai/check-context`,
      {
        conversationHistory: params.conversationHistory ?? [],
        currentStep: params.currentStep,
        userMessage: params.userMessage,
      },
      {
        timeout: 10000,
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI check-context returned non-success status');
    }

    return response.data.contextCheck;
  } catch (error: unknown) {
    logger.warn('Error checking context, assuming on-topic:', error);
    // Fallback to on-topic on error
    return {
      onTopic: true,
      deviation: '',
      shouldRedirect: false,
      importantInfo: [],
    };
  }
}

interface FreeChatRequest {
  message: string;
  collectedData?: Record<string, unknown>;
  authToken?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface FreeChatResponse {
  status: 'success';
  text: string;
}

export async function generateFreeChatResponse(params: FreeChatRequest): Promise<string> {
  try {
    const response = await axios.post<FreeChatResponse>(
      `${AI_SERVICE_URL}/api/ai/free-chat`,
      {
        message: params.message,
        collectedData: params.collectedData ?? {},
        conversationHistory: params.conversationHistory ?? [],
      },
      {
        timeout: 15000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI free-chat returned non-success status');
    }

    return response.data.text;
  } catch (error: unknown) {
    logger.warn('Error generating free chat response, using fallback:', error);
    // Fallback message
    return 'Извините, не могу ответить на этот вопрос. Могу помочь с поиском работы или карьерными вопросами.';
  }
}

export type InterviewPrepMode =
  | 'diagnostics'
  | 'theory'
  | 'case'
  | 'mock'
  | 'star'
  | 'employer_questions';

export type VacancyProfile = {
  role?: string;
  level?: string;
  location?: string;
  format?: string;
  interviewLanguage?: string;
  stack?: string[];
  domain?: string;
  responsibilities?: string[];
  requirements?: string[];
  softSkills?: string[];
  metrics?: string[];
  gaps?: string[];
  assumptions?: string[];
};

export type InterviewPrepPlanDay = {
  day: number;
  focus: string;
  tasks: string[];
};

export type InterviewAnswerGrade = {
  overallScore: number;
  dimensionScores: {
    structure: number;
    depth: number;
    metrics: number;
    tradeOffs: number;
    communication: number;
    seniorityFit: number;
  };
  fatalGaps: string[];
  strengths: string[];
  improvements: string[];
  followUpToProbe: string;
  modelStructure: string[];
};

type InterviewApiResponse<T extends Record<string, unknown>> = T & {
  status: 'success';
};

const FALLBACK_VACANCY_PROFILE: VacancyProfile = {
  role: 'Роль требует уточнения',
  level: 'Middle/Senior',
  location: 'Не указано',
  format: 'Не указано',
  interviewLanguage: 'ru',
  stack: [],
  domain: 'Не указан',
  responsibilities: [],
  requirements: [],
  softSkills: ['коммуникация', 'системное мышление'],
  metrics: [],
  gaps: ['Недостаточно данных для точного профиля вакансии.'],
  assumptions: ['Профиль построен по краткому описанию пользователя.'],
};

export async function extractVacancyProfile(params: {
  vacancyText: string;
  source: 'url' | 'text' | 'summary';
  authToken?: string;
}): Promise<VacancyProfile> {
  try {
    const response = await axios.post<InterviewApiResponse<{ profile: VacancyProfile }>>(
      `${AI_SERVICE_URL}/api/ai/interview/extract-vacancy-profile`,
      {
        vacancyText: params.vacancyText,
        source: params.source,
      },
      {
        timeout: 20000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success' || !response.data.profile) {
      throw new Error('AI extract-vacancy-profile returned non-success status');
    }
    return response.data.profile;
  } catch (error: unknown) {
    logger.warn('Error extracting vacancy profile, using fallback:', error);
    return {
      ...FALLBACK_VACANCY_PROFILE,
      requirements: [params.vacancyText.slice(0, 400)],
    };
  }
}

export async function generateInterviewPrepPlan(params: {
  vacancyProfile: VacancyProfile;
  availableDays?: number;
  authToken?: string;
}): Promise<InterviewPrepPlanDay[]> {
  try {
    const response = await axios.post<InterviewApiResponse<{ plan: InterviewPrepPlanDay[] }>>(
      `${AI_SERVICE_URL}/api/ai/interview/generate-prep-plan`,
      {
        vacancyProfile: params.vacancyProfile,
        availableDays: params.availableDays ?? 5,
      },
      {
        timeout: 20000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success' || !Array.isArray(response.data.plan)) {
      throw new Error('AI generate-prep-plan returned non-success status');
    }
    return response.data.plan;
  } catch (error: unknown) {
    logger.warn('Error generating interview prep plan, using fallback:', error);
    return [
      {
        day: 1,
        focus: 'Профиль роли и базовая теория',
        tasks: ['Разобрать ожидания вакансии', 'Составить список слабых зон', 'Повторить базовые понятия домена'],
      },
      {
        day: 2,
        focus: 'Метрики и кейсы',
        tasks: ['Подготовить структуру кейса', 'Отработать 1-2 типовых вопроса', 'Собрать вопросы работодателю'],
      },
    ];
  }
}

export async function generateInterviewModeResponse(params: {
  mode: InterviewPrepMode;
  userMessage: string;
  vacancyProfile?: VacancyProfile;
  prepPlan?: InterviewPrepPlanDay[];
  collectedData?: Record<string, unknown>;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  grading?: InterviewAnswerGrade;
  authToken?: string;
}): Promise<string> {
  try {
    const response = await axios.post<InterviewApiResponse<{ text: string }>>(
      `${AI_SERVICE_URL}/api/ai/interview/respond`,
      {
        mode: params.mode,
        userMessage: params.userMessage,
        vacancyProfile: params.vacancyProfile,
        prepPlan: params.prepPlan ?? [],
        collectedData: params.collectedData ?? {},
        conversationHistory: params.conversationHistory ?? [],
        grading: params.grading,
      },
      {
        timeout: 25000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success' || !response.data.text) {
      throw new Error('AI interview/respond returned non-success status');
    }
    return response.data.text;
  } catch (error: unknown) {
    logger.warn('Error generating interview mode response, using fallback:', error);
    return 'Давай продолжим подготовку. Ответь развернуто: что бы ты сказал на интервью, какие шаги предпринял бы и какими метриками проверил результат?';
  }
}

export async function gradeInterviewAnswer(params: {
  mode: InterviewPrepMode;
  answer: string;
  vacancyProfile?: VacancyProfile;
  collectedData?: Record<string, unknown>;
  authToken?: string;
}): Promise<InterviewAnswerGrade | null> {
  try {
    const response = await axios.post<InterviewApiResponse<{ grade: InterviewAnswerGrade }>>(
      `${AI_SERVICE_URL}/api/ai/interview/grade-answer`,
      {
        mode: params.mode,
        answer: params.answer,
        vacancyProfile: params.vacancyProfile,
        collectedData: params.collectedData ?? {},
      },
      {
        timeout: 20000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success' || !response.data.grade) {
      throw new Error('AI grade-answer returned non-success status');
    }
    return response.data.grade;
  } catch (error: unknown) {
    logger.warn('Error grading interview answer, continuing without grade:', error);
    return null;
  }
}

export async function generateMockInterviewSummary(params: {
  vacancyProfile?: VacancyProfile;
  answers: unknown[];
  authToken?: string;
}): Promise<string> {
  try {
    const response = await axios.post<InterviewApiResponse<{ summary: string }>>(
      `${AI_SERVICE_URL}/api/ai/interview/generate-mock-summary`,
      {
        vacancyProfile: params.vacancyProfile,
        answers: params.answers,
      },
      {
        timeout: 25000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success' || !response.data.summary) {
      throw new Error('AI generate-mock-summary returned non-success status');
    }
    return response.data.summary;
  } catch (error: unknown) {
    logger.warn('Error generating mock interview summary, using fallback:', error);
    return 'Суммарно: продолжайте усиливать структуру ответов, добавляйте конкретные метрики, ограничения и выводы. Перед интервью повторите профиль вакансии и подготовьте 2-3 сильных истории по STAR.';
  }
}

type RetrieveContextRequest = {
  query: string;
  topK?: number;
  sessionId?: string;
  scenarioId?: string;
  collectedData?: Record<string, unknown>;
  contentList?: {
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
  };
  authToken?: string;
};

export type RetrievedContextItem = {
  chunkId: string;
  text: string;
  score: number;
  reason: string;
  metadata?: {
    docId?: string;
    page?: number;
    tags?: string[];
    source?: 'content_list' | 'collected_data';
  };
};

export async function retrieveContext(
  params: RetrieveContextRequest
): Promise<{ items: RetrievedContextItem[] }> {
  try {
    const response = await axios.post<{
      status: 'success';
      items: RetrievedContextItem[];
    }>(
      `${AI_SERVICE_URL}/api/ai/retrieve-context`,
      {
        sessionId: params.sessionId,
        scenarioId: params.scenarioId,
        query: params.query,
        topK: params.topK ?? 5,
        collectedData: params.collectedData ?? {},
        contentList: params.contentList,
      },
      {
        timeout: 8000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success') {
      throw new Error('AI retrieve-context returned non-success status');
    }
    return { items: response.data.items || [] };
  } catch (error: unknown) {
    logger.warn('Error retrieving context, fallback to empty result:', error);
    return { items: [] };
  }
}

interface GenerateResumeResponse {
  status: 'success';
  resume: string;
  format: 'markdown' | 'text' | 'json';
}

interface GenerateSummaryResponse {
  status: 'success';
  summary: {
    professionalSummary: string;
    score: number;
    scoreBreakdown: Array<{
      criterion: string;
      score: number;
      maxScore: number;
      comment: string;
    }>;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

export async function generateProfileSummaryFromCollectedData(params: {
  collectedData: Record<string, unknown>;
  authToken?: string;
}): Promise<GenerateSummaryResponse['summary']> {
  const response = await axios.post<GenerateSummaryResponse>(
    `${AI_SERVICE_URL}/api/ai/generate-summary`,
    { collectedData: params.collectedData },
    {
      timeout: 45000,
      headers: buildAuthHeaders(params.authToken),
    }
  );

  if (response.data.status !== 'success' || !response.data.summary?.professionalSummary) {
    throw new Error('AI generate-summary returned non-success status');
  }

  return response.data.summary;
}

export async function generateResumeFromCollectedData(params: {
  collectedData: Record<string, unknown>;
  format?: 'markdown' | 'text' | 'json';
  authToken?: string;
}): Promise<{ resume: string; format: 'markdown' | 'text' | 'json' }> {
  const response = await axios.post<GenerateResumeResponse>(
    `${AI_SERVICE_URL}/api/ai/generate-resume`,
    {
      collectedData: params.collectedData,
      format: params.format ?? 'markdown',
    },
    {
      timeout: 30000,
      headers: buildAuthHeaders(params.authToken),
    }
  );

  if (response.data.status !== 'success' || !response.data.resume) {
    throw new Error('AI generate-resume returned non-success status');
  }

  return {
    resume: response.data.resume,
    format: response.data.format ?? (params.format ?? 'markdown'),
  };
}

interface TtsResponse {
  status: 'success';
  audioBase64: string;
  mimeType: string;
  format?: 'mp3' | 'oggopus';
}

type TtsPreset = 'ermil_normal' | 'ermil_soft' | 'filipp_fast';
const DEFAULT_TTS_VOICE = 'ermil';
const DEFAULT_TTS_SPEED = 1.0;
const DEFAULT_TTS_FORMAT: 'mp3' | 'oggopus' = 'oggopus';
const TTS_PRESETS: Record<TtsPreset, { voice: string; speed: number; format: 'mp3' | 'oggopus' }> = {
  ermil_normal: { voice: 'ermil', speed: 1.0, format: 'oggopus' },
  ermil_soft: { voice: 'ermil', speed: 0.92, format: 'oggopus' },
  filipp_fast: { voice: 'filipp', speed: 1.08, format: 'oggopus' },
};

function resolveTtsPreset(raw?: string): TtsPreset | null {
  if (!raw) return null;
  return raw in TTS_PRESETS ? (raw as TtsPreset) : null;
}

function normalizeTtsText(text: string): string {
  // Keep message natural for speech synthesis:
  // collapse whitespace and add lightweight pauses on list separators.
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/([,;:])\s*/g, '$1 ')
    .trim();
  return normalized.length > 1100 ? `${normalized.slice(0, 1090).trim()}...` : normalized;
}

function detectTtsLang(text: string): string {
  const cyrillicChars = (text.match(/[а-яё]/gi) || []).length;
  const latinChars = (text.match(/[a-z]/gi) || []).length;
  if (latinChars > cyrillicChars * 2 && latinChars > 24) {
    return 'en-US';
  }
  return 'ru-RU';
}

export async function synthesizeAssistantAudio(params: {
  text: string;
  lang?: string;
  voice?: string;
  speed?: number;
  format?: 'mp3' | 'oggopus';
  preset?: TtsPreset;
  authToken?: string;
}): Promise<AssistantAudio | null> {
  const normalizedText = normalizeTtsText(params.text);
  if (!normalizedText) return null;

  const presetName =
    params.preset ??
    resolveTtsPreset(process.env.TTS_PRESET) ??
    'ermil_normal';
  const preset = TTS_PRESETS[presetName];
  const configuredSpeed = Number(process.env.TTS_SPEED);
  const speed =
    params.speed ??
    (Number.isFinite(configuredSpeed) && configuredSpeed > 0 ? configuredSpeed : undefined) ??
    preset?.speed ??
    DEFAULT_TTS_SPEED;

  try {
    const response = await axios.post<TtsResponse>(
      `${AI_SERVICE_URL}/api/ai/tts`,
      {
        text: normalizedText,
        lang: params.lang ?? detectTtsLang(normalizedText),
        preset: presetName ?? undefined,
        voice: params.voice ?? process.env.TTS_VOICE ?? preset?.voice ?? DEFAULT_TTS_VOICE,
        speed,
        format:
          params.format ??
          (process.env.TTS_FORMAT as 'mp3' | 'oggopus' | undefined) ??
          preset?.format ??
          DEFAULT_TTS_FORMAT,
      },
      {
        timeout: 25000,
        headers: buildAuthHeaders(params.authToken),
      }
    );

    if (response.data.status !== 'success' || !response.data.audioBase64) {
      logger.warn('TTS source=fallback reason=empty_response');
      return null;
    }

    logger.info(
      `TTS source=yandex preset=${presetName ?? 'custom'} voice=${
        params.voice ?? process.env.TTS_VOICE ?? preset?.voice ?? DEFAULT_TTS_VOICE
      } format=${response.data.format ?? 'unknown'}`
    );
    logger.info('event=tts_played source=yandex');

    return {
      audioBase64: response.data.audioBase64,
      mimeType: response.data.mimeType || 'audio/mpeg',
      format: response.data.format,
    };
  } catch (error: unknown) {
    logger.warn('TTS source=fallback reason=request_failed', error);
    return null;
  }
}
