/**
 * LEO Med Phase 2 — taxonomy catalog loaders.
 * Data: generated from docs/med/taxonomy_meditsina_rf.md
 */

import taxonomyCatalog from '../data/med/med_taxonomy.json';
import type {
  MedRoleTaxonomy,
  MedRoleTaxonomyResolved,
  MedTaxonomyCatalog,
  MedTaxonomyItem,
} from './types';

export function getMedTaxonomyCatalog(): MedTaxonomyCatalog {
  return taxonomyCatalog as MedTaxonomyCatalog;
}

export function getMedTaxonomyDisclaimer(): string {
  return getMedTaxonomyCatalog().disclaimer;
}

export function listMedTaxonomyRoles(): MedRoleTaxonomy[] {
  return [...getMedTaxonomyCatalog().roles];
}

export function getTaxonomyItem(id: string): MedTaxonomyItem | undefined {
  return getMedTaxonomyCatalog().dictionary[id];
}

function resolveIds(ids: string[]): MedTaxonomyItem[] {
  const dict = getMedTaxonomyCatalog().dictionary;
  const out: MedTaxonomyItem[] = [];
  for (const id of ids) {
    const item = dict[id];
    if (item) out.push(item);
  }
  return out;
}

function toResolved(role: MedRoleTaxonomy): MedRoleTaxonomyResolved {
  return {
    med_role_id: role.med_role_id,
    source_title: role.source_title,
    level: role.level,
    provenance: role.provenance,
    disclaimer: getMedTaxonomyDisclaimer(),
    skills: resolveIds(role.skill_ids),
    duties: resolveIds(role.duty_ids),
    tasks: resolveIds(role.task_ids),
    qualifications: resolveIds(role.qualification_ids),
    source_refs: role.source_refs,
  };
}

/** Lookup by med_roles.json id — prefer role whose source_title best matches catalog title. */
export function getTaxonomyByMedRoleId(medRoleId: string): MedRoleTaxonomyResolved | null {
  const matches = getMedTaxonomyCatalog().roles.filter((r) => r.med_role_id === medRoleId);
  if (matches.length === 0) return null;
  if (matches.length === 1) return toResolved(matches[0]);

  // Prefer exact / shortest generic title over "главная …" / specialized variants
  const ranked = [...matches].sort((a, b) => {
    const aChief = /главн/i.test(a.source_title) ? 1 : 0;
    const bChief = /главн/i.test(b.source_title) ? 1 : 0;
    if (aChief !== bChief) return aChief - bChief;
    return a.source_title.length - b.source_title.length;
  });
  return toResolved(ranked[0]);
}

/** Lookup by taxonomy source title (case-insensitive) */
export function getTaxonomyBySourceTitle(title: string): MedRoleTaxonomyResolved | null {
  const needle = title.trim().toLowerCase();
  const role = getMedTaxonomyCatalog().roles.find(
    (r) =>
      r.source_title.toLowerCase() === needle ||
      r.aliases.some((a) => a.toLowerCase() === needle)
  );
  return role ? toResolved(role) : null;
}

let itemFrequencyCache: Map<string, number> | null = null;

/** Сколько профессий делят каждый пункт словаря — общие для отрасли встречаются почти везде. */
function getItemFrequency(): Map<string, number> {
  if (itemFrequencyCache) return itemFrequencyCache;
  const freq = new Map<string, number>();
  for (const role of getMedTaxonomyCatalog().roles) {
    for (const id of [...role.skill_ids, ...role.duty_ids]) {
      freq.set(id, (freq.get(id) ?? 0) + 1);
    }
  }
  itemFrequencyCache = freq;
  return freq;
}

/**
 * Порядок для префилла онбординга: сначала специфичные для профессии пункты,
 * потом сквозные (этика, гигиена рук и пр.), которые есть у всех ролей.
 */
export function rankMedTaxonomyItemsForPrefill(items: MedTaxonomyItem[]): MedTaxonomyItem[] {
  const freq = getItemFrequency();
  return [...items].sort((a, b) => {
    const byFrequency = (freq.get(a.id) ?? 0) - (freq.get(b.id) ?? 0);
    if (byFrequency !== 0) return byFrequency;
    const byCore = (b.core ? 1 : 0) - (a.core ? 1 : 0);
    if (byCore !== 0) return byCore;
    return a.label.localeCompare(b.label);
  });
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[-–—_/.,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Префилл для онбординга: точная таксономия роли, иначе ближайшая базовая
 * («Врач-терапевт участковый» → «Врач-терапевт»). 52 роли каталога своей
 * таксономии не имеют, и без фолбэка чат остался бы с пустым списком.
 */
export function resolveMedTaxonomyForRole(
  medRoleId: string,
  roleTitle?: string | null
): MedRoleTaxonomyResolved | null {
  const exact = getTaxonomyByMedRoleId(medRoleId);
  if (exact) return exact;
  if (!roleTitle) return null;

  const haystack = normalizeTitle(roleTitle);
  if (!haystack) return null;

  let best: { role: MedRoleTaxonomy; length: number } | null = null;
  for (const role of getMedTaxonomyCatalog().roles) {
    const candidates = [role.source_title, ...role.aliases];
    for (const candidate of candidates) {
      const needle = normalizeTitle(candidate);
      if (needle.length < 5 || !haystack.includes(needle)) continue;
      if (!best || needle.length > best.length) {
        best = { role, length: needle.length };
      }
    }
  }

  return best ? toResolved(best.role) : null;
}

export function listTaxonomiesForLevel(
  level: 'doctor' | 'mid' | 'junior'
): MedRoleTaxonomyResolved[] {
  return getMedTaxonomyCatalog()
    .roles.filter((r) => r.level === level)
    .map(toResolved);
}

/** Shared skill dictionary size (skills may overlap across roles). */
export function countSharedDictionary(): number {
  return Object.keys(getMedTaxonomyCatalog().dictionary).length;
}
