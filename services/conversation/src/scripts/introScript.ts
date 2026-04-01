import { v4 as uuidv4 } from 'uuid';
import { MessageRole, MessageType, QuestionMessage } from '../types/message';
import { addMessageToSession } from '../services/sessionService';
import { logger } from '../utils/logger';

const INTRO_GREETING_QUESTION =
  'Здравствуйте! Я LEO, AI-помощник по подбору вакансий. За пару минут задам несколько вопросов, чтобы подобрать для вас подходящие позиции. Готовы начать?';

const INTRO_FOLLOW_UP_QUESTION = 'Какую должность вы сейчас рассматриваете?';
const INTRO_FOLLOW_UP_PLACEHOLDER =
  'Например: продуктовый аналитик, HR-менеджер, руководитель отдела продаж';

export function buildIntroGreetingMessage(sessionId: string): QuestionMessage {
  return {
    id: uuidv4(),
    type: MessageType.QUESTION,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId,
    question: INTRO_GREETING_QUESTION,
    placeholder: 'Напишите ваш ответ или задайте свой вопрос LEO...',
  };
}

export function buildIntroFollowUpMessage(sessionId: string): QuestionMessage {
  return {
    id: uuidv4(),
    type: MessageType.QUESTION,
    role: MessageRole.ASSISTANT,
    timestamp: new Date().toISOString(),
    sessionId,
    question: INTRO_FOLLOW_UP_QUESTION,
    placeholder: INTRO_FOLLOW_UP_PLACEHOLDER,
  };
}

/**
 * Seed a newly created session with intro messages based on the scenario.
 */
export async function seedIntroScript(sessionId: string): Promise<void> {
  try {
    const greetingQuestion = buildIntroGreetingMessage(sessionId);
    await addMessageToSession(sessionId, greetingQuestion);

    logger.info(`Session ${sessionId} seeded with intro greeting.`);
  } catch (error: unknown) {
    logger.error(`Failed to seed intro script for session ${sessionId}:`, error);
  }
}
