-- Weekly profile health check (prod / staging Postgres, schema jack)
--
-- Run on VPS:
--   ssh ubuntu@84.54.57.209
--   cd ~/leoAI
--   docker exec -i jack-postgres psql -U postgres -d jack_ai -v ON_ERROR_STOP=1 \
--     < scripts/ops/weekly-profile-check.sql
--
-- Or from Mac (if SSH + docker available):
--   ssh ubuntu@84.54.57.209 'cd ~/leoAI && docker exec -i jack-postgres psql -U postgres -d jack_ai -v ON_ERROR_STOP=1' \
--     < scripts/ops/weekly-profile-check.sql
--
-- Completeness buckets use enriched.profile_completeness (0..1), written after Jack enrichment.
-- Fields presence uses profile_data.fields from chat / resume import.

\echo '=== 1) Accounts ==='
SELECT
  COUNT(*) AS users_total,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS users_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS users_30d,
  COUNT(*) FILTER (WHERE google_id IS NOT NULL) AS users_google,
  COUNT(*) FILTER (WHERE yandex_id IS NOT NULL) AS users_yandex,
  COUNT(*) FILTER (
    WHERE google_id IS NULL AND yandex_id IS NULL
  ) AS users_email_only
FROM jack.users;

\echo '=== 2) New accounts by day (last 14d) ==='
SELECT created_at::date AS day, COUNT(*) AS new_users
FROM jack.users
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo '=== 3) Career tracks overview ==='
SELECT
  COUNT(*) AS tracks_total,
  COUNT(DISTINCT user_id) AS users_with_track,
  COUNT(*) FILTER (WHERE is_default) AS default_tracks,
  COUNT(*) FILTER (
    WHERE profile_data->'enriched' ? 'profile_completeness'
  ) AS tracks_with_enrichment,
  ROUND(AVG(
    NULLIF(profile_data->'enriched'->>'profile_completeness', '')::numeric
  ), 3) AS avg_completeness,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY NULLIF(profile_data->'enriched'->>'profile_completeness', '')::float
  )::numeric, 3) AS median_completeness
FROM jack.career_tracks;

\echo '=== 4) Completeness distribution (enriched only) ==='
SELECT bucket AS completeness_bucket, COUNT(*) AS tracks
FROM (
  SELECT
    CASE
      WHEN c IS NULL THEN 'no_enrichment'
      WHEN c < 0.25 THEN '0-24%'
      WHEN c < 0.5 THEN '25-49%'
      WHEN c < 0.75 THEN '50-74%'
      WHEN c < 1 THEN '75-99%'
      ELSE '100%'
    END AS bucket,
    CASE
      WHEN c IS NULL THEN 0
      WHEN c < 0.25 THEN 1
      WHEN c < 0.5 THEN 2
      WHEN c < 0.75 THEN 3
      WHEN c < 1 THEN 4
      ELSE 5
    END AS sort_key
  FROM (
    SELECT NULLIF(profile_data->'enriched'->>'profile_completeness', '')::float AS c
    FROM jack.career_tracks
  ) raw
) t
GROUP BY bucket, sort_key
ORDER BY sort_key;

\echo '=== 5) Field fill rates (profile_data.fields) ==='
SELECT
  COUNT(*) AS tracks,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'desired_role'
    OR profile_data->'fields' ? 'desiredRole') AS has_desired_role,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'skills_hard'
    OR profile_data->'fields' ? 'skills_soft'
    OR profile_data->'fields' ? 'skills') AS has_skills,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'careerSummary') AS has_career_summary,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'totalExperience') AS has_experience,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'education_main'
    OR profile_data->'fields' ? 'education') AS has_education,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'desired_location'
    OR profile_data->'fields' ? 'workMode'
    OR profile_data->'fields' ? 'workFormat'
    OR profile_data->'fields' ? 'location') AS has_location,
  COUNT(*) FILTER (WHERE profile_data->'fields' ? 'desired_salary'
    OR profile_data->'fields' ? 'salaryExpectation') AS has_salary,
  COUNT(*) FILTER (WHERE COALESCE(target_role, '') <> '') AS has_target_role_col,
  COUNT(*) FILTER (WHERE experience_years IS NOT NULL) AS has_experience_years_col
FROM jack.career_tracks;

\echo '=== 6) Resumes ==='
SELECT
  COUNT(*) AS resume_rows,
  COUNT(DISTINCT user_id) AS users_with_resume,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS resumes_7d
FROM jack.resumes;

\echo '=== 7) Users without meaningful profile fill ==='
SELECT
  COUNT(*) AS users_empty_or_thin
FROM jack.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM jack.career_tracks ct
  WHERE ct.user_id = u.id
    AND (
      COALESCE((ct.profile_data->'enriched'->>'profile_completeness')::float, 0) >= 0.25
      OR COALESCE(ct.target_role, '') <> ''
      OR COALESCE(ct.profile_data->'fields'->>'desired_role', '') <> ''
      OR COALESCE(ct.profile_data->'fields'->>'skills_hard', '') <> ''
    )
)
AND NOT EXISTS (
  SELECT 1 FROM jack.resumes r WHERE r.user_id = u.id
);

\echo '=== 8) Sample recently updated tracks (no PII emails) ==='
SELECT
  ct.id AS track_id,
  ct.user_id,
  ct.name,
  ct.target_role,
  ROUND(
    NULLIF(ct.profile_data->'enriched'->>'profile_completeness', '')::numeric,
    2
  ) AS completeness,
  ct.profile_data->'enriched'->>'role_family' AS role_family,
  ct.updated_at
FROM jack.career_tracks ct
ORDER BY ct.updated_at DESC NULLS LAST
LIMIT 15;

\echo '=== Done ==='
