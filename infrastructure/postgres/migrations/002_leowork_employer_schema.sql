-- ============================================================
-- LEOWORK AI — employer schema (Phase 1 / L1.1)
-- Run: psql -U postgres -d jack_ai -f infrastructure/postgres/migrations/002_leowork_employer_schema.sql
-- Idempotent where practical (IF NOT EXISTS).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS employer;

COMMENT ON SCHEMA employer IS 'LEOWORK B2B: companies, briefs, shortlist, intros, pipeline, billing';

-- ----------------------------------------------------------
-- 1. Companies
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    industry        VARCHAR(100),
    size            VARCHAR(50),
    website         VARCHAR(500),
    description     TEXT,
    logo_url        VARCHAR(500),

    contact_name    VARCHAR(255) NOT NULL,
    contact_email   VARCHAR(255) NOT NULL,
    contact_phone   VARCHAR(50),
    contact_role    VARCHAR(100),

    api_key_hash    VARCHAR(255) NOT NULL,
    api_key_prefix  VARCHAR(8) NOT NULL,

    fee_percent     DECIMAL(4,2) DEFAULT 10.00,
    guarantee_days  INTEGER DEFAULT 90,

    status          VARCHAR(50) DEFAULT 'active',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_api_key_prefix
    ON employer.companies(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_companies_status
    ON employer.companies(status);

-- ----------------------------------------------------------
-- 2. Hiring briefs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.hiring_briefs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES employer.companies(id) ON DELETE CASCADE,

    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    requirements        TEXT,
    raw_text            TEXT,

    desired_skills      JSONB DEFAULT '[]',
    experience_min      INTEGER,
    experience_max      INTEGER,
    experience_level    VARCHAR(50),
    salary_min          INTEGER,
    salary_max          INTEGER,
    currency            VARCHAR(10) DEFAULT 'RUB',
    location            JSONB DEFAULT '[]',
    work_mode           VARCHAR(50),

    role_family         VARCHAR(50),
    embedding           vector(256),

    calibration_feedback JSONB DEFAULT '[]',

    status              VARCHAR(50) DEFAULT 'active',
    filled_at           TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefs_company_id
    ON employer.hiring_briefs(company_id);
CREATE INDEX IF NOT EXISTS idx_briefs_status
    ON employer.hiring_briefs(status);
CREATE INDEX IF NOT EXISTS idx_briefs_role_family
    ON employer.hiring_briefs(role_family);

-- ----------------------------------------------------------
-- 3. Candidate shortlist
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.candidate_shortlist (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id            UUID NOT NULL REFERENCES employer.hiring_briefs(id) ON DELETE CASCADE,
    candidate_user_id   UUID NOT NULL,

    match_score         INTEGER,
    match_reasons       JSONB,
    role_family_match   VARCHAR(50),

    ai_summary          TEXT,
    ai_strengths        JSONB DEFAULT '[]',
    ai_concerns         JSONB DEFAULT '[]',

    display_name        VARCHAR(100),

    status              VARCHAR(50) DEFAULT 'suggested',

    employer_notes      TEXT,
    employer_rating     INTEGER,

    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),

    UNIQUE(brief_id, candidate_user_id)
);

CREATE INDEX IF NOT EXISTS idx_shortlist_brief_id
    ON employer.candidate_shortlist(brief_id);
CREATE INDEX IF NOT EXISTS idx_shortlist_candidate
    ON employer.candidate_shortlist(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_shortlist_status
    ON employer.candidate_shortlist(status);

-- ----------------------------------------------------------
-- 4. Introductions
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.introductions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shortlist_id            UUID REFERENCES employer.candidate_shortlist(id),
    brief_id                UUID NOT NULL REFERENCES employer.hiring_briefs(id),
    company_id              UUID NOT NULL REFERENCES employer.companies(id),
    candidate_user_id       UUID NOT NULL,

    intro_text              TEXT NOT NULL,
    candidate_pitch         TEXT,

    delivery_method         VARCHAR(50) DEFAULT 'email',

    candidate_consent       BOOLEAN DEFAULT false,
    candidate_consent_at    TIMESTAMP,
    candidate_decline_reason TEXT,

    employer_response       VARCHAR(50) DEFAULT 'pending',
    candidate_response      VARCHAR(50) DEFAULT 'pending',

    sent_at                 TIMESTAMP,
    employer_responded_at   TIMESTAMP,
    candidate_responded_at  TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intros_brief_id
    ON employer.introductions(brief_id);
CREATE INDEX IF NOT EXISTS idx_intros_company_id
    ON employer.introductions(company_id);
CREATE INDEX IF NOT EXISTS idx_intros_candidate
    ON employer.introductions(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_intros_employer_response
    ON employer.introductions(employer_response);

-- ----------------------------------------------------------
-- 5. Pipeline events
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.pipeline_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id            UUID NOT NULL REFERENCES employer.hiring_briefs(id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES employer.companies(id),
    candidate_user_id   UUID NOT NULL,

    stage               VARCHAR(50) NOT NULL,
    previous_stage      VARCHAR(50),
    notes               TEXT,
    actor               VARCHAR(50) DEFAULT 'system',

    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_brief_id
    ON employer.pipeline_events(brief_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_candidate
    ON employer.pipeline_events(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage
    ON employer.pipeline_events(stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_created
    ON employer.pipeline_events(created_at);

-- ----------------------------------------------------------
-- 6. Billing
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.invoices (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES employer.companies(id),
    brief_id                UUID NOT NULL REFERENCES employer.hiring_briefs(id),
    candidate_user_id       UUID NOT NULL,

    candidate_salary_annual INTEGER NOT NULL,
    fee_percent             DECIMAL(4,2) NOT NULL,
    fee_amount              INTEGER NOT NULL,
    currency                VARCHAR(10) DEFAULT 'RUB',

    status                  VARCHAR(50) DEFAULT 'pending',

    hired_at                TIMESTAMP,
    invoiced_at             TIMESTAMP,
    paid_at                 TIMESTAMP,
    guarantee_expires_at    TIMESTAMP,
    refunded_at             TIMESTAMP,

    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company
    ON employer.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status
    ON employer.invoices(status);

-- ----------------------------------------------------------
-- 7. Candidate consent (B2B-managed, candidate_user_id → jack.users)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS employer.candidate_consent (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_user_id   UUID NOT NULL,
    consent_type        VARCHAR(50) NOT NULL,
    intro_id            UUID REFERENCES employer.introductions(id),
    granted             BOOLEAN NOT NULL,
    granted_at          TIMESTAMP,
    revoked_at          TIMESTAMP,
    ip_address          VARCHAR(45),

    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_candidate
    ON employer.candidate_consent(candidate_user_id);

-- Future: jack.users opt-in columns (Phase 3 / L7)
-- ALTER TABLE jack.users ADD COLUMN IF NOT EXISTS opt_in_introductions BOOLEAN DEFAULT false;
-- ALTER TABLE jack.users ADD COLUMN IF NOT EXISTS intro_privacy_level VARCHAR(50) DEFAULT 'anonymous';
