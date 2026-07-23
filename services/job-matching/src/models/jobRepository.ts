/**
 * Job Repository
 * Database operations for Job entity
 */

import pool from '../config/database';
import { Job, JobInput } from './job';
import { logger } from '../utils/logger';
import { JobRow } from './types';
import { resolvePublicVacancyUrl } from '../utils/vacancyUrl';
import type { HhVacancyMeta } from '../utils/hhVacancyMeta';
import { RoleFamily, classifyRoleFamily } from '../services/roleFamily';

/** Максимум вакансий за один матч (защита при росте каталога). */
export const MATCH_SCAN_MAX = 5000;

/** @deprecated Используйте resolveMatchScanLimit(jobsInDb). */
export const MATCH_SCAN_LIMIT = MATCH_SCAN_MAX;

export function resolveMatchScanLimit(jobsInDb: number): number {
  if (jobsInDb <= 0) return MATCH_SCAN_MAX;
  return Math.min(jobsInDb, MATCH_SCAN_MAX);
}

/** Сколько мест в выборке резервируем под primary + adjacent семейства. */
export const MATCH_FAMILY_BUDGET = 350;

function resolveRoleFamily(jobInput: JobInput): RoleFamily {
  if (jobInput.role_family) {
    return jobInput.role_family;
  }
  return classifyRoleFamily(jobInput.title);
}

function parseRoleFamily(raw: string | null | undefined): RoleFamily | null {
  if (!raw || typeof raw !== 'string') return null;
  return raw as RoleFamily;
}

function parseSourceMeta(raw: unknown): HhVacancyMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as Partial<HhVacancyMeta>;
  const hasAny =
    meta.experienceLabel ||
    meta.experienceId ||
    meta.employmentLabel ||
    meta.employmentId ||
    (Array.isArray(meta.employmentForms) && meta.employmentForms.length > 0) ||
    (Array.isArray(meta.employmentFormIds) && meta.employmentFormIds.length > 0) ||
    meta.scheduleLabel ||
    meta.scheduleId ||
    meta.workScheduleDays ||
    (Array.isArray(meta.workScheduleDayIds) && meta.workScheduleDayIds.length > 0) ||
    meta.workingHours ||
    (Array.isArray(meta.workingHourIds) && meta.workingHourIds.length > 0) ||
    meta.workFormatLabel ||
    (Array.isArray(meta.workFormatIds) && meta.workFormatIds.length > 0);
  return hasAny ? (meta as HhVacancyMeta) : null;
}

export class JobRepository {
  /**
   * Create a new job or update if exists (based on source_url)
   */
  async createOrUpdate(jobInput: JobInput): Promise<Job> {
    const roleFamily = resolveRoleFamily(jobInput);
    const query = `
      INSERT INTO jobs (
        title, company, location, salary_min, salary_max, currency,
        description, requirements, skills, experience_level, work_mode,
        source, source_url, posted_at, embedding, role_family, source_meta
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
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
        embedding = COALESCE(EXCLUDED.embedding, jobs.embedding),
        role_family = EXCLUDED.role_family,
        source_meta = COALESCE(EXCLUDED.source_meta, jobs.source_meta),
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
      jobInput.embedding ? `[${jobInput.embedding.join(',')}]` : null,
      roleFamily,
      jobInput.source_meta ? JSON.stringify(jobInput.source_meta) : null,
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
   * Умная выборка для матча: сначала свежие вакансии из primary + adjacent
   * семейств, затем добиваем общим каталогом до limit.
   */
  async findForMatch(options: {
    primaryFamily: RoleFamily;
    adjacentFamilies: RoleFamily[];
    limit?: number;
    familyBudget?: number;
  }): Promise<Job[]> {
    const limit = options.limit ?? MATCH_SCAN_MAX;
    const familyBudget = options.familyBudget ?? MATCH_FAMILY_BUDGET;
    const { primaryFamily, adjacentFamilies } = options;

    if (primaryFamily === 'unknown') {
      return this.findAll({ limit });
    }

    const families = [
      primaryFamily,
      ...adjacentFamilies.filter((f) => f !== 'unknown' && f !== primaryFamily),
    ];

    const familyJobs = await this.findByRoleFamilies(families, familyBudget);
    if (familyJobs.length >= limit) {
      return familyJobs.slice(0, limit);
    }

    const excludeIds = familyJobs.map((job) => job.id);
    const fillLimit = limit - familyJobs.length;
    const fillerJobs = await this.findRecentExcluding(excludeIds, fillLimit);
    return [...familyJobs, ...fillerJobs];
  }

  private async findByRoleFamilies(families: RoleFamily[], limit: number): Promise<Job[]> {
    if (families.length === 0 || limit <= 0) {
      return [];
    }

    const query = `
      SELECT * FROM jobs
      WHERE role_family = ANY($1::varchar[])
      ORDER BY posted_at DESC NULLS LAST, created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [families, limit]);
      return result.rows.map((row) => this.mapRowToJob(row));
    } catch (error: unknown) {
      logger.error('Error finding jobs by role families:', error);
      throw error;
    }
  }

  /**
   * Заполняет role_family для строк, созданных до миграции.
   * Возвращает число обновлённых строк в этом батче.
   */
  async backfillRoleFamiliesBatch(batchSize = 500): Promise<number> {
    const { rows } = await pool.query<{ id: string; title: string }>(
      `
        SELECT id, title FROM jobs
        WHERE role_family IS NULL
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [batchSize]
    );

    if (rows.length === 0) {
      return 0;
    }

    for (const row of rows) {
      const family = classifyRoleFamily(row.title);
      await pool.query(`UPDATE jobs SET role_family = $1, updated_at = NOW() WHERE id = $2`, [
        family,
        row.id,
      ]);
    }

    return rows.length;
  }

  async backfillAllRoleFamilies(batchSize = 500): Promise<number> {
    let total = 0;
    for (;;) {
      const updated = await this.backfillRoleFamiliesBatch(batchSize);
      total += updated;
      if (updated < batchSize) {
        break;
      }
    }
    return total;
  }

  /**
   * Ближайшие вакансии по embedding (pgvector cosine distance).
   * Fail-open: пустой массив при ошибке / отсутствии вектора.
   */
  async findNearestByEmbedding(embedding: number[], limit = 150): Promise<Job[]> {
    if (!embedding.length || limit <= 0) return [];

    const vectorLiteral = `[${embedding.join(',')}]`;
    const query = `
      SELECT * FROM jobs
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [vectorLiteral, limit]);
      return result.rows.map((row) => this.mapRowToJob(row));
    } catch (error: unknown) {
      logger.warn(
        `findNearestByEmbedding failed (fail-open): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }

  private async findRecentExcluding(excludeIds: string[], limit: number): Promise<Job[]> {
    if (limit <= 0) return [];

    if (excludeIds.length === 0) {
      return this.findAll({ limit });
    }

    const query = `
      SELECT * FROM jobs
      WHERE id <> ALL($1::uuid[])
      ORDER BY posted_at DESC, created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [excludeIds, limit]);
      return result.rows.map((row) => this.mapRowToJob(row));
    } catch (error: unknown) {
      logger.error('Error finding recent jobs excluding ids:', error);
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
      source_meta: parseSourceMeta(
        typeof row.source_meta === 'string' ? JSON.parse(row.source_meta) : row.source_meta
      ),
      source: row.source,
      source_url: resolvePublicVacancyUrl(row.source, row.source_url) ?? '',
      role_family: parseRoleFamily(row.role_family),
      posted_at: row.posted_at ? new Date(row.posted_at) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      embedding: row.embedding ? (typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding) : undefined,
    };
  }
}

export default new JobRepository();
