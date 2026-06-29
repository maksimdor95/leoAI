export interface VacancyConditions {
  experienceLabel: string | null;
  experienceId?: string | null;
  employmentLabel: string | null;
  employmentId?: string | null;
  employmentForms: string[];
  employmentFormIds?: string[];
  scheduleLabel: string | null;
  scheduleId?: string | null;
  workScheduleDays: string | null;
  workScheduleDayIds?: string[];
  workingHours: string | null;
  workingHourIds?: string[];
  workFormatLabel: string | null;
  workFormatIds?: string[];
}

export interface JobPublic {
  id: string;
  title: string;
  company: string;
  location: string[];
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string;
  requirements: string;
  skills: string[];
  experience_level: string | null;
  work_mode: string | null;
  source_meta?: VacancyConditions | null;
  source: string;
  source_url: string;
  posted_at: string | null;
  updated_at?: string;
}

export interface JobDetailsResponse {
  job: JobPublic;
  externalVacancyId: string | null;
  publicUrl: string | null;
  stale: boolean;
  conditions: VacancyConditions | null;
}

export type JobInteractionType =
  | 'view'
  | 'like'
  | 'dislike'
  | 'apply'
  | 'apply_intent'
  | 'draft_generated';

export type ApplicationDraftTone =
  | 'neutral'
  | 'formal'
  | 'concise'
  | 'casual'
  | 'human'
  | 'warm'
  | 'metrics'
  | 'detailed'
  | 'job_fit';

export interface ApplicationDraftResponse {
  jobId: string;
  coverLetter: string;
  headline?: string;
  bullets?: string[];
  matchHighlights?: string[];
  generatedAt: string;
  promptVersion: string;
  regenerated?: boolean;
}

export interface ApplicationDraftRequest {
  sessionId?: string;
  tone?: ApplicationDraftTone;
  regenerate?: boolean;
  matchHighlights?: string[];
}

export interface MatchedJobPreviewContext {
  jobId: string;
  title: string;
  company: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  reasons?: string[];
  variant: 'recommended' | 'weak';
}
