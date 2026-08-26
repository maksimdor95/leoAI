/**
 * LEO Med vertical — Phase 0–3.
 * Spec: docs/MED_VERTICAL_BRIEF.md
 */

export { isMedVerticalEnabled } from './config';
export {
  getMedRoleById,
  getMedRolesCatalog,
  getMedSourcesRegistry,
  listMedRoles,
  listMedSources,
  listOpenMedRoles,
  listPlannedTgChannels,
} from './catalog';
export { resolveMedRoleIdFromCollected } from './chatProfile';
export { buildMedScrapeKeywords, getMedScrapeKeywordLimit } from './keywords';
export {
  applyMedRoleMapping,
  mapVacancyToMedRole,
  MED_UNKNOWN_ROLE_ID,
} from './mapRole';
export type { MedMapConfidence, MedRoleMatch } from './mapRole';
export { scrapeMedCatalog } from './scrapeMed';
export { fetchMedTelegramJobs, listActiveMedTgChannels } from './tgIngest';
export {
  countSharedDictionary,
  getMedTaxonomyCatalog,
  getMedTaxonomyDisclaimer,
  getTaxonomyByMedRoleId,
  getTaxonomyBySourceTitle,
  getTaxonomyItem,
  listMedTaxonomyRoles,
  listTaxonomiesForLevel,
  rankMedTaxonomyItemsForPrefill,
  resolveMedTaxonomyForRole,
} from './taxonomy';
export {
  CONSENT_A_VERSION,
  CONSENT_B_VERSION,
  MED_EMPLOYMENT_TYPES,
  countCompletedMedProfilesWithConsentA,
  createMedSpecialist,
  getMedSpecialistById,
  validateMedSpecialistInput,
} from './specialists';
export type {
  MedEmploymentType,
  MedSpecialistInput,
  MedSpecialistRecord,
  MedSpecialistValidationError,
} from './specialists';
export type {
  MedRole,
  MedRoleLevel,
  MedRoleTaxonomy,
  MedRoleTaxonomyResolved,
  MedRolesCatalog,
  MedSource,
  MedSourcePriority,
  MedSourceStatus,
  MedSourcesRegistry,
  MedTaxonomyCatalog,
  MedTaxonomyItem,
  MedTaxonomyKind,
  MedTaxonomyProvenance,
} from './types';
