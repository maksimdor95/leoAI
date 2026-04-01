/**
 * API request/response types for AI/NLP service
 */

import { AIMessage, AIResponse, ExtractedFacts } from './ai';

export interface ProcessMessageRequest {
  sessionId: string;
  userId: string;
  message: string;
  history?: AIMessage[];
  metadata?: Record<string, unknown>;
}

export interface ProcessMessageResponse {
  status: 'success';
  sessionId: string;
  userId: string;
  aiMessage: AIResponse;
  facts?: ExtractedFacts;
}

export interface ErrorResponse {
  status: 'error';
  message: string;
  details?: unknown;
}
