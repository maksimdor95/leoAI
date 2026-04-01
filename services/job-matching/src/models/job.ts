/**
 * Job Model
 * Interface and repository for Job entity
 */

export interface Job {
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
  experience_level: string | null; // 'junior' | 'middle' | 'senior' | null
  work_mode: string | null; // 'remote' | 'office' | 'hybrid' | null
  source: string; // 'hh.ru' | 'avito' | etc.
  source_url: string;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface JobInput {
  title: string;
  company: string;
  location: string[];
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  description: string;
  requirements: string;
  skills: string[];
  experience_level?: string | null;
  work_mode?: string | null;
  source: string;
  source_url: string;
  posted_at?: Date | null;
}
