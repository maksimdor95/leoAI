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

/** Soft-delete: closed/gone vacancies stay in DB but out of match feed. */
export const JOBS_ARCHIVED_AT_MIGRATION_SQL = `
  DO $$
  BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'archived_at'
      ) THEN
          ALTER TABLE jobs ADD COLUMN archived_at TIMESTAMPTZ;
      END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_jobs_archived_at ON jobs(archived_at);
  CREATE INDEX IF NOT EXISTS idx_jobs_revalidate_due
    ON jobs(updated_at ASC)
    WHERE archived_at IS NULL;
`;

/** LEO Med Phase 1: med_role_id tags Med inventory; NULL = Jack IT catalog. */
export const JOBS_MED_ROLE_MIGRATION_SQL = `
  DO $$
  BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'med_role_id'
      ) THEN
          ALTER TABLE jobs ADD COLUMN med_role_id VARCHAR(120);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'med_level'
      ) THEN
          ALTER TABLE jobs ADD COLUMN med_level VARCHAR(20);
      END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_jobs_med_role_id ON jobs(med_role_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_med_role_posted
    ON jobs(med_role_id, posted_at DESC NULLS LAST, created_at DESC)
    WHERE archived_at IS NULL AND med_role_id IS NOT NULL;
`;

/** LEO Med Phase 3: specialist profiles + consent A (metric N). */
export const MED_SPECIALISTS_MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS med_specialists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64),
    user_id UUID,
    med_role_id VARCHAR(120) NOT NULL,
    med_level VARCHAR(20) NOT NULL,
    role_title TEXT,
    skill_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    duty_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience_text TEXT,
    documents_text TEXT,
    city TEXT,
    employment_type VARCHAR(32),
    consent_a BOOLEAN NOT NULL DEFAULT false,
    consent_a_at TIMESTAMPTZ,
    consent_a_version VARCHAR(64),
    consent_b BOOLEAN NOT NULL DEFAULT false,
    consent_b_at TIMESTAMPTZ,
    consent_b_version VARCHAR(64),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_med_specialists_role
    ON med_specialists(med_role_id);
  CREATE INDEX IF NOT EXISTS idx_med_specialists_session
    ON med_specialists(session_id)
    WHERE session_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_med_specialists_metric_n
    ON med_specialists(completed_at DESC)
    WHERE consent_a = true AND completed_at IS NOT NULL;
`;
