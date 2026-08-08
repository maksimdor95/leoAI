export type MissingSkillDetail = {
  skill: string;
  count: number;
};

export type MissingSkillsSignalInput = {
  missingSkills?: string[];
};

/**
 * Aggregate missing skills across match rows by frequency.
 * Only gaps that appear in more than `minCount` vacancies are returned
 * (default: >35 — weak one-offs stay out of the insight list).
 */
export function aggregateMissingSkillsTop(
  rows: MissingSkillsSignalInput[],
  options?: { amongTopN?: number; limit?: number; minCount?: number }
): {
  missingSkillsTop: string[];
  missingSkillsDetails: MissingSkillDetail[];
  missingSkillsAmongTopN: number;
  /** Unique gap labels before minCount/limit filters (for diagnostics). */
  missingSkillsTotalUnique: number;
} {
  const amongTopN = options?.amongTopN ?? 20;
  const limit = options?.limit ?? 25;
  /** Strictly greater than this count (user: «больше 35»). */
  const minCount = options?.minCount ?? 35;
  const pool = rows.slice(0, amongTopN);
  const counts = new Map<string, number>();
  for (const m of pool) {
    for (const skill of m.missingSkills ?? []) {
      const key = skill.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const missingSkillsTotalUnique = sorted.length;
  const missingSkillsDetails = sorted
    .filter(([, count]) => count > minCount)
    .slice(0, limit)
    .map(([skill, count]) => ({ skill, count }));
  return {
    missingSkillsTop: missingSkillsDetails.map((d) => d.skill),
    missingSkillsDetails,
    missingSkillsAmongTopN: pool.length,
    missingSkillsTotalUnique,
  };
}
