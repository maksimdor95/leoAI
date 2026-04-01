/**
 * Types for database rows
 */

export interface JobRow {
  id: string;
  title: string;
  company: string;
  location: string | string[]; // Can be JSON string or array
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string;
  requirements: string;
  skills: string | string[]; // Can be JSON string or array
  experience_level: string | null;
  work_mode: string | null;
  source: string;
  source_url: string;
  posted_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}
