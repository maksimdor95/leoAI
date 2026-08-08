export type SkillGapBucket = 'hard' | 'soft';

const SOFT_PATTERNS: RegExp[] = [
  /постановк\w*\s+задач/i,
  /управлен\w*\s+команд/i,
  /фасилит/i,
  /стейкхолдер/i,
  /stakeholder/i,
  /переговор/i,
  /negotiat/i,
  /лидерств/i,
  /leadership/i,
  /ментор/i,
  /mentor/i,
  /коммуникац/i,
  /communicat/i,
  /презентац/i,
  /presentat/i,
  /конфликт/i,
  /people\s*management/i,
  /управленческие/i,
];

/**
 * Route gap labels into profile fields: skills_hard vs skills_soft.
 * Default is hard (technical) — most vacancy tags are skills/tools.
 */
export function classifySkillGapBucket(skill: string): SkillGapBucket {
  const s = skill.trim();
  if (!s) return 'hard';
  for (const re of SOFT_PATTERNS) {
    if (re.test(s)) return 'soft';
  }
  return 'hard';
}

export function partitionSkillsByBucket(skills: string[]): {
  hard: string[];
  soft: string[];
} {
  const hard: string[] = [];
  const soft: string[] = [];
  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    if (classifySkillGapBucket(trimmed) === 'soft') soft.push(trimmed);
    else hard.push(trimmed);
  }
  return { hard, soft };
}
