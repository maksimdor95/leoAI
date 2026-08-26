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

type CareerTrackRef = {
  id: string;
  name?: string;
  target_role?: string | null;
  is_default?: boolean;
};

/** Persist key: links a chat session to a career track (persona). */
export const CAREER_TRACK_ID_KEY = 'career_track_id';

function normalizeRoleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\/|,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trackLabelFromFields(
  fields: Record<string, unknown>,
  enriched: EnrichedProfile
): { label: string; roleFamily?: string } {
  const desired =
    (typeof fields.desired_role === 'string' && fields.desired_role.trim()) ||
    (typeof fields.desiredRole === 'string' && fields.desiredRole.trim()) ||
    enriched.job_preferences?.target_role?.trim() ||
    '';
  const roleFamily =
    (typeof enriched.role_family === 'string' && enriched.role_family.trim()) ||
    (typeof fields.role_family === 'string' && fields.role_family.trim()) ||
    undefined;
  const label = desired || roleFamily || 'Основной';
  return { label, roleFamily };
}

function shortTrackName(label: string, roleFamily?: string): string {
  if (roleFamily) {
    const pretty = roleFamily.charAt(0).toUpperCase() + roleFamily.slice(1);
    return pretty.slice(0, 80);
  }
  const first = label.split(/[\/|,]/)[0]?.trim() || label;
  return first.slice(0, 80) || 'Направление';
}

function tracksMatchRole(
  track: CareerTrackRef,
  label: string,
  roleFamily?: string
): boolean {
  const needle = normalizeRoleKey(label);
  const nameKey = normalizeRoleKey(track.name || '');
  const targetKey = normalizeRoleKey(track.target_role || '');
  if (needle && (nameKey === needle || targetKey === needle)) return true;
  if (needle && (nameKey.includes(needle) || targetKey.includes(needle) || needle.includes(nameKey))) {
    return nameKey.length >= 3 || targetKey.length >= 3;
  }
  if (roleFamily) {
    const fam = normalizeRoleKey(roleFamily);
    if (nameKey === fam || targetKey === fam) return true;
    if (nameKey.includes(fam) || targetKey.includes(fam)) return true;
  }
  return false;
}

/**
 * Resolve career track for this chat persona:
 * 1) session-linked track id
 * 2) match existing track by desired role / role_family
 * 3) reuse sole empty «Основной» track
 * 4) create a new track (does not steal default if others exist)
 */
async function resolveOrCreateTrackForRole(
  token: string,
  fields: Record<string, unknown>,
  enriched: EnrichedProfile
): Promise<{ id: string } | null> {
  const auth = { headers: { Authorization: toBearer(token) }, timeout: 8000 };
  const tracksRes = await axios.get(`${USER_PROFILE_URL}/api/career/tracks`, auth);
  const tracks = (tracksRes.data?.tracks as CareerTrackRef[] | undefined) ?? [];

  const linkedId =
    typeof fields[CAREER_TRACK_ID_KEY] === 'string' ? (fields[CAREER_TRACK_ID_KEY] as string) : null;
  if (linkedId) {
    const linked = tracks.find((t) => t.id === linkedId);
    if (linked?.id) return { id: linked.id };
  }

  const { label, roleFamily } = trackLabelFromFields(fields, enriched);
  const matched = tracks.find((t) => tracksMatchRole(t, label, roleFamily));
  if (matched?.id) return { id: matched.id };

  // Claim the sole track only when it is an empty shell. A generic name like
  // «Основной» with an existing target_role is already a persona — create another.
  if (tracks.length === 1) {
    const only = tracks[0];
    const emptyTarget = !only.target_role || !String(only.target_role).trim();
    const isGenericName =
      !only.name ||
      normalizeRoleKey(only.name) === 'основной' ||
      normalizeRoleKey(only.name) === 'main';
    if (emptyTarget && isGenericName) {
      try {
        await axios.patch(
          `${USER_PROFILE_URL}/api/career/tracks/${only.id}`,
          { name: shortTrackName(label, roleFamily), target_role: label },
          auth
        );
      } catch (err) {
        logger.warn('[profile-enrichment] failed to rename sole track:', err);
      }
      return { id: only.id };
    }
  }

  if (tracks.length === 0) {
    const created = await axios.post(
      `${USER_PROFILE_URL}/api/career/tracks`,
      {
        name: shortTrackName(label, roleFamily),
        target_role: label === 'Основной' ? undefined : label,
        is_default: true,
      },
      auth
    );
    const track = created.data?.track as { id?: string } | undefined;
    return track?.id ? { id: track.id } : null;
  }

  const created = await axios.post(
    `${USER_PROFILE_URL}/api/career/tracks`,
    {
      name: shortTrackName(label, roleFamily),
      target_role: label,
      is_default: false,
    },
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
): Promise<string | null> {
  const track = await resolveOrCreateTrackForRole(token, fields, enriched);
  if (!track?.id) {
    logger.warn('[profile-enrichment] skip persist: no career track');
    return null;
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

  return track.id;
}

/**
 * Enrich profile snapshot and persist. Fail-open: returns null on error.
 *
 * Redis write is merge-only (`updateSessionMetadata` on `__enriched` / optional `starBank`).
 * Callers must NOT `updateSession(staleSnapshot)` after this — that race wiped gap answers
 * (e.g. desired_salary) and reset currentStepId back to resume_ready mid «Уточнить пустые поля».
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

  const snapshotCollected = { ...(session.metadata.collectedData as Record<string, unknown>) };
  const source: EnrichedProfile['source'] =
    trigger === 'merge_collected' || trigger === 'resume_ready'
      ? 'resume_import'
      : 'jack-profile-v2';

  try {
    logger.info(`[profile-enrichment] start trigger=${trigger} session=${session.id}`);

    const ruleSignals = await fetchRuleSignals(snapshotCollected, authToken);
    const missingSkillsTop = await fetchMissingSkillsTop(session.userId, authToken);
    const enriched = await fetchLlmEnrichment(
      {
        collectedData: snapshotCollected,
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

    // Dynamic import avoids sessionService ↔ dialogueEngine ↔ this module cycles.
    const { getSession, updateSessionMetadata } = await import('./sessionService');
    const live = await getSession(session.id);
    const liveCollected = {
      ...((live?.metadata.collectedData ?? session.metadata.collectedData) as Record<
        string,
        unknown
      >),
    };
    const beforeStarBank = liveCollected.starBank;
    liveCollected[ENRICHED_COLLECTED_KEY] = enriched;
    seedStarBankFromAchievements(liveCollected, enriched.achievements_with_metrics);

    const patch: Record<string, unknown> = {
      [ENRICHED_COLLECTED_KEY]: enriched,
    };
    if (liveCollected.starBank !== beforeStarBank) {
      patch.starBank = liveCollected.starBank;
    }

    session.metadata.collectedData = {
      ...session.metadata.collectedData,
      ...patch,
    };

    // Merge-only Redis write: preserves concurrent gap answers / currentStepId / flags.
    await updateSessionMetadata(session.id, { collectedData: patch });

    const fresh = await getSession(session.id);
    const fieldsForPersist = {
      ...((fresh?.metadata.collectedData ?? liveCollected) as Record<string, unknown>),
    };
    const trackId = await persistProfileData(
      session.userId,
      authToken,
      enriched,
      fieldsForPersist
    );

    if (trackId && fieldsForPersist[CAREER_TRACK_ID_KEY] !== trackId) {
      await updateSessionMetadata(session.id, {
        collectedData: { [CAREER_TRACK_ID_KEY]: trackId },
      });
      session.metadata.collectedData = {
        ...session.metadata.collectedData,
        [CAREER_TRACK_ID_KEY]: trackId,
      };
    }

    logger.info(
      `[profile-enrichment] done trigger=${trigger} family=${enriched.role_family ?? 'n/a'} track=${trackId ?? 'n/a'} completeness=${enriched.profile_completeness ?? 'n/a'}`
    );
    return enriched;
  } catch (error: unknown) {
    logger.warn(`[profile-enrichment] fail-open trigger=${trigger}:`, error);
    return null;
  }
}

function skillLabelsFromCollected(collected: Record<string, unknown>): string[] {
  if (Array.isArray(collected.medSkillLabels)) {
    return collected.medSkillLabels
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim());
  }
  if (typeof collected.skills_hard === 'string' && collected.skills_hard.trim()) {
    return collected.skills_hard
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * LEO Med saves to med_specialists (job-matching). Also mirror a career track
 * so /account track switcher shows the medical persona alongside Product/etc.
 * Fail-open: never throws.
 */
export async function persistMedCareerTrack(
  session: ConversationSession,
  authToken: string | undefined
): Promise<string | null> {
  if (!authToken) {
    logger.warn('[profile-enrichment] med track skip: no auth token');
    return null;
  }

  try {
    const collected = { ...(session.metadata.collectedData as Record<string, unknown>) };
    const medRoleTitle =
      (typeof collected.medRoleTitle === 'string' && collected.medRoleTitle.trim()) ||
      (typeof collected.desired_role === 'string' && collected.desired_role.trim()) ||
      'Медицина';
    const city =
      typeof collected.desired_location === 'string' && collected.desired_location.trim()
        ? collected.desired_location.trim()
        : undefined;
    const skillLabels = skillLabelsFromCollected(collected);
    const experience =
      typeof collected.careerSummary === 'string' && collected.careerSummary.trim()
        ? collected.careerSummary.trim()
        : undefined;

    const fields: Record<string, unknown> = {
      ...collected,
      desired_role: medRoleTitle,
      role_family: 'medicine',
      ...(skillLabels.length > 0 ? { skills_hard: skillLabels.join(', ') } : {}),
    };

    const enriched: EnrichedProfile = {
      version: 1,
      enrichedAt: new Date().toISOString(),
      source: 'manual',
      role_family: 'medicine',
      job_preferences: {
        target_role: medRoleTitle,
        domains: ['medicine', 'healthcare'],
        ...(city ? { locations: [city] } : {}),
      },
      normalized_skills: skillLabels.slice(0, 20).map((name) => ({
        name,
        source: 'chat' as const,
        level: 'intermediate' as const,
      })),
      profile_completeness: Math.min(
        0.95,
        0.45 + (skillLabels.length > 0 ? 0.2 : 0) + (experience ? 0.15 : 0) + (city ? 0.1 : 0)
      ),
      market_fit_summary: experience
        ? `Медицинский профиль: ${medRoleTitle}. ${experience.slice(0, 280)}`
        : `Медицинский профиль: ${medRoleTitle}. Продолжите в чате LEO Med, чтобы уточнить опыт и документы.`,
      next_actions: ['Открыть вакансии LEO Med', 'Уточнить документы и город в чате'],
    };

    const trackId = await persistProfileData(session.userId, authToken, enriched, fields);
    if (!trackId) return null;

    const { updateSessionMetadata } = await import('./sessionService');
    const patch: Record<string, unknown> = {
      [CAREER_TRACK_ID_KEY]: trackId,
      [ENRICHED_COLLECTED_KEY]: enriched,
      desired_role: medRoleTitle,
    };
    await updateSessionMetadata(session.id, { collectedData: patch });
    session.metadata.collectedData = {
      ...session.metadata.collectedData,
      ...patch,
    };

    logger.info(
      `[profile-enrichment] med track saved session=${session.id} track=${trackId} role=${medRoleTitle}`
    );
    return trackId;
  } catch (error: unknown) {
    logger.warn(`[profile-enrichment] med track fail-open:`, error);
    return null;
  }
}
