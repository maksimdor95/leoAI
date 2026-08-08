/**
 * Layer 3: LLM rerank shortlist после rule-based matchJobs.
 * Fail-open + ограниченный timeout — матч не блокируется надолго.
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
/** Меньше jobs → меньше tokens → реже timeout (было 12). */
const RERANK_TOP_N = Math.min(20, Math.max(5, Number(process.env.MATCH_LLM_RERANK_TOP_N || 8)));
const RERANK_TIMEOUT_MS = Math.min(
  20000,
  Math.max(3000, Number(process.env.MATCH_LLM_RERANK_TIMEOUT_MS || 18000))
);
/** Короткий snippet: быстрее и стабильнее YandexGPT (было 800). */
const JOB_SNIPPET_MAX = 480;

export type LlmRerankStatus = 'applied' | 'skipped' | 'failed' | 'disabled' | 'empty';

export type LlmRerankMeta = {
  status: LlmRerankStatus;
  authPresent: boolean;
  topN: number;
  durationMs: number;
  explainCount?: number;
  reason?: string;
};

export type LlmRerankResult = {
  matches: MatchingScore[];
  meta: LlmRerankMeta;
};

export function isMatchLlmRerankEnabled(): boolean {
  return RERANK_ENABLED;
}

export function getMatchLlmRerankTopN(): number {
  return RERANK_TOP_N;
}

export function getMatchLlmRerankTimeoutMs(): number {
  return RERANK_TIMEOUT_MS;
}

/** Bearer header из raw JWT / уже с префиксом. */
export function buildBearerAuthorization(authToken?: string): string | undefined {
  if (!authToken || !authToken.trim()) return undefined;
  const t = authToken.trim();
  return t.startsWith('Bearer ') ? t : `Bearer ${t}`;
}

function buildRedFlags(data: CollectedData | null): string[] {
  if (!data) return [];
  const enriched = getEnrichedFromCollected(data as Record<string, unknown>);
  const flags = [...(enriched?.job_preferences?.red_flags ?? [])];
  if (typeof data.additional_info === 'string' && data.additional_info.trim()) {
    flags.push(data.additional_info.trim());
  }
  return [...new Set(flags.map((f) => String(f).trim()).filter(Boolean))].slice(0, 8);
}

/** JD snippet для LLM: description + requirements, с резервом под требования и skills. */
export function buildJobRerankSnippet(job: {
  description?: string;
  requirements?: string;
  skills?: string[];
}): string {
  const skillsPart = (job.skills || []).slice(0, 8).join(', ').trim();
  const reqPart = (job.requirements || '').trim().slice(0, 180);
  const reserved = (reqPart ? reqPart.length + 1 : 0) + (skillsPart ? skillsPart.length + 1 : 0);
  const descBudget = Math.max(120, JOB_SNIPPET_MAX - reserved);
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

function baseMeta(
  authPresent: boolean,
  status: LlmRerankStatus,
  durationMs: number,
  extra?: Partial<LlmRerankMeta>
): LlmRerankMeta {
  return {
    status,
    authPresent,
    topN: RERANK_TOP_N,
    durationMs,
    ...extra,
  };
}

/**
 * Rerank top-N recommended matches via ai-nlp. Fail-open → исходный список.
 */
export async function llmRerankRecommended(
  matches: MatchingScore[],
  collectedData: CollectedData | null,
  authToken?: string
): Promise<LlmRerankResult> {
  const authPresent = Boolean(authToken && authToken.trim());
  const started = Date.now();

  if (!RERANK_ENABLED) {
    return {
      matches,
      meta: baseMeta(authPresent, 'disabled', Date.now() - started, { reason: 'MATCH_LLM_RERANK=false' }),
    };
  }

  if (matches.length < 2 || !collectedData) {
    return {
      matches,
      meta: baseMeta(authPresent, 'skipped', Date.now() - started, {
        reason: matches.length < 2 ? 'too_few_matches' : 'no_profile',
      }),
    };
  }

  const head = matches.slice(0, RERANK_TOP_N);
  const tail = matches.slice(RERANK_TOP_N);
  const profileSummary = buildProfileEmbeddingText(collectedData);
  if (profileSummary.trim().length < 20) {
    return {
      matches,
      meta: baseMeta(authPresent, 'skipped', Date.now() - started, { reason: 'profile_too_short' }),
    };
  }

  const experienceHighlights = buildExperienceHighlights(collectedData, 3);
  const authorization = buildBearerAuthorization(authToken);

  try {
    const response = await axios.post(
      `${AI_NLP_URL}/api/ai/match-rerank`,
      {
        profileSummary: profileSummary.slice(0, 2200),
        experienceHighlights,
        redFlags: buildRedFlags(collectedData),
        jobs: head.map((m) => ({
          id: m.job.id,
          title: m.job.title,
          company: m.job.company,
          score: m.score,
          reasons: m.reasons.slice(0, 3),
          matchedSkills: m.matchedSkills?.slice(0, 4) ?? [],
          missingSkills: m.missingSkills?.slice(0, 3) ?? [],
          snippet: buildJobRerankSnippet(m.job),
        })),
      },
      {
        timeout: RERANK_TIMEOUT_MS,
        headers: authorization ? { Authorization: authorization } : undefined,
      }
    );

    const items = response.data?.items;
    if (!Array.isArray(items) || items.length === 0) {
      logger.warn(
        `LLM rerank returned empty items (fail-open) authPresent=${authPresent}`
      );
      return {
        matches,
        meta: baseMeta(authPresent, 'empty', Date.now() - started, { reason: 'empty_items' }),
      };
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
        `LLM rerank: 0/${typedItems.length} items have explain — deltas still applied authPresent=${authPresent}`
      );
    }

    const rerankedHead = applyLlmRerankDeltas(head, typedItems);
    const durationMs = Date.now() - started;

    logger.info(
      `LLM rerank applied to ${head.length} jobs (tail=${tail.length}, explain=${withExplain}/${typedItems.length}, ` +
        `authPresent=${authPresent}, ${durationMs}ms)`
    );

    return {
      matches: [...rerankedHead, ...tail],
      meta: baseMeta(authPresent, 'applied', durationMs, { explainCount: withExplain }),
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn(
      `LLM rerank failed (fail-open): ${reason} authPresent=${authPresent} durationMs=${durationMs}`
    );
    return {
      matches,
      meta: baseMeta(authPresent, 'failed', durationMs, { reason: reason.slice(0, 200) }),
    };
  }
}
