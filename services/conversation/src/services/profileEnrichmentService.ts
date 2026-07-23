/**
 * Orchestrates profile enrichment: job-matching rules + ai-nlp LLM + user-profile persistence.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import type { ConversationSession } from '../types/session';
import {
  ENRICHED_COLLECTED_KEY,
  type EnrichedProfile,
} from '../types/enrichedProfile';

const JOB_MATCHING_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';
const AI_NLP_URL = process.env.AI_NLP_SERVICE_URL || 'http://localhost:3003';
const USER_PROFILE_URL = process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3001';

export type EnrichmentTrigger =
  | 'profile_snapshot'
  | 'resume_ready'
  | 'desired_start'
  | 'merge_collected';

function toBearer(token: string): string {
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

function parseExperienceYears(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = parseFloat(value.replace(/,/g, '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function seedStarBankFromAchievements(
  collectedData: Record<string, unknown>,
  achievements: EnrichedProfile['achievements_with_metrics']
): void {
  if (!achievements?.length) return;
  const existing = collectedData.starBank;
  if (Array.isArray(existing) && existing.length > 0) return;

  const now = new Date().toISOString();
  collectedData.starBank = achievements.slice(0, 5).map((a, index) => {
    const metricLine =
      a.metric_after && a.metric_before
        ? `Результат: ${a.metric_before} → ${a.metric_after}${a.timeframe ? ` (${a.timeframe})` : ''}`
        : '';
    const userMessage = [a.achievement, metricLine].filter(Boolean).join('\n');
    return {
      id: `profile-enrichment:${index}:${Date.now()}`,
      role: a.role ?? a.company,
      userMessage,
      savedAt: now,
      source: 'profile_enrichment',
    };
  });
}

async function fetchMissingSkillsTop(userId: string, token: string): Promise<string[]> {
  try {
    const res = await axios.get(`${JOB_MATCHING_URL}/api/jobs/match/${userId}`, {
      headers: { Authorization: toBearer(token) },
      timeout: 15000,
    });
    const top = res.data?.profileSignals?.missingSkillsTop;
    if (!Array.isArray(top)) return [];
    return top.filter((skill): skill is string => typeof skill === 'string').slice(0, 5);
  } catch {
    return [];
  }
}

async function fetchRuleSignals(
  collectedData: Record<string, unknown>,
  token: string
): Promise<Partial<EnrichedProfile>> {
  const res = await axios.post(
    `${JOB_MATCHING_URL}/api/jobs/derive-profile-signals`,
    { collectedData },
    {
      headers: { Authorization: toBearer(token) },
      timeout: 12000,
    }
  );
  return (res.data?.signals ?? {}) as Partial<EnrichedProfile>;
}

async function fetchLlmEnrichment(
  params: {
    collectedData: Record<string, unknown>;
    ruleSignals: Partial<EnrichedProfile>;
    completedSteps: string[];
    currentStepId: string;
    source: EnrichedProfile['source'];
    marketContext?: { missingSkillsTop?: string[]; role_family?: string | null };
  },
  token: string
): Promise<EnrichedProfile> {
  const res = await axios.post(
    `${AI_NLP_URL}/api/ai/enrich-profile`,
    {
      collectedData: params.collectedData,
      ruleSignals: params.ruleSignals,
      phase: 'all',
      completedSteps: params.completedSteps,
      currentStepId: params.currentStepId,
      source: params.source,
      marketContext: params.marketContext,
    },
    {
      headers: { Authorization: toBearer(token) },
      timeout: 45000,
    }
  );
  return res.data.enriched as EnrichedProfile;
}

async function resolveOrCreateDefaultTrack(
  token: string
): Promise<{ id: string } | null> {
  const auth = { headers: { Authorization: toBearer(token) }, timeout: 8000 };
  const tracksRes = await axios.get(`${USER_PROFILE_URL}/api/career/tracks`, auth);
  const tracks = tracksRes.data?.tracks as Array<{ id: string; is_default?: boolean }> | undefined;
  const existing = tracks?.find((t) => t.is_default) ?? tracks?.[0];
  if (existing?.id) return existing;

  const created = await axios.post(
    `${USER_PROFILE_URL}/api/career/tracks`,
    { name: 'Основной', is_default: true },
    auth
  );
  const track = created.data?.track as { id?: string } | undefined;
  return track?.id ? { id: track.id } : null;
}

async function persistProfileData(
  userId: string,
  token: string,
  enriched: EnrichedProfile,
  fields: Record<string, unknown>
): Promise<void> {
  const track = await resolveOrCreateDefaultTrack(token);
  if (!track?.id) {
    logger.warn('[profile-enrichment] skip persist: no career track');
    return;
  }

  await axios.put(
    `${USER_PROFILE_URL}/api/career/tracks/${track.id}/profile-data`,
    {
      profile_data: { enriched, fields },
    },
    {
      headers: { Authorization: toBearer(token) },
      timeout: 10000,
    }
  );

  const targetRole =
    enriched.job_preferences?.target_role ||
    (typeof fields.desired_role === 'string' ? fields.desired_role : undefined) ||
    (typeof fields.desiredRole === 'string' ? fields.desiredRole : undefined);
  const expYears = parseExperienceYears(fields.totalExperience);

  if (targetRole || expYears != null) {
    await axios.post(
      `${USER_PROFILE_URL}/api/career/profile`,
      {
        track_id: track.id,
        target_role: targetRole,
        experience_years: expYears,
      },
      {
        headers: { Authorization: toBearer(token) },
        timeout: 10000,
      }
    );
  }
}

/**
 * Enrich profile snapshot and persist. Fail-open: returns null on error.
 */
export async function enrichAndPersistProfile(
  session: ConversationSession,
  authToken: string | undefined,
  trigger: EnrichmentTrigger
): Promise<EnrichedProfile | null> {
  if (!authToken) {
    logger.warn(`[profile-enrichment] skip (${trigger}): no auth token`);
    return null;
  }

  const collectedData = { ...(session.metadata.collectedData as Record<string, unknown>) };
  const source: EnrichedProfile['source'] =
    trigger === 'merge_collected' || trigger === 'resume_ready'
      ? 'resume_import'
      : 'jack-profile-v2';

  try {
    logger.info(`[profile-enrichment] start trigger=${trigger} session=${session.id}`);

    const ruleSignals = await fetchRuleSignals(collectedData, authToken);
    const missingSkillsTop = await fetchMissingSkillsTop(session.userId, authToken);
    const enriched = await fetchLlmEnrichment(
      {
        collectedData,
        ruleSignals,
        completedSteps: session.metadata.completedSteps ?? [],
        currentStepId: session.metadata.currentStepId ?? 'profile_snapshot',
        source,
        marketContext: {
          role_family: ruleSignals.role_family ?? null,
          missingSkillsTop,
        },
      },
      authToken
    );

    collectedData[ENRICHED_COLLECTED_KEY] = enriched;
    seedStarBankFromAchievements(collectedData, enriched.achievements_with_metrics);
    session.metadata.collectedData = collectedData;

    await persistProfileData(session.userId, authToken, enriched, collectedData);

    logger.info(
      `[profile-enrichment] done trigger=${trigger} family=${enriched.role_family ?? 'n/a'} completeness=${enriched.profile_completeness ?? 'n/a'}`
    );
    return enriched;
  } catch (error: unknown) {
    logger.warn(`[profile-enrichment] fail-open trigger=${trigger}:`, error);
    return null;
  }
}
