import pool from '../config/database';
import { logger } from '../utils/logger';
import {
  CareerProfile,
  Resume,
  UpsertCareerProfileInput,
  Skill,
  UserSkill,
  LearningPlan,
  LearningStep,
} from '../models/CareerProfile';

type PostgresError = {
  code?: string;
};

const isPostgresError = (error: unknown): error is PostgresError =>
  typeof error === 'object' && error !== null && 'code' in error;

export class CareerService {
  /**
   * Create tables for career profiles, resumes, skills and learning plans if they don't exist
   */
  static async createTables(): Promise<void> {
    const query = `
      CREATE SCHEMA IF NOT EXISTS jack;

      CREATE TABLE IF NOT EXISTS jack.career_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES jack.users(id) ON DELETE CASCADE,
        current_role VARCHAR(255),
        target_role VARCHAR(255),
        experience_years INTEGER,
        ai_readiness_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

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

      CREATE INDEX IF NOT EXISTS idx_career_profiles_user_id ON jack.career_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON jack.resumes(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON jack.user_skills(user_id);
      CREATE INDEX IF NOT EXISTS idx_learning_plans_user_id ON jack.learning_plans(user_id);
      CREATE INDEX IF NOT EXISTS idx_learning_steps_plan_id ON jack.learning_steps(plan_id);
    `;

    try {
      await pool.query(query);
      logger.info('✅ CareerProfile and Resume tables checked/created successfully');
    } catch (error: unknown) {
      logger.error('❌ Error creating career profile tables:', error);
      if (!isPostgresError(error)) {
        throw error;
      }
    }
  }

  /**
   * Get career profile with related data for a user
   */
  static async getCareerProfileWithDetails(userId: string): Promise<{
    careerProfile: CareerProfile | null;
    resume: Resume | null;
    skills: (UserSkill & { skill: Skill })[];
    learningPlans: LearningPlan[];
    learningSteps: LearningStep[];
  }> {
    const client = await pool.connect();

    try {
      const [profileResult, resumeResult, skillsResult, plansResult, stepsResult] =
        await Promise.all([
          client.query<CareerProfile>(
            `SELECT * FROM jack.career_profiles WHERE user_id = $1 LIMIT 1`,
            [userId]
          ),
          client.query<Resume>(
            `SELECT * FROM jack.resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [userId]
          ),
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
        careerProfile: profileResult.rows[0] ?? null,
        resume: resumeResult.rows[0] ?? null,
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
   * Upsert career profile and optional resume for a user
   */
  static async upsertCareerProfile(
    userId: string,
    input: UpsertCareerProfileInput
  ): Promise<{ careerProfile: CareerProfile; resume?: Resume }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const profileResult = await client.query<CareerProfile>(
        `
        INSERT INTO jack.career_profiles (user_id, current_role, target_role, experience_years)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          current_role = COALESCE(EXCLUDED.current_role, jack.career_profiles.current_role),
          target_role = COALESCE(EXCLUDED.target_role, jack.career_profiles.target_role),
          experience_years = COALESCE(EXCLUDED.experience_years, jack.career_profiles.experience_years),
          updated_at = NOW()
        RETURNING *
        `,
        [
          userId,
          input.current_role ?? null,
          input.target_role ?? null,
          input.experience_years ?? null,
        ]
      );

      const careerProfile = profileResult.rows[0];

      let resume: Resume | undefined;

      if (input.resume_text && input.resume_text.trim().length > 0) {
        const resumeResult = await client.query<Resume>(
          `
          INSERT INTO jack.resumes (user_id, resume_text)
          VALUES ($1, $2)
          RETURNING *
          `,
          [userId, input.resume_text]
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

  /**
   * Get or generate a fake AI readiness score for a user
   * For now this returns a static mock score and does not call AI.
   */
  static async getAiReadinessScore(
    userId: string
  ): Promise<{ score: number; summary: string; recommendations: string[] }> {
    // Optional: in future we can store the score in DB; for now just return mock
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

  /**
   * Calculate a mock AI readiness score based on number of user skills
   */
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
}

