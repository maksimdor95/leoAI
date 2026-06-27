/**
 * Prep Pack artifacts (C3) — LAR Pack layer persisted for UI + PDF.
 */

import type { InterviewPrepMode } from '../types/message';

export type PrepPackType =
  | 'diagnostics_map'
  | 'theory_cheatsheet'
  | 'rescue_cheatsheet'
  | 'star_pack'
  | 'case_structure'
  | 'mock_summary'
  | 'employer_questions'
  | 'prep_complete';

export interface PrepArtifact {
  id: string;
  packType: PrepPackType;
  mode: InterviewPrepMode;
  title: string;
  content: string;
  createdAt: string;
  messageId?: string;
}

export const PREP_PACK_LABELS: Record<PrepPackType, string> = {
  diagnostics_map: 'Карта пробелов',
  theory_cheatsheet: 'Шпаргалка из урока',
  rescue_cheatsheet: 'Разбор коуча',
  star_pack: 'STAR-история',
  case_structure: 'Структура кейса',
  mock_summary: 'Итог мок-интервью',
  employer_questions: 'Вопросы работодателю',
  prep_complete: 'Итог подготовки',
};

export function getPrepArtifacts(collected: Record<string, unknown>): PrepArtifact[] {
  const raw = collected.prepArtifacts;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PrepArtifact =>
      item != null &&
      typeof item === 'object' &&
      typeof (item as PrepArtifact).packType === 'string' &&
      typeof (item as PrepArtifact).content === 'string'
  );
}

export function appendPrepArtifact(
  collected: Record<string, unknown>,
  artifact: {
    packType: PrepPackType;
    mode: InterviewPrepMode;
    title: string;
    content: string;
    messageId?: string;
    id?: string;
  }
): PrepArtifact[] {
  const existing = getPrepArtifacts(collected);
  const entry: PrepArtifact = {
    id: artifact.id ?? `pack-${artifact.packType}-${Date.now()}`,
    packType: artifact.packType,
    mode: artifact.mode,
    title: artifact.title,
    content: artifact.content.trim(),
    createdAt: new Date().toISOString(),
    messageId: artifact.messageId,
  };
  if (!entry.content) return existing;

  const withoutDup = existing.filter(
    (item) => !(item.packType === entry.packType && item.content === entry.content)
  );
  return [...withoutDup, entry].slice(-24);
}

export function mergePrepArtifacts(
  collected: Record<string, unknown>,
  patch: Record<string, unknown>,
  artifact?: {
    packType: PrepPackType;
    mode: InterviewPrepMode;
    title: string;
    content: string;
    messageId?: string;
  }
): Record<string, unknown> {
  if (!artifact?.content?.trim()) {
    return { ...collected, ...patch };
  }
  const merged = { ...collected, ...patch };
  return {
    ...merged,
    prepArtifacts: appendPrepArtifact(merged, artifact),
  };
}

export function packTitle(packType: PrepPackType, mode?: InterviewPrepMode): string {
  const modeLabel = mode ? ` · ${mode}` : '';
  return `${PREP_PACK_LABELS[packType]}${modeLabel}`;
}
