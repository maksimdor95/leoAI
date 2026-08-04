/**
 * Layer 3: LLM rerank shortlist после rule-based matchJobs.
 * Fail-open + короткий timeout — матч не блокируется.
 */

import axios from 'axios';
import type { MatchingScore } from './matcher';
import type { CollectedData } from './userService';
import { getEnrichedFromCollected } from '../types/enrichedProfile';
import { buildProfileEmbeddingText } from './profileEmbedding';
import { buildExperienceHighlights } from './experienceSignals';
import { logger } from '../utils/logger';

const AI_NLP_URL = process.env.AI_NLP_URL || 'http://localhost:3003';
const RERANK_ENABLED = (process.env.MATCH_LLM_RERANK || 'true').toLowerCase() !== 'false';
const RERANK_TOP_N = Math.min(20, Math.max(5, Number(process.env.MATCH_LLM_RERANK_TOP_N || 12)));
const RERANK_TIMEOUT_MS = Math.min(
  20000,
  Math.max(3000, Number(process.env.MATCH_LLM_RERANK_TIMEOUT_MS || 9000))
);
const JOB_SNIPPET_MAX = 800;

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

/** JD snippet для LLM: description + requirements, с резервом под требования и skills. */
export function buildJobRerankSnippet(job: {
  description?: string;
  requirements?: string;
  skills?: string[];
}): string {
  const skillsPart = (job.skills || []).slice(0, 12).join(', ').trim();
  const reqPart = (job.requirements || '').trim().slice(0, 280);
  const reserved = (reqPart ? reqPart.length + 1 : 0) + (skillsPart ? skillsPart.length + 1 : 0);
  const descBudget = Math.max(200, JOB_SNIPPET_MAX - reserved);
  const descPart = (job.description || '').trim().slice(0, descBudget);
  return [descPart, reqPart, skillsPart].filter(Boolean).join('\n').slice(0, JOB_SNIPPET_MAX);
}

function humanDeltaExplain(delta: number): string {
  if (delta > 0) {
    return `AI: выше по fit опыта и обязанностей (+${delta})`;
  }
  return `AI: слабее по fit опыта и обязанностей (${delta})`;
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
      reasons.unshift(humanDeltaExplain(delta));
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

  const experienceHighlights = buildExperienceHighlights(collectedData, 4);

  try {
    const response = await axios.post(
      `${AI_NLP_URL}/api/ai/match-rerank`,
      {
        profileSummary,
        experienceHighlights,
        redFlags: buildRedFlags(collectedData),
        jobs: head.map((m) => ({
          id: m.job.id,
          title: m.job.title,
          company: m.job.company,
          score: m.score,
          reasons: m.reasons.slice(0, 5),
          matchedSkills: m.matchedSkills?.slice(0, 5) ?? [],
          missingSkills: m.missingSkills?.slice(0, 4) ?? [],
          snippet: buildJobRerankSnippet(m.job),
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
      logger.warn('LLM rerank returned empty items (fail-open)');
      return matches;
    }

    const typedItems = items.filter(
      (i: unknown): i is { id: string; delta?: number; explain?: string } =>
        typeof i === 'object' &&
        i !== null &&
        typeof (i as { id?: unknown }).id === 'string'
    );

    const withExplain = typedItems.filter((i) => i.explain && String(i.explain).trim()).length;
    if (withExplain === 0) {
      logger.warn(
        `LLM rerank: 0/${typedItems.length} items have explain — deltas still applied`
      );
    }

    const rerankedHead = applyLlmRerankDeltas(head, typedItems);

    logger.info(
      `LLM rerank applied to ${head.length} jobs (tail=${tail.length}, explain=${withExplain}/${typedItems.length})`
    );
    return [...rerankedHead, ...tail];
  } catch (err) {
    logger.warn(
      `LLM rerank failed (fail-open): ${err instanceof Error ? err.message : String(err)}`
    );
    return matches;
  }
}
