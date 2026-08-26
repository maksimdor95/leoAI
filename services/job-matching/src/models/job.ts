/**
 * Job Model
 * Interface and repository for Job entity
 */

import type { RoleFamily } from '../services/roleFamily';
import type { HhVacancyMeta } from '../utils/hhVacancyMeta';

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
  source_meta: HhVacancyMeta | null;
  source: string; // 'hh.ru' | 'avito' | etc.
  source_url: string;
  role_family: RoleFamily | null;
  posted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  /** Soft-delete: set when source reports closed/gone. Null/undefined = active in match feed. */
  archived_at?: Date | null;
  /** LEO Med: nomenclature role id or `unknown`. Null = not Med (Jack catalog). */
  med_role_id?: string | null;
  /** LEO Med level: doctor | mid | junior */
  med_level?: string | null;
  embedding?: number[];
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
  source_meta?: HhVacancyMeta | null;
  source: string;
  source_url: string;
  role_family?: RoleFamily | null;
  posted_at?: Date | null;
  /** Set by Med scrape path; Jack match excludes non-null. */
  med_role_id?: string | null;
  med_level?: string | null;
  embedding?: number[];
}
