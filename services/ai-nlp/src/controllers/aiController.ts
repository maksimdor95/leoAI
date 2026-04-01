/**
 * AI Controller
 * HTTP endpoint for processing user messages via YandexGPT
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import {
  buildSystemMessage,
  buildUserMessage,
  buildAssistantMessage,
} from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { appendToHistory, getHistory, saveHistory, updateFacts } from '../services/contextService';
import { extractFactsFromText } from '../services/factsExtractor';
import { ProcessMessageResponse } from '../types/request';
import { ExtractedFacts } from '../types/ai';
import { logger } from '../utils/logger';

type ZodError = {
  issues: unknown;
};

const hasIssues = (error: unknown): error is ZodError =>
  typeof error === 'object' && error !== null && 'issues' in error;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Failed to process message';

const requestSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  message: z.string().min(1, 'Message cannot be empty'),
  history: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        text: z.string().min(1),
      })
    )
    .optional(),
});

export async function processMessage(req: Request, res: Response) {
  try {
    const parsed = requestSchema.parse(req.body);
    const { sessionId, userId, message, history: providedHistory } = parsed;

    const history = providedHistory ?? (await getHistory(sessionId));

    if (providedHistory) {
      await saveHistory(sessionId, providedHistory);
    }

    const requestMessages = [buildSystemMessage(), ...history, buildUserMessage(message)];

    const aiResponse = await callYandexModel({
      sessionId,
      userId,
      messages: requestMessages,
    });

    const assistantMessage = buildAssistantMessage(aiResponse.message.text);

    await appendToHistory(sessionId, buildUserMessage(message));
    await appendToHistory(sessionId, assistantMessage);

    const userFacts = extractFactsFromText(message);
    const assistantFacts = extractFactsFromText(aiResponse.message.text);
    const combinedFacts = { ...userFacts, ...assistantFacts };

    let facts: ExtractedFacts | undefined;
    if (Object.keys(combinedFacts).length > 0) {
      facts = await updateFacts(sessionId, combinedFacts);
    }

    const responseBody: ProcessMessageResponse = {
      status: 'success',
      sessionId,
      userId,
      aiMessage: aiResponse,
      facts,
    };

    res.json(responseBody);
  } catch (error: unknown) {
    logger.error('AI processing error:', error);
    if (hasIssues(error)) {
      res.status(400).json({ status: 'error', message: 'Invalid request', details: error.issues });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: getErrorMessage(error),
    });
  }
}
