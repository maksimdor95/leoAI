/**
 * Layer 3: LLM rerank shortlist после rule-based matchJobs.
 * Fail-open + короткий timeout — матч не блокируется.
 */

import axios from 'axios';
import type { MatchingScore } from './matcher';
import type { CollectedData } from './userService';
import { getEnrichedFromCollected } from '../types/enrichedProfile';
import { buildProfileEmbeddingText } from './profileEmbedding';
import { logger } from '../utils/logger';

const AI_NLP_URL = process.env.AI_NLP_URL || 'http://localhost:3003';
const RERANK_ENABLED = (process.env.MATCH_LLM_RERANK || 'true').toLowerCase() !== 'false';
const RERANK_TOP_N = Math.min(20, Math.max(5, Number(process.env.MATCH_LLM_RERANK_TOP_N || 12)));
const RERANK_TIMEOUT_MS = Math.min(20000, Math.max(3000, Number(process.env.MATCH_LLM_RERANK_TIMEOUT_MS || 9000)));

export function isMatchLlmRerankEnabled(): boolean {
  return RERANK_ENABLED;
}

function buildRedFlags(data: CollectedData | null): string[] {
  if (!data) return [];
  const enriched = getEnrichedFromCollected(data as Record<string, unknown>);
  const flags = [...(enriched?.job_preferences?.red_flags ?? [])];
  if (typeof data.additional_info === 'string' && data.additional_info.trim()) {
    flags.push(data.additional_info.trim());
  }
  return [...new Set(flags.map((f) => String(f).trim()).filter(Boolean))].slice(0, 10);
}

/** Применяет delta/explain к shortlist. Экспорт для тестов. */
export function applyLlmRerankDeltas(
  matches: MatchingScore[],
  items: Array<{ id: string; delta?: number; explain?: string }>
): MatchingScore[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const adjusted = matches.map((m) => {
    const adj = byId.get(m.job.id);
    if (!adj) return m;
    const delta =
      typeof adj.delta === 'number' && Number.isFinite(adj.delta)
        ? Math.max(-12, Math.min(12, Math.round(adj.delta)))
        : 0;
    const score = Math.max(0, Math.min(100, m.score + delta));
    const reasons = [...m.reasons];
    if (adj.explain && adj.explain.trim()) {
      reasons.unshift(`AI: ${adj.explain.trim()}`);
    } else if (delta !== 0) {
      reasons.unshift(delta > 0 ? `AI: +${delta} к fit` : `AI: ${delta} к fit`);
    }
    return { ...m, score, reasons };
  });

  return adjusted.sort((a, b) => b.score - a.score);
}

/**
 * Rerank top-N recommended matches via ai-nlp. Fail-open → исходный список.
 */
export async function llmRerankRecommended(
  matches: MatchingScore[],
  collectedData: CollectedData | null,
  authToken?: string
): Promise<MatchingScore[]> {
  if (!RERANK_ENABLED || matches.length < 2 || !collectedData) {
    return matches;
  }

  const head = matches.slice(0, RERANK_TOP_N);
  const tail = matches.slice(RERANK_TOP_N);
  const profileSummary = buildProfileEmbeddingText(collectedData);
  if (profileSummary.trim().length < 20) {
    return matches;
  }

  try {
    const response = await axios.post(
      `${AI_NLP_URL}/api/ai/match-rerank`,
      {
        profileSummary,
        redFlags: buildRedFlags(collectedData),
        jobs: head.map((m) => ({
          id: m.job.id,
          title: m.job.title,
          company: m.job.company,
          score: m.score,
          reasons: m.reasons.slice(0, 4),
          snippet: `${m.job.description || ''}`.slice(0, 280),
        })),
      },
      {
        timeout: RERANK_TIMEOUT_MS,
        headers: authToken
          ? { Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}` }
          : undefined,
      }
    );

    const items = response.data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return matches;
    }

    const rerankedHead = applyLlmRerankDeltas(
      head,
      items.filter(
        (i: unknown): i is { id: string; delta?: number; explain?: string } =>
          typeof i === 'object' &&
          i !== null &&
          typeof (i as { id?: unknown }).id === 'string'
      )
    );

    logger.info(
      `LLM rerank applied to ${head.length} jobs (tail=${tail.length})`
    );
    return [...rerankedHead, ...tail];
  } catch (err) {
    logger.warn(
      `LLM rerank failed (fail-open): ${err instanceof Error ? err.message : String(err)}`
    );
    return matches;
  }
}
