/** One career direction per user (e.g. «Веб», «QA»). Replaces the old single career_profiles row. */
export interface CareerTrack {
  id: string;
  user_id: string;
  name: string;
  current_role: string | null;
  target_role: string | null;
  experience_years: number | null;
  ai_readiness_score: number | null;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

/** @deprecated Use CareerTrack — kept for API responses that still expose `careerProfile`. */
export interface CareerProfile {
  id: string;
  user_id: string;
  current_role: string | null;
  target_role: string | null;
  experience_years: number | null;
  ai_readiness_score: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Resume {
  id: string;
  user_id: string;
  track_id: string;
  resume_text: string;
  content_list?: ResumeContentList | null;
  original_filename: string | null;
  mime_type: string | null;
  /** Relative path under upload root, if binary was stored */
  storage_path: string | null;
  created_at: Date;
}

export interface ResumeContentChunk {
  chunkId: string;
  type: 'text';
  text: string;
  page: number;
  section: string;
  tags: string[];
  confidence: number;
  lang: 'ru' | 'en' | 'unknown';
}

export interface ResumeContentList {
  docId: string;
  userId: string;
  sourceType: 'resume';
  sourceName: string;
  version: 1;
  chunks: ResumeContentChunk[];
}

export interface UpsertCareerProfileInput {
  track_id?: string;
  current_role?: string;
  target_role?: string;
  experience_years?: number;
  resume_text?: string;
}

export interface CreateCareerTrackInput {
  name: string;
  current_role?: string;
  target_role?: string;
  experience_years?: number;
  /** If true and no other default, becomes default; if omitted, first track is default. */
  is_default?: boolean;
}

export interface UpdateCareerTrackInput {
  name?: string;
  current_role?: string | null;
  target_role?: string | null;
  experience_years?: number | null;
}

export interface Skill {
  id: string;
  skill_name: string;
  skill_category: string | null;
}

export interface UserSkill {
  id: string;
  user_id: string;
  skill_id: string;
  skill_level: number | null;
  confidence_score: number | null;
  source: string | null;
}

export interface LearningPlan {
  id: string;
  user_id: string;
  generated_by_ai: boolean;
  created_at: Date;
}

export interface LearningStep {
  id: string;
  plan_id: string;
  program_id: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  completion_date: Date | null;
}
