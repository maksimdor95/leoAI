export type PrepVacancyRecord = {
  sessionId: string;
  role?: string;
  roleTrack?: string;
  level?: string;
  preparedAt?: string;
  prepComplete?: boolean;
};

export type StarBankEntry = {
  id: string;
  sourceSessionId?: string;
  role?: string;
  roleTrack?: string;
  userMessage: string;
  modelStructure?: string[];
  overallScore?: number;
  savedAt: string;
};

export type PrepRetentionState = {
  isReturningUser: boolean;
  priorSessionCount: number;
  prepSessionNumber: number;
  priorRole?: string;
  priorRoleTrack?: string;
  newRoleTrack?: string;
  sameRoleTrack: boolean;
  shortenedDiagnostics: boolean;
  priorFatalGaps: string[];
  prepVacancyHistory: PrepVacancyRecord[];
};

export function resolvePrepRetention(collected: Record<string, unknown>): PrepRetentionState | null {
  const raw = collected.prepRetention;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const state = raw as PrepRetentionState;
  if (!state.isReturningUser) {
    return null;
  }
  return state;
}

export function resolveStarBank(collected: Record<string, unknown>): StarBankEntry[] {
  const raw = collected.starBank;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is StarBankEntry =>
      entry != null &&
      typeof entry === 'object' &&
      typeof (entry as StarBankEntry).userMessage === 'string'
  );
}

export function formatPrepDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
