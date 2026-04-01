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
  resume_text: string;
  created_at: Date;
}

export interface UpsertCareerProfileInput {
  current_role?: string;
  target_role?: string;
  experience_years?: number;
  resume_text?: string;
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


