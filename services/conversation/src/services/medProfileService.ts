/**
 * LEO Med — ветка медработника внутри Jack-сценария.
 * Классификация роли и сохранение профиля живут в job-matching;
 * здесь только тонкий клиент с fail-open поведением.
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const JOB_MATCHING_SERVICE_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';

const DETECT_TIMEOUT_MS = 2500;
const SAVE_TIMEOUT_MS = 6000;

/** Сколько пунктов таксономии показываем в чате, чтобы вопрос оставался читаемым. */
const PREFILL_MAX_ITEMS = 8;

export interface MedRoleDetection {
  medRoleId: string;
  medRoleTitle: string;
  medLevel: string;
  medSkillIds: string[];
  medDutyIds: string[];
  medSkillsPrefill: string;
  medDutiesPrefill: string;
}

interface PrefillItem {
  id: string;
  label: string;
  core: boolean;
}

/** job-matching уже отдаёт список от специфичных пунктов к общим — берём верхушку. */
function pickPrefill(items: PrefillItem[] | undefined): PrefillItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.slice(0, PREFILL_MAX_ITEMS);
}

/**
 * Свободный текст желаемой должности → медицинская роль из каталога.
 * null — не медик, ошибка сети или выключенная вертикаль (fail-open в IT-ветку).
 */
export async function detectMedRole(desiredRole: string): Promise<MedRoleDetection | null> {
  const title = desiredRole.trim();
  if (!title) return null;

  try {
    const response = await axios.get(`${JOB_MATCHING_SERVICE_URL}/api/jobs/med/map-role`, {
      params: { title },
      timeout: DETECT_TIMEOUT_MS,
    });

    const data = response.data as {
      is_med?: boolean;
      med_role_id?: string | null;
      role_title?: string | null;
      level?: string | null;
      prefill?: { skills?: PrefillItem[]; duties?: PrefillItem[] } | null;
    };

    if (!data?.is_med || !data.med_role_id) return null;

    const skills = pickPrefill(data.prefill?.skills);
    const duties = pickPrefill(data.prefill?.duties);

    return {
      medRoleId: data.med_role_id,
      medRoleTitle: data.role_title || title,
      medLevel: data.level || '',
      medSkillIds: skills.map((item) => item.id),
      medDutyIds: duties.map((item) => item.id),
      medSkillsPrefill: skills.map((item) => item.label).join(', '),
      medDutiesPrefill: duties.map((item) => item.label).join(', '),
    };
  } catch (error: unknown) {
    logger.warn(`Med role detection failed for "${title}": ${String(error)}`);
    return null;
  }
}

export interface MedProfileSavePayload {
  sessionId: string;
  userId?: string | null;
  medRoleId: string;
  skillIds: string[];
  dutyIds: string[];
  experienceText?: string | null;
  documentsText?: string | null;
  city?: string | null;
  employmentType?: string | null;
}

/**
 * Профиль медика с согласием A. Возвращает id записи либо null, если сохранить не удалось.
 */
export async function saveMedSpecialistProfile(
  payload: MedProfileSavePayload
): Promise<string | null> {
  try {
    const response = await axios.post(
      `${JOB_MATCHING_SERVICE_URL}/api/jobs/med/profiles`,
      {
        session_id: payload.sessionId,
        user_id: payload.userId || null,
        med_role_id: payload.medRoleId,
        skill_ids: payload.skillIds,
        duty_ids: payload.dutyIds,
        experience_text: payload.experienceText || null,
        documents_text: payload.documentsText || null,
        city: payload.city || null,
        employment_type: payload.employmentType || null,
        consent_a: true,
      },
      { timeout: SAVE_TIMEOUT_MS }
    );

    const profile = (response.data as { profile?: { id?: string } })?.profile;
    if (profile?.id) {
      logger.info(`Med profile saved: id=${profile.id} session=${payload.sessionId}`);
      return profile.id;
    }
    return null;
  } catch (error: unknown) {
    logger.error(`Failed to save med profile for session ${payload.sessionId}: ${String(error)}`);
    return null;
  }
}

const CONFIRMATION_PATTERN = /^(все|всё)\s*(верно|правильно|ок)|^(да|верно|ок|окей|подтверждаю)/i;
const REMOVAL_PATTERN = /убр|убер|исключ|лишн|не\s+делаю|не\s+занимаюсь|без\s/i;
const ADDITION_PREFIX = /^(добавь|добавить|добавьте|еще|ещё|плюс|также|и)\s+/i;

export interface MedSkillsSelection {
  skillIds: string[];
  skillLabels: string[];
}

/**
 * Текст вопроса med_skills с явным списком из таксономии (map-role prefill).
 * Не зависит от LLM: список уже есть в collectedData после детекта роли.
 * null — prefill пуст, пусть сработает обычный fallback / LLM.
 */
export function buildMedSkillsQuestionText(collected: Record<string, unknown>): string | null {
  const skills = String(collected.medSkillsPrefill ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const duties = String(collected.medDutiesPrefill ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (skills.length === 0 && duties.length === 0) return null;

  const role =
    typeof collected.medRoleTitle === 'string' && collected.medRoleTitle.trim()
      ? collected.medRoleTitle.trim()
      : 'вашей специальности';

  const lines: string[] = [
    `По должности «${role}» собрал черновик из таксономии (это не медрекомендация). Проверьте список.`,
  ];
  if (skills.length > 0) {
    lines.push('Навыки / манипуляции:');
    for (const item of skills) lines.push(`• ${item}`);
  }
  if (duties.length > 0) {
    lines.push('Обязанности:');
    for (const item of duties) lines.push(`• ${item}`);
  }
  lines.push('Напишите «всё верно» либо что убрать и что добавить.');
  return lines.join('\n');
}

/**
 * Свободная правка предзаполненного списка таксономии.
 * «всё верно» — оставляем как есть; упоминание с формулировкой удаления — вычёркиваем;
 * остальное считаем добавлением от пользователя.
 */
export function applyMedSkillsFeedback(
  prefillIds: string[],
  prefillLabels: string[],
  feedback: string
): MedSkillsSelection {
  const ids = [...prefillIds];
  const labels = [...prefillLabels];
  const text = feedback.trim();

  if (!text || CONFIRMATION_PATTERN.test(text)) {
    return { skillIds: ids, skillLabels: labels };
  }

  const lower = text.toLowerCase();
  const keepIdx: number[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const mentioned = lower.includes(labels[i].toLowerCase());
    if (mentioned && REMOVAL_PATTERN.test(lower)) continue;
    keepIdx.push(i);
  }

  const keptIds = keepIdx.map((i) => ids[i]).filter(Boolean);
  const keptLabels = keepIdx.map((i) => labels[i]);

  if (REMOVAL_PATTERN.test(lower)) {
    return { skillIds: keptIds, skillLabels: keptLabels };
  }

  const additions = text
    .split(/[,;\n]+/)
    .map((part) => part.trim().replace(ADDITION_PREFIX, '').trim())
    .filter((part) => part.length > 1 && part.length <= 80)
    .filter((part) => !keptLabels.some((l) => l.toLowerCase() === part.toLowerCase()));

  return { skillIds: keptIds, skillLabels: [...keptLabels, ...additions] };
}

const EMPLOYMENT_PATTERNS: Array<[RegExp, string]> = [
  [/совмест/i, 'combination'],
  [/подработ|подмен|смен[аы]|разов/i, 'side_job'],
  [/времен|декрет|срочн|контракт на|вахт/i, 'temporary'],
  [/постоян|основн|полн[ыа][йя]|штат/i, 'permanent'],
];

/** Свободный ответ про формат занятости → enum med_specialists.employment_type. */
export function normalizeMedEmployment(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  for (const [pattern, value] of EMPLOYMENT_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}
