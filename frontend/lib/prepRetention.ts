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
  source?: string;
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
  const result: StarBankEntry[] = [];
  raw.forEach((entry, index) => {
    if (entry == null || typeof entry !== 'object') return;
    const row = entry as Record<string, unknown>;
    const userMessage =
      typeof row.userMessage === 'string'
        ? row.userMessage
        : typeof row.action === 'string'
          ? [row.situation, row.task, row.action, row.result].filter(Boolean).join('\n')
          : '';
    if (!userMessage.trim()) return;
    result.push({
      id: typeof row.id === 'string' ? row.id : `star-${index}`,
      sourceSessionId: typeof row.sourceSessionId === 'string' ? row.sourceSessionId : undefined,
      role: typeof row.role === 'string' ? row.role : undefined,
      roleTrack: typeof row.roleTrack === 'string' ? row.roleTrack : undefined,
      userMessage: userMessage.trim(),
      modelStructure: Array.isArray(row.modelStructure)
        ? row.modelStructure.filter((item): item is string => typeof item === 'string')
        : undefined,
      overallScore: typeof row.overallScore === 'number' ? row.overallScore : undefined,
      savedAt: typeof row.savedAt === 'string' ? row.savedAt : new Date().toISOString(),
      source: typeof row.source === 'string' ? row.source : undefined,
    });
  });
  return result;
}

export function formatPrepDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
