/** Убирает дубликаты локаций (HH часто дублирует area.name и address.city). */
export function uniqueLocationLabels(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (value == null) continue;
    const label = value.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }

  return result;
}
