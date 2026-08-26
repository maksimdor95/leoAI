/** LEO Med Phase 0 — role catalog + source registry types. */

export type MedRoleLevel = 'doctor' | 'mid' | 'junior';

export type MedSourceStatus = 'planned' | 'active' | 'paused';

export type MedSourcePriority = 'primary' | 'secondary' | 'high' | 'medium' | 'low';

export interface MedRole {
  id: string;
  level: MedRoleLevel;
  title: string;
  aliases: string[];
  nomenclature_ref: string;
  /** ISO date when new hiring into this title stops (per 434н notes), else null. */
  hiring_closed_from: string | null;
}

export interface MedRolesCatalog {
  version: number;
  notes: string;
  source: {
    title: string;
    publication_url: string;
    secondary_url?: string;
    effective_from: string;
    /** Non-434н extensions (pharma, leadership, market junior, …). */
    extensions?: string[];
  };
  levels: Array<{
    id: MedRoleLevel;
    title: string;
    nomenclature_sections: string[];
  }>;
  roles: MedRole[];
}

export interface MedSource {
  id: string;
  type: 'api' | 'html' | 'tg';
  kind: 'board' | 'channel';
  title: string;
  url: string;
  username?: string;
  priority: MedSourcePriority;
  legality: string;
  roles_coverage: MedRoleLevel[];
  geo: string;
  status: MedSourceStatus;
  contact?: string;
  notes?: string;
}

export interface MedSourcesRegistry {
  version: number;
  notes: string;
  geography_default: string;
  sources: MedSource[];
}

/** Phase 2 taxonomy */
export type MedTaxonomyKind = 'skill' | 'duty' | 'qualification' | 'task';

export type MedTaxonomyProvenance =
  | 'official'
  | 'open_source'
  | 'vacancy_parse'
  | 'llm_draft';

export interface MedTaxonomyItem {
  id: string;
  label: string;
  kind: MedTaxonomyKind;
  core?: boolean;
}

export interface MedRoleTaxonomy {
  source_title: string;
  layer: string;
  level: MedRoleLevel | null;
  family: string;
  specialty: string;
  aliases: string[];
  skill_ids: string[];
  duty_ids: string[];
  task_ids: string[];
  qualification_ids: string[];
  med_role_id: string | null;
  provenance: MedTaxonomyProvenance;
  source_refs: string[];
}

export interface MedTaxonomyCatalog {
  version: number;
  generated_at: string;
  notes: string;
  disclaimer: string;
  provenance_default: MedTaxonomyProvenance;
  stats: {
    professions: number;
    dictionary_size: number;
    mapped_to_med_role: number;
    unmapped: number;
  };
  dictionary: Record<string, MedTaxonomyItem>;
  roles: MedRoleTaxonomy[];
}

/** Resolved view for API / onboarding prefill */
export interface MedRoleTaxonomyResolved {
  med_role_id: string | null;
  source_title: string;
  level: MedRoleLevel | null;
  provenance: MedTaxonomyProvenance;
  disclaimer: string;
  skills: MedTaxonomyItem[];
  duties: MedTaxonomyItem[];
  tasks: MedTaxonomyItem[];
  qualifications: MedTaxonomyItem[];
  source_refs: string[];
}

