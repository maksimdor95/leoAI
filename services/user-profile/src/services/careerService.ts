import type { PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { logger } from '../utils/logger';
import { extractResumeTextFromBuffer } from '../utils/resumeFileExtraction';
import {
  CareerTrack,
  Resume,
  ResumeContentList,
  ResumeContentChunk,
  UpsertCareerProfileInput,
  Skill,
  UserSkill,
  LearningPlan,
  LearningStep,
  CreateCareerTrackInput,
  UpdateCareerTrackInput,
} from '../models/CareerProfile';

type PostgresError = {
  code?: string;
};

const isPostgresError = (error: unknown): error is PostgresError =>
  typeof error === 'object' && error !== null && 'code' in error;

function rowToTrack(row: CareerTrack): CareerTrack {
  return { ...row };
}

function detectChunkTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (/(опыт|experience|лет|years)/i.test(lower)) tags.push('experience');
  if (/(product|pm|manager|lead|head)/i.test(lower)) tags.push('role');
  if (/(sql|python|figma|jira|analytics|amplitude|ga4)/i.test(lower)) tags.push('skills');
  if (/(retention|conversion|churn|mrr|kpi|a\/b|ab test)/i.test(lower)) tags.push('metrics');
  if (/(b2b|b2c|saas|fintech|e-?commerce|marketplace)/i.test(lower)) tags.push('domain');
  return tags;
}

function detectLanguage(text: string): 'ru' | 'en' | 'unknown' {
  if (/[А-Яа-яЁё]/.test(text)) return 'ru';
  if (/[A-Za-z]/.test(text)) return 'en';
  return 'unknown';
}

function buildResumeContentList(params: {
  userId: string;
  docId: string;
  sourceName: string;
  resumeText: string;
}): ResumeContentList {
  const normalized = params.resumeText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 30);

  const chunks: ResumeContentChunk[] = [];
  let idx = 1;
  for (const line of normalized) {
    chunks.push({
      chunkId: `c${idx++}`,
      type: 'text',
      text: line.slice(0, 1200),
      page: 1,
      section: idx <= 3 ? 'summary' : 'experience',
      tags: detectChunkTags(line),
      confidence: 0.8,
      lang: detectLanguage(line),
    });
    if (chunks.length >= 40) break;
  }

  if (chunks.length === 0) {
    const text = params.resumeText.trim().slice(0, 1200);
    if (text.length > 0) {
      chunks.push({
        chunkId: 'c1',
        type: 'text',
        text,
        page: 1,
        section: 'summary',
        tags: detectChunkTags(text),
        confidence: 0.6,
        lang: detectLanguage(text),
      });
    }
  }

  return {
    docId: params.docId,
    userId: params.userId,
    sourceType: 'resume',
    sourceName: params.sourceName || 'resume',
    version: 1,
    chunks,
  };
}

/** Resolve track for upsert inside an open transaction (same connection). */
async function resolveTrackForUpsert(
  client: PoolClient,
  userId: string,
  trackId: string | undefined
): Promise<CareerTrack> {
  if (trackId) {
    const t = await client.query<CareerTrack>(
      `SELECT * FROM jack.career_tracks WHERE id = $1 AND user_id = $2`,
      [trackId, userId]
    );
    if (t.rows[0]) {
      return rowToTrack(t.rows[0]);
    }
  }
  const def = await client.query<CareerTrack>(
    `SELECT * FROM jack.career_tracks WHERE user_id = $1 AND is_default = true LIMIT 1`,
    [userId]
  );
  if (def.rows[0]) {
    return rowToTrack(def.rows[0]);
  }
  const any = await client.query<CareerTrack>(
    `SELECT * FROM jack.career_tracks WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  if (any.rows[0]) {
    await client.query(`UPDATE jack.career_tracks SET is_default = false WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE jack.career_tracks SET is_default = true WHERE id = $1`, [any.rows[0].id]);
    return rowToTrack({ ...any.rows[0], is_default: true });
  }
  const ins = await client.query<CareerTrack>(
    `INSERT INTO jack.career_tracks (user_id, name, is_default) VALUES ($1, 'Основной', true) RETURNING *`,
    [userId]
  );
  return rowToTrack(ins.rows[0]);
}

export class CareerService {
  /**
   * Create tables for career tracks, resumes (per track), skills and learning plans if they don't exist.
   * Resumes store text per track via `track_id` (one logical resume line per direction; history = multiple rows).
   */
  static async createTables(): Promise<void> {
    const query = `
      CREATE SCHEMA IF NOT EXISTS jack;

      CREATE TABLE IF NOT EXISTS jack.career_tracks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES jack.users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL DEFAULT 'Основной',
        "current_role" VARCHAR(255),
        target_role VARCHAR(255),
        experience_years INTEGER,
        ai_readiness_score INTEGER,
        is_default BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_career_tracks_user_id ON jack.career_tracks(user_id);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_career_tracks_one_default_per_user
        ON jack.career_tracks (user_id)
        WHERE is_default;

      CREATE TABLE IF NOT EXISTS jack.resumes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES jack.users(id) ON DELETE CASCADE,
        resume_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jack.skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        skill_name VARCHAR(255) NOT NULL,
        skill_category VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS jack.user_skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES jack.users(id) ON DELETE CASCADE,
        skill_id UUID NOT NULL REFERENCES jack.skills(id) ON DELETE CASCADE,
        skill_level INTEGER,
        confidence_score INTEGER,
        source VARCHAR(50),
        UNIQUE (user_id, skill_id)
      );

      CREATE TABLE IF NOT EXISTS jack.learning_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES jack.users(id) ON DELETE CASCADE,
        generated_by_ai BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS jack.learning_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL REFERENCES jack.learning_plans(id) ON DELETE CASCADE,
        program_id VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'not_started',
        completion_date TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON jack.resumes(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON jack.user_skills(user_id);
      CREATE INDEX IF NOT EXISTS idx_learning_plans_user_id ON jack.learning_plans(user_id);
      CREATE INDEX IF NOT EXISTS idx_learning_steps_plan_id ON jack.learning_steps(plan_id);
    `;

    try {
      await pool.query(query);
      await pool.query(`ALTER TABLE jack.resumes ADD COLUMN IF NOT EXISTS track_id UUID`);
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'resumes_track_id_fkey'
          ) THEN
            ALTER TABLE jack.resumes
            ADD CONSTRAINT resumes_track_id_fkey
            FOREIGN KEY (track_id) REFERENCES jack.career_tracks(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_resumes_track_id ON jack.resumes(track_id)`);
      await pool.query(
        `ALTER TABLE jack.resumes ADD COLUMN IF NOT EXISTS original_filename VARCHAR(512)`
      );
      await pool.query(`ALTER TABLE jack.resumes ADD COLUMN IF NOT EXISTS mime_type VARCHAR(128)`);
      await pool.query(`ALTER TABLE jack.resumes ADD COLUMN IF NOT EXISTS storage_path TEXT`);
      await pool.query(`ALTER TABLE jack.resumes ADD COLUMN IF NOT EXISTS content_list JSONB`);
      await CareerService.migrateLegacyCareerData();
      logger.info('✅ Career tracks and Resume tables checked/created successfully');
    } catch (error: unknown) {
      logger.error('❌ Error creating career tables:', error);
      if (!isPostgresError(error)) {
        throw error;
      }
    }
  }

  /**
   * Legacy: single jack.career_profiles + resumes without track_id → career_tracks + resume.track_id.
   *
   * Резюме: текст хранится в `jack.resumes` с полем `track_id` → `jack.career_tracks`
   * (не дублируем resume_text на треке; несколько строк — история версий в рамках одного направления).
   */
  static async migrateLegacyCareerData(): Promise<void> {
    const client = await pool.connect();
    try {
      const { rows: cpRows } = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables
           WHERE table_schema = 'jack' AND table_name = 'career_profiles'
         ) AS exists`
      );
      const hasLegacyProfiles = cpRows[0]?.exists === true;

      if (hasLegacyProfiles) {
        await client.query(`
          INSERT INTO jack.career_tracks (user_id, name, "current_role", target_role, experience_years, ai_readiness_score, is_default)
          SELECT cp.user_id, 'Основной', cp."current_role", cp.target_role, cp.experience_years, cp.ai_readiness_score, true
          FROM jack.career_profiles cp
          WHERE NOT EXISTS (SELECT 1 FROM jack.career_tracks ct WHERE ct.user_id = cp.user_id)
        `);
      }

      await client.query(`
        INSERT INTO jack.career_tracks (user_id, name, is_default)
        SELECT DISTINCT r.user_id, 'Основной', true
        FROM jack.resumes r
        WHERE NOT EXISTS (SELECT 1 FROM jack.career_tracks ct WHERE ct.user_id = r.user_id)
      `);

      await client.query(`
        UPDATE jack.resumes r
        SET track_id = sub.id
        FROM (
          SELECT DISTINCT ON (ct.user_id) ct.id, ct.user_id
          FROM jack.career_tracks ct
          WHERE ct.is_default = true
          ORDER BY ct.user_id, ct.created_at ASC
        ) sub
        WHERE r.user_id = sub.user_id AND r.track_id IS NULL
      `);

      await client.query(`
        UPDATE jack.resumes r
        SET track_id = (
          SELECT ct.id FROM jack.career_tracks ct WHERE ct.user_id = r.user_id ORDER BY ct.is_default DESC, ct.created_at ASC LIMIT 1
        )
        WHERE r.track_id IS NULL
      `);

      const { rows: nullResumes } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM jack.resumes WHERE track_id IS NULL`
      );
      const nullCount = parseInt(nullResumes[0]?.n ?? '0', 10);
      if (nullCount > 0) {
        logger.warn(`migrateLegacyCareerData: ${nullCount} resumes still missing track_id — deleting orphans`);
        await client.query(`DELETE FROM jack.resumes WHERE track_id IS NULL`);
      }

      try {
        await client.query(`ALTER TABLE jack.resumes ALTER COLUMN track_id SET NOT NULL`);
      } catch (e: unknown) {
        logger.warn('Could not set NOT NULL on jack.resumes.track_id (may already be set):', e);
      }

      if (hasLegacyProfiles) {
        await client.query(`DROP TABLE IF EXISTS jack.career_profiles`);
        logger.info('✅ Dropped legacy jack.career_profiles after migration');
      }
    } catch (error: unknown) {
      logger.error('migrateLegacyCareerData error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async listTracks(userId: string): Promise<CareerTrack[]> {
    const result = await pool.query<CareerTrack>(
      `SELECT * FROM jack.career_tracks WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [userId]
    );
    return result.rows.map(rowToTrack);
  }

  static async getTrackById(userId: string, trackId: string): Promise<CareerTrack | null> {
    const result = await pool.query<CareerTrack>(
      `SELECT * FROM jack.career_tracks WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [trackId, userId]
    );
    return result.rows[0] ? rowToTrack(result.rows[0]) : null;
  }

  static async getDefaultTrack(userId: string): Promise<CareerTrack | null> {
    const result = await pool.query<CareerTrack>(
      `SELECT * FROM jack.career_tracks WHERE user_id = $1 AND is_default = true LIMIT 1`,
      [userId]
    );
    return result.rows[0] ? rowToTrack(result.rows[0]) : null;
  }

  /** Ensures the user has at least one track (default). */
  static async getOrCreateDefaultTrack(userId: string): Promise<CareerTrack> {
    const existing = await CareerService.getDefaultTrack(userId);
    if (existing) {
      return existing;
    }
    const any = await pool.query<CareerTrack>(
      `SELECT * FROM jack.career_tracks WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );
    if (any.rows[0]) {
      await pool.query(`UPDATE jack.career_tracks SET is_default = false WHERE user_id = $1`, [userId]);
      await pool.query(`UPDATE jack.career_tracks SET is_default = true WHERE id = $1`, [any.rows[0].id]);
      const refreshed = await CareerService.getTrackById(userId, any.rows[0].id);
      if (refreshed) {
        return refreshed;
      }
    }
    const ins = await pool.query<CareerTrack>(
      `
      INSERT INTO jack.career_tracks (user_id, name, is_default)
      VALUES ($1, 'Основной', true)
      RETURNING *
      `,
      [userId]
    );
    return rowToTrack(ins.rows[0]);
  }

  static async createTrack(userId: string, input: CreateCareerTrackInput): Promise<CareerTrack> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const countResult = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM jack.career_tracks WHERE user_id = $1`,
        [userId]
      );
      const count = parseInt(countResult.rows[0]?.n ?? '0', 10);
      const makeDefault = input.is_default === true || count === 0;

      if (makeDefault) {
        await client.query(`UPDATE jack.career_tracks SET is_default = false WHERE user_id = $1`, [userId]);
      }

      const ins = await client.query<CareerTrack>(
        `
        INSERT INTO jack.career_tracks (user_id, name, "current_role", target_role, experience_years, is_default)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          userId,
          input.name.trim() || 'Направление',
          input.current_role ?? null,
          input.target_role ?? null,
          input.experience_years ?? null,
          makeDefault,
        ]
      );
      await client.query('COMMIT');
      return rowToTrack(ins.rows[0]);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateTrack(
    userId: string,
    trackId: string,
    input: UpdateCareerTrackInput
  ): Promise<CareerTrack | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (input.name !== undefined) {
      sets.push(`name = $${i++}`);
      vals.push(input.name.trim());
    }
    if (input.current_role !== undefined) {
      sets.push(`"current_role" = $${i++}`);
      vals.push(input.current_role);
    }
    if (input.target_role !== undefined) {
      sets.push(`target_role = $${i++}`);
      vals.push(input.target_role);
    }
    if (input.experience_years !== undefined) {
      sets.push(`experience_years = $${i++}`);
      vals.push(input.experience_years);
    }
    if (sets.length === 0) {
      return CareerService.getTrackById(userId, trackId);
    }
    sets.push('updated_at = NOW()');
    vals.push(trackId, userId);
    const result = await pool.query<CareerTrack>(
      `UPDATE jack.career_tracks SET ${sets.join(', ')}
       WHERE id = $${i++} AND user_id = $${i}
       RETURNING *`,
      vals
    );
    return result.rows[0] ? rowToTrack(result.rows[0]) : null;
  }

  static async setDefaultTrack(userId: string, trackId: string): Promise<CareerTrack | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ok = await client.query(`SELECT 1 FROM jack.career_tracks WHERE id = $1 AND user_id = $2`, [
        trackId,
        userId,
      ]);
      if (ok.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(`UPDATE jack.career_tracks SET is_default = false WHERE user_id = $1`, [userId]);
      const upd = await client.query<CareerTrack>(
        `UPDATE jack.career_tracks SET is_default = true, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
        [trackId, userId]
      );
      await client.query('COMMIT');
      return upd.rows[0] ? rowToTrack(upd.rows[0]) : null;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Full career snapshot: default track + latest resume for that track + global skills/plans.
   */
  static async getCareerProfileWithDetails(userId: string): Promise<{
    careerProfile: CareerTrack | null;
    resume: Resume | null;
    tracks: CareerTrack[];
    skills: (UserSkill & { skill: Skill })[];
    learningPlans: LearningPlan[];
    learningSteps: LearningStep[];
  }> {
    const client = await pool.connect();

    try {
      const tracksResult = await client.query<CareerTrack>(
        `SELECT * FROM jack.career_tracks WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC`,
        [userId]
      );
      const tracks = tracksResult.rows.map(rowToTrack);
      const defaultTrack = tracks.find((t) => t.is_default) ?? tracks[0] ?? null;

      let resume: Resume | null = null;
      if (defaultTrack) {
        const resumeResult = await client.query<Resume>(
          `SELECT * FROM jack.resumes WHERE track_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [defaultTrack.id]
        );
        resume = resumeResult.rows[0] ?? null;
      }

      const [skillsResult, plansResult, stepsResult] = await Promise.all([
        client.query<
          UserSkill & {
            skill_id: string;
            skill_name: string;
            skill_category: string | null;
          }
        >(
          `
            SELECT us.id,
                   us.user_id,
                   us.skill_id,
                   us.skill_level,
                   us.confidence_score,
                   us.source,
                   s.skill_name,
                   s.skill_category
            FROM jack.user_skills us
            JOIN jack.skills s ON s.id = us.skill_id
            WHERE us.user_id = $1
            `,
          [userId]
        ),
        client.query<LearningPlan>(
          `SELECT * FROM jack.learning_plans WHERE user_id = $1 ORDER BY created_at DESC`,
          [userId]
        ),
        client.query<LearningStep>(
          `SELECT * FROM jack.learning_steps WHERE plan_id IN (
               SELECT id FROM jack.learning_plans WHERE user_id = $1
             )`,
          [userId]
        ),
      ]);

      const skills = skillsResult.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        skill_id: row.skill_id,
        skill_level: row.skill_level,
        confidence_score: row.confidence_score,
        source: row.source,
        skill: {
          id: row.skill_id,
          skill_name: row.skill_name,
          skill_category: row.skill_category,
        },
      }));

      return {
        careerProfile: defaultTrack,
        resume,
        tracks,
        skills,
        learningPlans: plansResult.rows,
        learningSteps: stepsResult.rows,
      };
    } catch (error: unknown) {
      logger.error('Error fetching career profile with details:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Upsert fields on a track + optional new resume row for that track.
   */
  static async upsertCareerProfile(
    userId: string,
    input: UpsertCareerProfileInput
  ): Promise<{ careerProfile: CareerTrack; resume?: Resume }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const track = await resolveTrackForUpsert(client, userId, input.track_id);

      const sets: string[] = [];
      const fieldVals: unknown[] = [];
      let pi = 1;
      if (input.current_role !== undefined) {
        sets.push(`"current_role" = $${pi++}`);
        fieldVals.push(input.current_role);
      }
      if (input.target_role !== undefined) {
        sets.push(`target_role = $${pi++}`);
        fieldVals.push(input.target_role);
      }
      if (input.experience_years !== undefined) {
        sets.push(`experience_years = $${pi++}`);
        fieldVals.push(input.experience_years);
      }

      let careerProfile = track;
      if (sets.length > 0) {
        sets.push('updated_at = NOW()');
        fieldVals.push(track.id);
        const profileResult = await client.query<CareerTrack>(
          `UPDATE jack.career_tracks SET ${sets.join(', ')} WHERE id = $${pi} RETURNING *`,
          fieldVals
        );
        if (profileResult.rows[0]) {
          careerProfile = rowToTrack(profileResult.rows[0]);
        }
      }

      let resume: Resume | undefined;

      if (input.resume_text && input.resume_text.trim().length > 0) {
        const resumeResult = await client.query<Resume>(
          `
          INSERT INTO jack.resumes (user_id, track_id, resume_text)
          VALUES ($1, $2, $3)
          RETURNING *
          `,
          [userId, careerProfile.id, input.resume_text.trim()]
        );
        resume = resumeResult.rows[0];
      }

      await client.query('COMMIT');

      return { careerProfile, resume };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error('Error upserting career profile:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAiReadinessScore(
    userId: string
  ): Promise<{ score: number; summary: string; recommendations: string[] }> {
    logger.info(`Returning mock AI Readiness Score for user ${userId}`);

    return {
      score: 42,
      summary:
        'У вас уже есть базовая готовность к использованию AI-инструментов, но есть важные пробелы в системном применении AI в работе.',
      recommendations: [
        'Усилить навыки промпт-инжиниринга для ежедневных задач.',
        'Добавить в стек 1–2 продвинутых AI-инструмента под вашу роль.',
        'Собрать портфолио кейсов с использованием AI в текущей работе.',
      ],
    };
  }

  static async getMockAiReadinessFromSkills(
    userId: string
  ): Promise<{ score: number; skillsCount: number }> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM jack.user_skills WHERE user_id = $1`,
      [userId]
    );

    const skillsCount = parseInt(result.rows[0]?.count ?? '0', 10) || 0;

    let score = 10 + skillsCount * 5;
    if (skillsCount === 0) {
      score = 10;
    }
    if (score > 100) {
      score = 100;
    }

    return { score, skillsCount };
  }

  private static getResumeUploadRoot(): string {
    return process.env.RESUME_UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads', 'resumes');
  }

  /**
   * Сохраняет файл резюме на диск, извлекает текст, создаёт строку в jack.resumes.
   */
  static async createResumeFromFileUpload(
    userId: string,
    params: {
      trackId?: string;
      buffer: Buffer;
      originalFilename: string;
      mimeType: string;
    }
  ): Promise<{ resume: Resume; careerProfile: CareerTrack; extractedText: string }> {
    const extractedText = await extractResumeTextFromBuffer(
      params.buffer,
      params.mimeType,
      params.originalFilename
    );

    const client = await pool.connect();
    let absoluteFilePath: string | null = null;

    try {
      await client.query('BEGIN');

      const track = await resolveTrackForUpsert(client, userId, params.trackId);
      const safeName = params.originalFilename.replace(/[^a-zA-Z0-9._\-]+/g, '_').slice(0, 160);

      const ins = await client.query<Resume>(
        `
        INSERT INTO jack.resumes (user_id, track_id, resume_text, original_filename, mime_type, storage_path, content_list)
        VALUES ($1, $2, $3, $4, $5, NULL, NULL)
        RETURNING *
        `,
        [userId, track.id, extractedText, params.originalFilename, params.mimeType]
      );
      const resume = ins.rows[0];
      if (!resume) {
        throw new Error('Failed to insert resume');
      }

      const root = CareerService.getResumeUploadRoot();
      const relPath = path.join(userId, resume.id, safeName || 'resume.bin');
      absoluteFilePath = path.join(root, relPath);
      await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
      await fs.writeFile(absoluteFilePath, params.buffer);

      const contentList = buildResumeContentList({
        userId,
        docId: resume.id,
        sourceName: params.originalFilename,
        resumeText: extractedText,
      });

      await client.query(`UPDATE jack.resumes SET storage_path = $1 WHERE id = $2`, [
        relPath,
        resume.id,
      ]);
      await client.query(`UPDATE jack.resumes SET content_list = $1 WHERE id = $2`, [
        JSON.stringify(contentList),
        resume.id,
      ]);

      await client.query('COMMIT');

      resume.storage_path = relPath;
      resume.original_filename = params.originalFilename;
      resume.mime_type = params.mimeType;
      resume.content_list = contentList;

      return { resume, careerProfile: track, extractedText };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      if (absoluteFilePath) {
        await fs.unlink(absoluteFilePath).catch(() => undefined);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  static async listResumes(userId: string, trackId?: string): Promise<Resume[]> {
    if (trackId && isUuid(trackId)) {
      const r = await pool.query<Resume>(
        `SELECT * FROM jack.resumes WHERE user_id = $1 AND track_id = $2 ORDER BY created_at DESC`,
        [userId, trackId]
      );
      return r.rows.map(rowToResumeRow);
    }
    const r = await pool.query<Resume>(
      `SELECT * FROM jack.resumes WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return r.rows.map(rowToResumeRow);
  }

  static async getResumeById(userId: string, resumeId: string): Promise<Resume | null> {
    const r = await pool.query<Resume>(
      `SELECT * FROM jack.resumes WHERE id = $1 AND user_id = $2`,
      [resumeId, userId]
    );
    return r.rows[0] ? rowToResumeRow(r.rows[0]) : null;
  }

  static async deleteResume(userId: string, resumeId: string): Promise<boolean> {
    const r = await pool.query<Resume>(
      `SELECT * FROM jack.resumes WHERE id = $1 AND user_id = $2`,
      [resumeId, userId]
    );
    const row = r.rows[0];
    if (!row) {
      return false;
    }

    const del = await pool.query(`DELETE FROM jack.resumes WHERE id = $1 AND user_id = $2`, [
      resumeId,
      userId,
    ]);

    if (row.storage_path) {
      const abs = path.join(CareerService.getResumeUploadRoot(), row.storage_path);
      await fs.unlink(abs).catch(() => undefined);
    }

    return (del.rowCount ?? 0) > 0;
  }
}

function rowToResumeRow(row: Resume): Resume {
  return { ...row };
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}
