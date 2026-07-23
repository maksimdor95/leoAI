export type SeniorityLevel = 'intern' | 'junior' | 'middle' | 'senior' | 'lead';

export interface JobPreferences {
  target_role?: string;
  seniority_target?: string;
  domains?: string[];
  company_types?: string[];
  work_format?: 'remote' | 'hybrid' | 'office';
  locations?: string[];
  salary_min_rub?: number;
  salary_text?: string;
  start_date?: string;
  motivation?: string;
  red_flags?: string[];
}

export interface NormalizedSkill {
  name: string;
  category?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  source: 'resume' | 'chat' | 'inferred';
  confidence?: number;
}

export interface AchievementWithMetrics {
  position_index?: number;
  company?: string;
  role?: string;
  achievement: string;
  metric_before?: string;
  metric_after?: string;
  timeframe?: string;
  ownership?: string;
  confidence: 'user' | 'inferred';
}

export interface EnrichedProfile {
  version: 1;
  enrichedAt: string;
  source: 'jack-profile-v2' | 'resume_import' | 'manual';
  role_family?: string;
  seniority?: SeniorityLevel;
  job_preferences?: JobPreferences;
  normalized_skills?: NormalizedSkill[];
  profile_completeness?: number;
  missing_fields?: string[];
  market_fit_summary?: string;
  achievements_with_metrics?: AchievementWithMetrics[];
}

export const ENRICHED_COLLECTED_KEY = '__enriched';

export function getEnrichedFromCollected(
  data: Record<string, unknown> | null | undefined
): EnrichedProfile | null {
  if (!data) return null;
  const raw = data[ENRICHED_COLLECTED_KEY];
  if (!raw || typeof raw !== 'object') return null;
  return raw as EnrichedProfile;
}
