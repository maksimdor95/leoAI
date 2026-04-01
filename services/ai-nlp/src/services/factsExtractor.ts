/**
 * Facts Extractor
 * Простая логика для извлечения ключевых данных из сообщений
 * В будущем можно заменить на более умный NER/NLP
 */

import { ExtractedFacts } from '../types/ai';

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function extractFactsFromText(text: string): ExtractedFacts {
  const facts: ExtractedFacts = {};

  const emailMatch = text.match(EMAIL_REGEX);
  if (emailMatch) {
    facts.email = emailMatch[0];
  }

  // Примечание: Извлечение навыков, опыта и предпочтений выполняется через
  // AI/NLP агентов (Profile Analyst Agent) в процессе диалога,
  // а не через простой regex-based extraction

  return facts;
}
