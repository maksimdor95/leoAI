/**
 * P0.3: не дергать job-matching, пока в анкете Jack нет минимума для осмысленного матча.
 * Ключи совпадают с collectKey в jackScenario (snake_case в Redis / collectedData).
 *
 * Критерий готовности (достаточно одного):
 * 1. `desired_role` или `desiredRole` — непустая строка
 * 2. Навыки (`skills_hard`, `skills_soft`, либо массив `skills`) И задан опыт `totalExperience`
 * 3. Хотя бы одно `position_N_role` (текущий/прошлый стек вопросов по местам работы) И `totalExperience`
 */

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasMeaningfulExperience(collected: Record<string, unknown>): boolean {
  const exp = collected.totalExperience;
  if (typeof exp === 'number' && !Number.isNaN(exp)) return true;
  if (typeof exp === 'string' && exp.trim() !== '') return true;
  return false;
}

function hasAnyPositionRole(collected: Record<string, unknown>): boolean {
  for (let i = 1; i <= 5; i += 1) {
    if (nonEmptyString(collected[`position_${i}_role`])) return true;
  }
  return false;
}

function hasSkillsSignal(collected: Record<string, unknown>): boolean {
  if (Array.isArray(collected.skills) && collected.skills.length > 0) return true;
  if (nonEmptyString(collected.skills_hard)) return true;
  if (nonEmptyString(collected.skills_soft)) return true;
  return false;
}

/** Можно вызывать авто-подбор / тихий refresh матча (не раньше этого минимума). Ручное «Обновить» не ограничиваем. */
export function jackCollectedDataReadyForJobMatch(
  collected: Record<string, unknown> | undefined | null
): boolean {
  if (!collected || typeof collected !== 'object') return false;

  if (nonEmptyString(collected.desired_role) || nonEmptyString(collected.desiredRole)) {
    return true;
  }

  if (hasSkillsSignal(collected) && hasMeaningfulExperience(collected)) return true;

  if (hasAnyPositionRole(collected) && hasMeaningfulExperience(collected)) return true;

  return false;
}
