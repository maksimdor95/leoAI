/**
 * LEO Med Phase 3 — specialist profiles + consent A metric.
 */

import pool from '../../config/database';
import { getMedRoleById } from './catalog';
import type { MedRoleLevel } from './types';

export const CONSENT_A_VERSION = 'med-a-2026-08-29';
export const CONSENT_B_VERSION = 'med-b-2026-08-26';

export const MED_EMPLOYMENT_TYPES = [
  'permanent',
  'combination',
  'side_job',
  'temporary',
] as const;

export type MedEmploymentType = (typeof MED_EMPLOYMENT_TYPES)[number];

export interface MedSpecialistInput {
  session_id?: string | null;
  user_id?: string | null;
  med_role_id: string;
  skill_ids?: string[];
  duty_ids?: string[];
  experience_text?: string | null;
  documents_text?: string | null;
  city?: string | null;
  employment_type?: string | null;
  consent_a: boolean;
  /** Reserved; ignored for metric N until B2B. Must not be required. */
  consent_b?: boolean;
}

export interface MedSpecialistRecord {
  id: string;
  session_id: string | null;
  user_id: string | null;
  med_role_id: string;
  med_level: MedRoleLevel;
  role_title: string | null;
  skill_ids: string[];
  duty_ids: string[];
  experience_text: string | null;
  documents_text: string | null;
  city: string | null;
  employment_type: string | null;
  consent_a: boolean;
  consent_a_at: string | null;
  consent_a_version: string | null;
  consent_b: boolean;
  completed_at: string | null;
  created_at: string;
}

export type MedSpecialistValidationError =
  | { code: 'ROLE_REQUIRED' | 'ROLE_UNKNOWN' | 'CONSENT_A_REQUIRED' | 'EMPLOYMENT_INVALID'; message: string };

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, 200);
}

export function validateMedSpecialistInput(
  body: unknown
): { ok: true; value: MedSpecialistInput & { med_level: MedRoleLevel; role_title: string } } | {
  ok: false;
  error: MedSpecialistValidationError;
} {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const medRoleId = typeof raw.med_role_id === 'string' ? raw.med_role_id.trim() : '';
  if (!medRoleId) {
    return { ok: false, error: { code: 'ROLE_REQUIRED', message: 'med_role_id is required' } };
  }
  const role = getMedRoleById(medRoleId);
  if (!role) {
    return { ok: false, error: { code: 'ROLE_UNKNOWN', message: 'Unknown med_role_id' } };
  }
  if (raw.consent_a !== true) {
    return {
      ok: false,
      error: {
        code: 'CONSENT_A_REQUIRED',
        message: 'consent_a must be true to complete a LEO Med profile',
      },
    };
  }

  const employmentRaw =
    typeof raw.employment_type === 'string' && raw.employment_type.trim()
      ? raw.employment_type.trim()
      : null;
  if (
    employmentRaw &&
    !MED_EMPLOYMENT_TYPES.includes(employmentRaw as MedEmploymentType)
  ) {
    return {
      ok: false,
      error: {
        code: 'EMPLOYMENT_INVALID',
        message: `employment_type must be one of: ${MED_EMPLOYMENT_TYPES.join(', ')}`,
      },
    };
  }

  return {
    ok: true,
    value: {
      session_id:
        typeof raw.session_id === 'string' && raw.session_id.trim()
          ? raw.session_id.trim().slice(0, 64)
          : null,
      user_id:
        typeof raw.user_id === 'string' && raw.user_id.trim() ? raw.user_id.trim() : null,
      med_role_id: role.id,
      med_level: role.level,
      role_title: role.title,
      skill_ids: asStringArray(raw.skill_ids),
      duty_ids: asStringArray(raw.duty_ids),
      experience_text:
        typeof raw.experience_text === 'string' ? raw.experience_text.trim().slice(0, 4000) : null,
      documents_text:
        typeof raw.documents_text === 'string' ? raw.documents_text.trim().slice(0, 4000) : null,
      city: typeof raw.city === 'string' ? raw.city.trim().slice(0, 120) : null,
      employment_type: employmentRaw,
      consent_a: true,
      consent_b: raw.consent_b === true,
    },
  };
}

function mapRow(row: Record<string, unknown>): MedSpecialistRecord {
  return {
    id: String(row.id),
    session_id: row.session_id != null ? String(row.session_id) : null,
    user_id: row.user_id != null ? String(row.user_id) : null,
    med_role_id: String(row.med_role_id),
    med_level: row.med_level as MedRoleLevel,
    role_title: row.role_title != null ? String(row.role_title) : null,
    skill_ids: asStringArray(row.skill_ids),
    duty_ids: asStringArray(row.duty_ids),
    experience_text: row.experience_text != null ? String(row.experience_text) : null,
    documents_text: row.documents_text != null ? String(row.documents_text) : null,
    city: row.city != null ? String(row.city) : null,
    employment_type: row.employment_type != null ? String(row.employment_type) : null,
    consent_a: Boolean(row.consent_a),
    consent_a_at: row.consent_a_at != null ? new Date(String(row.consent_a_at)).toISOString() : null,
    consent_a_version: row.consent_a_version != null ? String(row.consent_a_version) : null,
    consent_b: Boolean(row.consent_b),
    completed_at: row.completed_at != null ? new Date(String(row.completed_at)).toISOString() : null,
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

export async function createMedSpecialist(
  input: MedSpecialistInput & { med_level: MedRoleLevel; role_title: string }
): Promise<MedSpecialistRecord> {
  const consentB = input.consent_b === true;
  const result = await pool.query(
    `INSERT INTO med_specialists (
      session_id, user_id, med_role_id, med_level, role_title,
      skill_ids, duty_ids, experience_text, documents_text, city, employment_type,
      consent_a, consent_a_at, consent_a_version,
      consent_b, consent_b_at, consent_b_version,
      completed_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6::jsonb, $7::jsonb, $8, $9, $10, $11,
      true, NOW(), $12,
      $13, CASE WHEN $13 THEN NOW() ELSE NULL END, CASE WHEN $13 THEN $14 ELSE NULL END,
      NOW()
    )
    RETURNING *`,
    [
      input.session_id ?? null,
      input.user_id ?? null,
      input.med_role_id,
      input.med_level,
      input.role_title,
      JSON.stringify(input.skill_ids || []),
      JSON.stringify(input.duty_ids || []),
      input.experience_text || null,
      input.documents_text || null,
      input.city || null,
      input.employment_type || null,
      CONSENT_A_VERSION,
      consentB,
      CONSENT_B_VERSION,
    ]
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function getMedSpecialistById(id: string): Promise<MedSpecialistRecord | null> {
  const result = await pool.query(`SELECT * FROM med_specialists WHERE id = $1`, [id]);
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

/** Metric N: completed profiles with consent A. */
export async function countCompletedMedProfilesWithConsentA(): Promise<number> {
  const result = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM med_specialists
     WHERE consent_a = true AND completed_at IS NOT NULL`
  );
  return parseInt(result.rows[0]?.n || '0', 10) || 0;
}
