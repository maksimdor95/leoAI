/**
 * Profile Enrichment Controller — LLM layers for enriched profile snapshot.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { buildSystemMessage, buildUserMessage } from '../services/promptService';
import { callYandexModel } from '../services/yandexClient';
import { logger } from '../utils/logger';
import {
  buildProfileEnrichmentSystemPrompt,
  buildProfileEnrichmentUserPrompt,
  mergeEnrichmentLlmPhase1,
} from '../prompts/profileEnrichmentPrompt';
import { runProfileAnalysis } from './profileController';
import type { EnrichedProfile } from '../types/enrichedProfile';
import { toSecondPersonMarketFit } from '../utils/marketFitCopy';

const COMPLETENESS_SLOTS: Array<{
  id: string;
  label: string;
  check: (data: Record<string, unknown>) => boolean;
}> = [
  {
    id: 'career',
    label: 'обзор карьеры',
    check: (d) => isFilled(d.careerSummary),
  },
  {
    id: 'experience',
    label: 'общий опыт',
    check: (d) => isFilled(d.totalExperience),
  },
  {
    id: 'position',
    label: 'опыт / позиции',
    check: (d) =>
      isFilled(d.position_1_company) ||
      isFilled(d.position_1_role) ||
      (typeof d.careerSummary === 'string' && d.careerSummary.trim().length > 40),
  },
  {
    id: 'education',
    label: 'образование',
    check: (d) => isFilled(d.education_main) || isFilled(d.education),
  },
  {
    id: 'role',
    label: 'желаемая должность',
    check: (d) => isFilled(d.desired_role) || isFilled(d.desiredRole),
  },
  {
    id: 'skills',
    label: 'навыки',
    check: (d) => {
      if (isFilled(d.skills_hard) || isFilled(d.skills_soft)) return true;
      if (Array.isArray(d.skills) && d.skills.length > 0) return true;
      if (typeof d.skills === 'string' && d.skills.trim()) return true;
      return false;
    },
  },
  {
    id: 'location',
    label: 'локация и формат',
    check: (d) =>
      isFilled(d.desired_location) ||
      isFilled(d.workMode) ||
      isFilled(d.workFormat) ||
      (Array.isArray(d.location) && d.location.length > 0) ||
      isFilled(d.location),
  },
  {
    id: 'salary',
    label: 'ожидания по зарплате',
    check: (d) => isFilled(d.desired_salary) || isFilled(d.salaryExpectation),
  },
];

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Rule-based completeness — source of truth for UI (не доверяем LLM missingFields). */
export function computeCompleteness(collectedData: Record<string, unknown>): {
  profile_completeness: number;
  missing_fields: string[];
} {
  const missing: string[] = [];
  for (const slot of COMPLETENESS_SLOTS) {
    if (!slot.check(collectedData)) missing.push(slot.label);
  }
  const ratio = 1 - missing.length / COMPLETENESS_SLOTS.length;
  return {
    profile_completeness: Math.max(0, Math.min(1, ratio)),
    missing_fields: missing.slice(0, 8),
  };
}

const enrichSchema = z.object({
  collectedData: z.record(z.unknown()).optional(),
  ruleSignals: z.record(z.unknown()).optional(),
  phase: z.union([z.literal(1), z.literal(4), z.literal(5), z.literal('all')]).optional(),
  completedSteps: z.array(z.string()).optional(),
  currentStepId: z.string().optional(),
  marketContext: z
    .object({
      missingSkillsTop: z.array(z.string()).optional(),
      role_family: z.string().nullable().optional(),
    })
    .optional(),
  source: z.enum(['jack-profile-v2', 'resume_import', 'manual']).optional(),
});

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function callEnrichmentLlm(
  phase: number,
  collectedData: Record<string, unknown>,
  ruleSignals?: Partial<EnrichedProfile>,
  marketContext?: { missingSkillsTop?: string[]; role_family?: string | null }
): Promise<Record<string, unknown>> {
  const system = buildProfileEnrichmentSystemPrompt(phase);
  const user = buildProfileEnrichmentUserPrompt(collectedData, ruleSignals, marketContext);
  const response = await callYandexModel({
    sessionId: `profile-enrichment-phase-${phase}`,
    userId: 'profile-enrichment',
    messages: [buildSystemMessage({ extraSections: [system] }), buildUserMessage(user)],
    completionOptions: {
      temperature: 0.2,
      maxTokens: phase === 4 ? 400 : 800,
    },
  });
  const content = response.message.text ?? '';
  return parseJsonObject(content) ?? {};
}

export async function enrichProfile(req: Request, res: Response): Promise<void> {
  try {
    const parsed = enrichSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }

    const collectedData = parsed.data.collectedData ?? {};
    const ruleSignals = (parsed.data.ruleSignals ?? {}) as Partial<EnrichedProfile>;
    const phase = parsed.data.phase ?? 'all';
    const source = parsed.data.source ?? 'jack-profile-v2';

    const enriched: EnrichedProfile = {
      version: 1,
      enrichedAt: new Date().toISOString(),
      source,
      role_family: ruleSignals.role_family,
      seniority: ruleSignals.seniority,
      job_preferences: ruleSignals.job_preferences,
      normalized_skills: ruleSignals.normalized_skills,
    };

    const runPhase1 = phase === 1 || phase === 'all';
    const runPhase4 = phase === 4 || phase === 'all';
    const runPhase5 = phase === 5 || phase === 'all';
    const runPhase3 = phase === 'all';

    if (runPhase1) {
      try {
        const llm = await callEnrichmentLlm(1, collectedData, ruleSignals);
        enriched.job_preferences = mergeEnrichmentLlmPhase1(enriched.job_preferences, {
          domains: Array.isArray(llm.domains) ? (llm.domains as string[]) : undefined,
          company_types: Array.isArray(llm.company_types)
            ? (llm.company_types as string[])
            : undefined,
          motivation: typeof llm.motivation === 'string' ? llm.motivation : undefined,
          red_flags: Array.isArray(llm.red_flags) ? (llm.red_flags as string[]) : undefined,
          seniority_target:
            typeof llm.seniority_target === 'string' ? llm.seniority_target : undefined,
        });
      } catch (err) {
        logger.warn('enrich-profile phase 1 LLM failed (fail-open):', err);
      }
    }

    if (runPhase3) {
      // Полнота — только rule-based. LLM analyze часто врёт («нет навыков» при filled skills).
      const completeness = computeCompleteness(collectedData);
      enriched.profile_completeness = completeness.profile_completeness;
      enriched.missing_fields = completeness.missing_fields;
      try {
        await runProfileAnalysis({
          collectedData,
          completedSteps: parsed.data.completedSteps ?? [],
          currentStepId: parsed.data.currentStepId ?? 'profile_snapshot',
        });
      } catch (err) {
        logger.warn('enrich-profile phase 3 analyze-profile failed (fail-open):', err);
      }
    } else {
      const completeness = computeCompleteness(collectedData);
      enriched.profile_completeness = completeness.profile_completeness;
      enriched.missing_fields = completeness.missing_fields;
    }

    if (runPhase4) {
      try {
        const llm = await callEnrichmentLlm(
          4,
          collectedData,
          enriched,
          parsed.data.marketContext
        );
        if (typeof llm.market_fit_summary === 'string' && llm.market_fit_summary.trim()) {
          enriched.market_fit_summary = toSecondPersonMarketFit(llm.market_fit_summary.trim());
        }
      } catch (err) {
        logger.warn('enrich-profile phase 4 LLM failed (fail-open):', err);
      }
    }

    if (runPhase5) {
      try {
        const llm = await callEnrichmentLlm(5, collectedData, enriched);
        const raw = llm.achievements_with_metrics;
        if (Array.isArray(raw)) {
          enriched.achievements_with_metrics = raw
            .filter((a) => a && typeof a === 'object' && typeof (a as { achievement?: unknown }).achievement === 'string')
            .map((a) => {
              const item = a as Record<string, unknown>;
              return {
                position_index:
                  typeof item.position_index === 'number' ? item.position_index : undefined,
                company: typeof item.company === 'string' ? item.company : undefined,
                role: typeof item.role === 'string' ? item.role : undefined,
                achievement: String(item.achievement),
                metric_before:
                  typeof item.metric_before === 'string' ? item.metric_before : undefined,
                metric_after:
                  typeof item.metric_after === 'string' ? item.metric_after : undefined,
                timeframe: typeof item.timeframe === 'string' ? item.timeframe : undefined,
                ownership: typeof item.ownership === 'string' ? item.ownership : undefined,
                confidence:
                  item.confidence === 'user' || item.confidence === 'inferred'
                    ? item.confidence
                    : ('inferred' as const),
              };
            });
        }
      } catch (err) {
        logger.warn('enrich-profile phase 5 LLM failed (fail-open):', err);
      }
    }

    enriched.enrichedAt = new Date().toISOString();

    res.json({
      status: 'success',
      enriched,
    });
  } catch (error: unknown) {
    logger.error('enrich-profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
