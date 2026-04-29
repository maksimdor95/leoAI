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
  return text
    .replace(/\s+/g, ' ')
    .replace(/([,;:])\s*/g, '$1 ')
    .trim();
}

export async function synthesizeAssistantAudio(params: {
  text: string;
  lang?: string;
  voice?: string;
  speed?: number;
  format?: 'mp3' | 'oggopus';
  preset?: TtsPreset;
}): Promise<AssistantAudio | null> {
  const normalizedText = normalizeTtsText(params.text);
  if (!normalizedText) return null;

  const presetName = params.preset ?? resolveTtsPreset(process.env.TTS_PRESET);
  const preset = presetName ? TTS_PRESETS[presetName] : null;
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
        lang: params.lang ?? 'ru-RU',
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
      }
    );

    if (response.data.status !== 'success' || !response.data.audioBase64) {
      return null;
    }

    return {
      audioBase64: response.data.audioBase64,
      mimeType: response.data.mimeType || 'audio/mpeg',
      format: response.data.format,
    };
  } catch (error: unknown) {
    logger.warn('Failed to synthesize assistant audio, fallback to text-only response:', error);
    return null;
  }
}
