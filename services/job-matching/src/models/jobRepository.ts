/**
 * Job Repository
 * Database operations for Job entity
 */

import pool from '../config/database';
import { Job, JobInput } from './job';
import { logger } from '../utils/logger';
import { JobRow } from './types';

export class JobRepository {
  /**
   * Create a new job or update if exists (based on source_url)
   */
  async createOrUpdate(jobInput: JobInput): Promise<Job> {
    const query = `
      INSERT INTO jobs (
        title, company, location, salary_min, salary_max, currency,
        description, requirements, skills, experience_level, work_mode,
        source, source_url, posted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (source_url) 
      DO UPDATE SET
        title = EXCLUDED.title,
        company = EXCLUDED.company,
        location = EXCLUDED.location,
        salary_min = EXCLUDED.salary_min,
        salary_max = EXCLUDED.salary_max,
        currency = EXCLUDED.currency,
        description = EXCLUDED.description,
        requirements = EXCLUDED.requirements,
        skills = EXCLUDED.skills,
        experience_level = EXCLUDED.experience_level,
        work_mode = EXCLUDED.work_mode,
        posted_at = EXCLUDED.posted_at,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      jobInput.title,
      jobInput.company,
      JSON.stringify(jobInput.location),
      jobInput.salary_min || null,
      jobInput.salary_max || null,
      jobInput.currency || null,
      jobInput.description,
      jobInput.requirements,
      JSON.stringify(jobInput.skills),
      jobInput.experience_level || null,
      jobInput.work_mode || null,
      jobInput.source,
      jobInput.source_url,
      jobInput.posted_at || null,
    ];

    try {
      const result = await pool.query(query, values);
      return this.mapRowToJob(result.rows[0]);
    } catch (error: unknown) {
      logger.error('Error creating/updating job:', error);
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  async findById(jobId: string): Promise<Job | null> {
    const query = 'SELECT * FROM jobs WHERE id = $1';
    try {
      const result = await pool.query(query, [jobId]);
      if (result.rows.length === 0) {
        return null;
      }
      return this.mapRowToJob(result.rows[0]);
    } catch (error: unknown) {
      logger.error('Error finding job by ID:', error);
      throw error;
    }
  }

  /**
   * Get all jobs with optional filters
   */
  async findAll(filters?: {
    source?: string;
    location?: string[];
    work_mode?: string;
    experience_level?: string;
    limit?: number;
    offset?: number;
  }): Promise<Job[]> {
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters?.source) {
      query += ` AND source = $${paramIndex}`;
      values.push(filters.source);
      paramIndex++;
    }

    if (filters?.location && filters.location.length > 0) {
      query += ` AND location @> $${paramIndex}::jsonb`;
      values.push(JSON.stringify(filters.location));
      paramIndex++;
    }

    if (filters?.work_mode) {
      query += ` AND work_mode = $${paramIndex}`;
      values.push(filters.work_mode);
      paramIndex++;
    }

    if (filters?.experience_level) {
      query += ` AND experience_level = $${paramIndex}`;
      values.push(filters.experience_level);
      paramIndex++;
    }

    query += ' ORDER BY posted_at DESC, created_at DESC';

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(filters.limit);
      paramIndex++;
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(filters.offset);
      paramIndex++;
    }

    try {
      const result = await pool.query(query, values);
      return result.rows.map((row) => this.mapRowToJob(row));
    } catch (error: unknown) {
      logger.error('Error finding jobs:', error);
      throw error;
    }
  }

  /**
   * Get count of jobs
   */
  async count(filters?: { source?: string }): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM jobs WHERE 1=1';
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters?.source) {
      query += ` AND source = $${paramIndex}`;
      values.push(filters.source);
      paramIndex++;
    }

    try {
      const result = await pool.query(query, values);
      return parseInt(result.rows[0].count, 10);
    } catch (error: unknown) {
      logger.error('Error counting jobs:', error);
      throw error;
    }
  }

  /**
   * Map database row to Job object
   */
  private mapRowToJob(row: JobRow): Job {
    return {
      id: row.id,
      title: row.title,
      company: row.company,
      location: typeof row.location === 'string' ? JSON.parse(row.location) : row.location,
      salary_min: row.salary_min,
      salary_max: row.salary_max,
      currency: row.currency,
      description: row.description,
      requirements: row.requirements,
      skills: typeof row.skills === 'string' ? JSON.parse(row.skills) : row.skills,
      experience_level: row.experience_level,
      work_mode: row.work_mode,
      source: row.source,
      source_url: row.source_url,
      posted_at: row.posted_at ? new Date(row.posted_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }
}

export default new JobRepository();
