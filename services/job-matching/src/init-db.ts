/**
 * Initialize Database
 * Creates the jobs table if it doesn't exist
 */

import pool from './config/database';
import { logger } from './utils/logger';

async function initDatabase() {
  try {
    logger.info('Initializing database...');

    // Create jobs table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        company VARCHAR(255) NOT NULL,
        location JSONB NOT NULL DEFAULT '[]'::jsonb,
        salary_min INTEGER,
        salary_max INTEGER,
        currency VARCHAR(10),
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        experience_level VARCHAR(20),
        work_mode VARCHAR(20),
        source VARCHAR(50) NOT NULL,
        source_url TEXT NOT NULL UNIQUE,
        posted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- Create index on source_url for faster lookups
      CREATE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url);

      -- Create index on location for faster filtering
      CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs USING GIN(location);

      -- Create index on skills for faster matching
      CREATE INDEX IF NOT EXISTS idx_jobs_skills ON jobs USING GIN(skills);

      -- Create index on work_mode for faster filtering
      CREATE INDEX IF NOT EXISTS idx_jobs_work_mode ON jobs(work_mode);

      -- Create index on experience_level for faster filtering
      CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON jobs(experience_level);

      -- Create index on posted_at for sorting
      CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC NULLS LAST);

      -- Create index on created_at for sorting
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
    `;

    await pool.query(createTableQuery);
    logger.info('✅ Jobs table created successfully');

    // Check if table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      );
    `;

    const result = await pool.query(checkTableQuery);
    if (result.rows[0].exists) {
      logger.info('✅ Jobs table verified');
    } else {
      logger.error('❌ Jobs table was not created');
      process.exit(1);
    }
  } catch (error: unknown) {
    logger.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();
