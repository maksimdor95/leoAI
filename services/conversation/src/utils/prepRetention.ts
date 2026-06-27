/**
 * Phase E — retention v1.1: 2nd vacancy, STAR bank, shortened diagnostics (§13.4).
 */

import type { ConversationSession } from '../types/session';
import {
  aggregateCompetencyScores,
  collectFatalGaps,
  computePrepProgress,
  type PrepPlanDay,
} from './prepActivities';

export type PrepRoleTrack =
  | 'product_business'
  | 'analytics_data'
  | 'engineering_systems'
  | 'qa_quality'
  | 'sales_commercial'
  | 'operations_delivery'
  | 'design_ux'
  | 'leadership_behavioral'
  | 'marketing_growth'
  | 'customer_success'
  | 'hr_people'
  | 'generalist';

export type StarBankEntry = {
  id: string;
  sourceSessionId?: string;
  role?: string;
  roleTrack?: PrepRoleTrack;
  userMessage: string;
  modelStructure?: string[];
  overallScore?: number;
  savedAt: string;
};

export type PrepVacancyRecord = {
  sessionId: string;
  role?: string;
  roleTrack?: PrepRoleTrack;
  level?: string;
  preparedAt?: string;
  prepComplete?: boolean;
};

export type PriorPrepSnapshot = {
  sessionId: string;
  role?: string;
  level?: string;
  readinessPercent: number;
  competencyScores: Array<{ dimension: string; label: string; score: number }>;
  fatalGaps: string[];
  preparedAt?: string;
};

export type PrepRetentionState = {
  isReturningUser: boolean;
  priorSessionCount: number;
  prepSessionNumber: number;
  priorRole?: string;
  priorRoleTrack?: PrepRoleTrack;
  newRoleTrack?: PrepRoleTrack;
  sameRoleTrack: boolean;
  shortenedDiagnostics: boolean;
  priorFatalGaps: string[];
  prepVacancyHistory: PrepVacancyRecord[];
};

type VacancyProfileLike = {
  role?: string;
  level?: string;
  domain?: string;
  stack?: string[];
  requirements?: string[];
  responsibilities?: string[];
};

export function inferRoleTrackFromProfile(profile?: VacancyProfileLike): PrepRoleTrack {
  const haystack = [
    profile?.role,
    profile?.domain,
    ...(profile?.stack ?? []),
    ...(profile?.requirements ?? []),
    ...(profile?.responsibilities ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    /(growth marketing|performance marketing|digital marketing|marketing manager|brand marketing|content marketing|crm marketing|email marketing|paid media|\bseo\b|\bsem\b|маркетинг|marketing director|head of marketing)/.test(
      haystack
    )
  ) {
    return 'marketing_growth';
  }
  if (
    /(analyst|analytics|\bbi\b|\bsql\b|дашборд|\bdata\b|ab-test|эксперимент|causal|cohort|funnel|attribution)/.test(
      haystack
    )
  ) {
    return 'analytics_data';
  }
  if (
    /(product designer|ux designer|ui designer|ux\/ui|user researcher|usability|design system|figma|interaction designer|design manager|head of design|design lead|ux lead|visual designer|дизайнер|исследователь ux|ux research)/.test(
      haystack
    )
  ) {
    return 'design_ux';
  }
  if (
    /(product owner|product manager|\bproduct\b|продакт|growth|roadmap|go-to-market|retention|монетизац)/.test(
      haystack
    )
  ) {
    return 'product_business';
  }
  if (
    /(quality assurance|\bqa\b|qa engineer|qa lead|тестиров|sdet|автотест|test automation|manual test|test engineer|test lead|software tester|инженер по тестированию|инженер-тестировщик)/.test(
      haystack
    )
  ) {
    return 'qa_quality';
  }
  if (
    /(backend|frontend|fullstack|engineer|developer|architecture|api|distributed|system design|infra|sre|platform|ml engineer)/.test(
      haystack
    ) &&
    !/(director|head of|vp|leadership)/.test(haystack)
  ) {
    return 'engineering_systems';
  }
  if (
    /(account executive|account manager|key account|business development|\bsdr\b|\bbdr\b|\bae\b|\bsales\b|продаж|коммерч|коммерческ|\bkam\b)/.test(
      haystack
    )
  ) {
    return 'sales_commercial';
  }
  if (
    /(customer success|client success|\bcsm\b|success manager|customer onboarding|onboarding manager|support lead|customer support lead|клиентский успех|удержание клиентов|account success)/.test(
      haystack
    )
  ) {
    return 'customer_success';
  }
  if (
    /(project manager|program manager|scrum master|release manager|pmo|delivery manager|project|program|delivery|scrum|kanban|pmo)/.test(
      haystack
    )
  ) {
    return 'operations_delivery';
  }
  if (
    /(recruiter|recruiting|talent acquisition|talent partner|hr bp|hr business partner|people partner|head of people|chief people officer|\bhr\b|рекрутер|рекрутинг|кадров|employer brand|sourcer)/.test(
      haystack
    )
  ) {
    return 'hr_people';
  }
  if (/(lead|head|director|vp|stakeholder|influence|leadership)/.test(haystack)) {
    return 'leadership_behavioral';
  }
  if (/\bmanager\b/.test(haystack)) {
    return 'leadership_behavioral';
  }
  return 'generalist';
}

function isInterviewPrepTrainerSession(session: ConversationSession): boolean {
  if (session.metadata.product !== 'interview-prep') {
    return false;
  }
  const collected = session.metadata.collectedData ?? {};
  return Boolean(collected.vacancyProfile) && collected.interviewMode !== 'пробное собеседование';
}

function collectFatalGapsFromCollected(collected: Record<string, unknown>): string[] {
  const gaps = new Set<string>();
  const lastGrade = collected.lastInterviewGrade as { fatalGaps?: string[] } | undefined;
  for (const gap of lastGrade?.fatalGaps ?? []) {
    if (gap.trim()) gaps.add(gap.trim());
  }
  for (const key of ['starHistory', 'caseHistory', 'mockAnswers', 'diagnosticsHistory']) {
    const history = collected[key];
    if (!Array.isArray(history)) continue;
    for (const entry of history) {
      if (!entry || typeof entry !== 'object') continue;
      const grading = (entry as { grading?: { fatalGaps?: string[] } }).grading;
      for (const gap of grading?.fatalGaps ?? []) {
        if (gap.trim()) gaps.add(gap.trim());
      }
    }
  }
  return [...gaps].slice(0, 10);
}

export function extractStarEntriesFromCollected(
  collected: Record<string, unknown>,
  sessionId?: string
): StarBankEntry[] {
  const profile = collected.vacancyProfile as VacancyProfileLike | undefined;
  const role = profile?.role;
  const roleTrack = inferRoleTrackFromProfile(profile);
  const history = collected.starHistory;
  if (!Array.isArray(history)) {
    return [];
  }

  const entries: StarBankEntry[] = [];
  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      userMessage?: string;
      grading?: { overallScore?: number; modelStructure?: string[] };
      at?: string;
    };
    const userMessage = row.userMessage?.trim();
    if (!userMessage || userMessage.length < 40) continue;
    entries.push({
      id: `${sessionId ?? 'session'}:${row.at ?? entries.length}`,
      sourceSessionId: sessionId,
      role,
      roleTrack,
      userMessage,
      modelStructure: row.grading?.modelStructure,
      overallScore: row.grading?.overallScore,
      savedAt: row.at ?? new Date().toISOString(),
    });
  }
  return entries;
}

export function mergeStarBankEntries(...groups: StarBankEntry[][]): StarBankEntry[] {
  const byKey = new Map<string, StarBankEntry>();
  for (const group of groups) {
    for (const entry of group) {
      const key = entry.userMessage.trim().slice(0, 160).toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, entry);
      }
    }
  }
  return [...byKey.values()]
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, 12);
}

export function buildPriorPrepSnapshot(session: ConversationSession): PriorPrepSnapshot | null {
  if (!isInterviewPrepTrainerSession(session)) {
    return null;
  }
  const collected = session.metadata.collectedData ?? {};
  const profile = collected.vacancyProfile as VacancyProfileLike | undefined;
  if (!profile?.role) {
    return null;
  }
  const prepPlan = collected.prepPlan as PrepPlanDay[] | undefined;
  const readinessPercent = Array.isArray(prepPlan)
    ? computePrepProgress(prepPlan, collected).overallPercent
    : 0;

  return {
    sessionId: session.id,
    role: profile.role,
    level: profile.level,
    readinessPercent,
    competencyScores: aggregateCompetencyScores(collected),
    fatalGaps: collectFatalGaps(collected),
    preparedAt: session.updatedAt,
  };
}

export function buildPrepVacancyRecord(session: ConversationSession): PrepVacancyRecord | null {
  const collected = session.metadata.collectedData ?? {};
  const profile = collected.vacancyProfile as VacancyProfileLike | undefined;
  if (!profile?.role) {
    return null;
  }
  return {
    sessionId: session.id,
    role: profile.role,
    roleTrack: inferRoleTrackFromProfile(profile),
    level: profile.level,
    preparedAt: session.updatedAt,
    prepComplete: Boolean(collected.prepComplete),
  };
}

export function buildPrepRetentionState(params: {
  priorSessions: ConversationSession[];
  newProfile: VacancyProfileLike;
}): PrepRetentionState {
  const prepSessions = params.priorSessions.filter(isInterviewPrepTrainerSession);
  const prepVacancyHistory = prepSessions
    .map(buildPrepVacancyRecord)
    .filter((record): record is PrepVacancyRecord => record != null);

  const latestPrior = prepVacancyHistory[0];
  const newRoleTrack = inferRoleTrackFromProfile(params.newProfile);
  const priorRoleTrack = latestPrior?.roleTrack;
  const sameRoleTrack = Boolean(
    latestPrior && priorRoleTrack && priorRoleTrack === newRoleTrack && priorRoleTrack !== 'generalist'
  );

  const priorFatalGaps = prepSessions.flatMap((session) =>
    collectFatalGapsFromCollected(session.metadata.collectedData ?? {})
  );
  const uniqueFatalGaps = [...new Set(priorFatalGaps)].slice(0, 8);

  const priorSessionCount = prepSessions.length;
  return {
    isReturningUser: priorSessionCount > 0,
    priorSessionCount,
    prepSessionNumber: priorSessionCount + 1,
    priorRole: latestPrior?.role,
    priorRoleTrack,
    newRoleTrack,
    sameRoleTrack,
    shortenedDiagnostics: sameRoleTrack && priorSessionCount > 0,
    priorFatalGaps: uniqueFatalGaps,
    prepVacancyHistory,
  };
}

export function getDiagnosticsPackMinAnswers(retention?: Pick<PrepRetentionState, 'shortenedDiagnostics'>): number {
  return retention?.shortenedDiagnostics ? 2 : 4;
}

export function buildReturningUserWelcome(
  retention: PrepRetentionState,
  newRole: string,
  starBankCount: number
): string {
  if (!retention.isReturningUser || !retention.priorRole) {
    return '';
  }

  const lines = [
    `Вижу, вы уже готовились к «${retention.priorRole}». Для «${newRole}» соберу новый план подготовки.`,
  ];

  if (starBankCount > 0) {
    lines.push(
      `В банке STAR — ${starBankCount} ${starBankCount === 1 ? 'история' : starBankCount < 5 ? 'истории' : 'историй'} из прошлых сессий: в режиме STAR помогу переупаковать их под новую роль.`
    );
  }

  if (retention.shortenedDiagnostics) {
    lines.push('Диагностика будет короче — вы в том же семействе ролей, базовый профиль уже знаком.');
  }

  if (retention.priorFatalGaps.length > 0) {
    lines.push(
      `Учту прошлые пробелы в плане: ${retention.priorFatalGaps.slice(0, 3).join('; ')}${retention.priorFatalGaps.length > 3 ? '…' : ''}.`
    );
  }

  return lines.join('\n\n');
}

export function buildStarBankEntryFromAnswer(params: {
  sessionId: string;
  collectedData: Record<string, unknown>;
  userMessage: string;
  grading?: { overallScore?: number; modelStructure?: string[] };
}): StarBankEntry | null {
  const trimmed = params.userMessage.trim();
  if (trimmed.length < 40) {
    return null;
  }
  const profile = params.collectedData.vacancyProfile as VacancyProfileLike | undefined;
  return {
    id: `${params.sessionId}:${Date.now()}`,
    sourceSessionId: params.sessionId,
    role: profile?.role,
    roleTrack: inferRoleTrackFromProfile(profile),
    userMessage: trimmed,
    modelStructure: params.grading?.modelStructure,
    overallScore: params.grading?.overallScore,
    savedAt: new Date().toISOString(),
  };
}
