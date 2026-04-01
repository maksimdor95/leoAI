/**
 * Types for interacting with YandexGPT models
 */

export type AIRole = 'system' | 'user' | 'assistant';

export interface AIMessage {
  role: AIRole;
  text: string;
}

export interface AICompletionOptions {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIRequest {
  sessionId: string;
  userId: string;
  messages: AIMessage[];
  completionOptions?: AICompletionOptions;
  metadata?: Record<string, unknown>;
}

export interface AIResponse {
  message: AIMessage;
  usage?: {
    inputTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  raw?: unknown;
}

export interface ExtractedFacts {
  email?: string;
  skills?: string[];
  experience?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}
