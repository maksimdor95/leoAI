/**
 * Idempotent DDL for jobs table (startup + init:db).
 */
export const JOBS_ROLE_FAMILY_MIGRATION_SQL = `
  DO $$
  BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'role_family'
      ) THEN
          ALTER TABLE jobs ADD COLUMN role_family VARCHAR(50);
      END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_jobs_role_family ON jobs(role_family);
  CREATE INDEX IF NOT EXISTS idx_jobs_role_family_posted_at
    ON jobs(role_family, posted_at DESC NULLS LAST, created_at DESC);
`;

export const JOBS_SOURCE_META_MIGRATION_SQL = `
  DO $$
  BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'source_meta'
      ) THEN
          ALTER TABLE jobs ADD COLUMN source_meta JSONB;
      END IF;
  END $$;
`;
