/**
 * Idempotent merge of skill labels into a comma/semicolon-separated profile field.
 */
export function parseSkillsList(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,;/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mergeSkillsIntoList(
  current: string | null | undefined,
  toAdd: string[]
): { next: string; added: string[] } {
  const existing = parseSkillsList(current);
  const existingLower = new Set(existing.map((s) => s.toLowerCase()));
  const added: string[] = [];
  for (const skill of toAdd) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    if (existingLower.has(trimmed.toLowerCase())) continue;
    existing.push(trimmed);
    existingLower.add(trimmed.toLowerCase());
    added.push(trimmed);
  }
  return { next: existing.join(', '), added };
}
