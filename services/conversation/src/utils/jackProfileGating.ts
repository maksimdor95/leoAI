/** Минимум профиля Jack для генерации отклика (зеркало frontend/lib/jackProfileGating.ts). */

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

export function jackCollectedDataReadyForApplication(
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
