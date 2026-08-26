/**
 * LEO Med Phase 0 data loaders: role nomenclature + source registry.
 * No ingest / matching until ENABLE_MED_VERTICAL and Phase 1.
 */

import rolesCatalog from '../data/med/med_roles.json';
import sourcesRegistry from '../data/med/med_sources.json';
import type {
  MedRole,
  MedRoleLevel,
  MedRolesCatalog,
  MedSource,
  MedSourcesRegistry,
} from './types';

export function getMedRolesCatalog(): MedRolesCatalog {
  return rolesCatalog as MedRolesCatalog;
}

export function getMedSourcesRegistry(): MedSourcesRegistry {
  return sourcesRegistry as MedSourcesRegistry;
}

export function listMedRoles(level?: MedRoleLevel): MedRole[] {
  const roles = getMedRolesCatalog().roles;
  if (!level) return [...roles];
  return roles.filter((r) => r.level === level);
}

export function getMedRoleById(id: string): MedRole | undefined {
  return getMedRolesCatalog().roles.find((r) => r.id === id);
}

/** Active hire titles only (excludes closed-from dates that have passed). */
export function listOpenMedRoles(level?: MedRoleLevel, asOf = new Date()): MedRole[] {
  const iso = asOf.toISOString().slice(0, 10);
  return listMedRoles(level).filter(
    (r) => !r.hiring_closed_from || r.hiring_closed_from > iso
  );
}

export function listMedSources(opts?: {
  status?: MedSource['status'];
  type?: MedSource['type'];
}): MedSource[] {
  let list = [...getMedSourcesRegistry().sources];
  if (opts?.status) list = list.filter((s) => s.status === opts.status);
  if (opts?.type) list = list.filter((s) => s.type === opts.type);
  return list;
}

export function listPlannedTgChannels(): MedSource[] {
  return listMedSources({ type: 'tg', status: 'planned' });
}
