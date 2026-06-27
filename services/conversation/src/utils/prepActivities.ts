/**
 * Prep activities & progress (§6.1, B1) + mock gate (B3).
 */

import type { InterviewPrepMode } from '../types/message';
import { inferSeniorityFromLevel, resolveCandidateSeniorityLevel } from './interviewPrepProtocol';

export type PrepActivityType = 'learn' | 'apply' | 'pack';

export interface PrepPlanDay {
  day: number;
  focus: string;
  tasks: string[];
}

export interface PrepActivity {
  id: string;
  day: number;
  type: PrepActivityType;
  title: string;
  mode: InterviewPrepMode;
  durationMin?: number;
  required: boolean;
  completed: boolean;
}

export interface PrepProgress {
  currentDay: number;
  activities: PrepActivity[];
  completedActivityIds: string[];
  overallPercent: number;
  totalDays: number;
}

type ActivityDef = {
  mode: InterviewPrepMode;
  type: PrepActivityType;
  titleSuffix: string;
  required: boolean;
  durationMin?: number;
};

const DAY_ACTIVITY_DEFS: Record<number, ActivityDef[]> = {
  1: [
    { mode: 'diagnostics', type: 'apply', titleSuffix: 'Карта пробелов', required: true, durationMin: 25 },
    { mode: 'theory', type: 'learn', titleSuffix: 'Первый урок', required: true, durationMin: 20 },
  ],
  2: [
    { mode: 'star', type: 'apply', titleSuffix: 'История STAR', required: true, durationMin: 30 },
    { mode: 'theory', type: 'learn', titleSuffix: 'Углубление', required: false, durationMin: 20 },
    { mode: 'case', type: 'apply', titleSuffix: 'Первый кейс', required: false, durationMin: 25 },
  ],
  3: [
    { mode: 'theory', type: 'learn', titleSuffix: 'Тема дня', required: true, durationMin: 20 },
    { mode: 'case', type: 'apply', titleSuffix: 'Кейс', required: true, durationMin: 25 },
    { mode: 'star', type: 'apply', titleSuffix: 'Доработка STAR', required: false, durationMin: 20 },
  ],
  4: [
    { mode: 'star', type: 'apply', titleSuffix: 'Шлифовка STAR', required: true, durationMin: 25 },
    {
      mode: 'employer_questions',
      type: 'learn',
      titleSuffix: 'Вопросы работодателю',
      required: false,
      durationMin: 15,
    },
  ],
  5: [
    { mode: 'case', type: 'apply', titleSuffix: 'Финальный кейс', required: false, durationMin: 25 },
    { mode: 'mock', type: 'pack', titleSuffix: 'Мок-интервью', required: true, durationMin: 45 },
  ],
};

function historyHasGradedEntry(historyKey: string, collected: Record<string, unknown>): boolean {
  const history = collected[historyKey];
  if (!Array.isArray(history) || history.length === 0) {
    return false;
  }
  return history.some(
    (entry) =>
      entry != null &&
      typeof entry === 'object' &&
      ('grading' in entry || 'responsePhase' in entry)
  );
}

export function isModeActivityCompleted(
  mode: InterviewPrepMode,
  collected: Record<string, unknown>
): boolean {
  switch (mode) {
    case 'diagnostics':
      return Boolean(collected.diagnosticsPackComplete);
    case 'theory':
      return Number(collected.theoryLessonsCompleted ?? 0) >= 1;
    case 'case':
      return historyHasGradedEntry('caseHistory', collected);
    case 'star':
      return historyHasGradedEntry('starHistory', collected);
    case 'mock':
      return collected.mockPhase === 'complete';
    case 'employer_questions':
      return Boolean(collected.employerQuestionsPackComplete);
    default:
      return false;
  }
}

export function buildPrepActivities(
  planDays: PrepPlanDay[],
  collected: Record<string, unknown>
): PrepActivity[] {
  const persistedIds = new Set<string>();
  const rawProgress = collected.prepProgress as PrepProgress | undefined;
  if (rawProgress && Array.isArray(rawProgress.completedActivityIds)) {
    for (const id of rawProgress.completedActivityIds) {
      persistedIds.add(id);
    }
  }

  const activities: PrepActivity[] = [];
  const theoryLessons = Number(collected.theoryLessonsCompleted ?? 0);
  let theorySlot = 0;

  for (const day of planDays) {
    const defs = DAY_ACTIVITY_DEFS[day.day] ?? [];
    for (const def of defs) {
      const id = `d${day.day}-${def.mode}-${def.type}`;
      let completed = persistedIds.has(id);

      if (!completed && def.mode === 'theory') {
        theorySlot += 1;
        completed = theoryLessons >= theorySlot;
      } else if (!completed && def.required) {
        completed = isModeActivityCompleted(def.mode, collected);
      }

      activities.push({
        id,
        day: day.day,
        type: def.type,
        title: `${def.titleSuffix} · ${day.focus}`,
        mode: def.mode,
        durationMin: def.durationMin,
        required: def.required,
        completed,
      });
    }
  }

  return activities;
}

export function computePrepProgress(
  planDays: PrepPlanDay[],
  collected: Record<string, unknown>
): PrepProgress {
  const activities = buildPrepActivities(planDays, collected);
  const required = activities.filter((activity) => activity.required);
  const completedRequired = required.filter((activity) => activity.completed).length;
  const overallPercent =
    required.length > 0 ? Math.round((completedRequired / required.length) * 100) : 0;

  const sortedDays = [...planDays].map((day) => day.day).sort((a, b) => a - b);
  let currentDay = sortedDays[0] ?? 1;
  for (const day of sortedDays) {
    const dayRequired = activities.filter((activity) => activity.day === day && activity.required);
    if (dayRequired.length === 0 || dayRequired.some((activity) => !activity.completed)) {
      currentDay = day;
      break;
    }
    currentDay = day;
  }

  return {
    currentDay,
    activities,
    completedActivityIds: activities.filter((activity) => activity.completed).map((a) => a.id),
    overallPercent,
    totalDays: planDays.length,
  };
}

export interface MockGateResult {
  allowed: boolean;
  blockers: string[];
  minTheoryLessons: number;
}

export function evaluateMockGate(collected: Record<string, unknown>): MockGateResult {
  const vacancyProfile = collected.vacancyProfile as { level?: string } | undefined;
  const seniority = resolveCandidateSeniorityLevel(
    vacancyProfile?.level,
    collected.candidateSeniority as string | undefined
  );
  const minTheoryLessons = inferSeniorityFromLevel(seniority) === 'junior' ? 3 : 2;
  const blockers: string[] = [];

  if (!collected.diagnosticsPackComplete) {
    blockers.push('Завершите диагностику и получите карту пробелов');
  }

  const lessons = Number(collected.theoryLessonsCompleted ?? 0);
  if (lessons < minTheoryLessons) {
    const need = minTheoryLessons - lessons;
    blockers.push(
      `Пройдите ещё ${need} ${need === 1 ? 'урок' : need < 5 ? 'урока' : 'уроков'} в режиме «Теория»`
    );
  }

  if (!historyHasGradedEntry('starHistory', collected)) {
    blockers.push('Пройдите хотя бы один STAR с разбором');
  }

  return { allowed: blockers.length === 0, blockers, minTheoryLessons };
}

export function buildMockGateBlockedMessage(blockers: string[]): string {
  return [
    'Мок-интервью пока недоступно — сначала закройте обязательные шаги:',
    '',
    ...blockers.map((item) => `• ${item}`),
    '',
    'Откройте вкладку «Подготовка» — там видно, что осталось на сегодня.',
  ].join('\n');
}

export type ReadinessChecklistItem = { label: string; done: boolean };

/** §9.2 — чеклист готовности для prep_complete и PDF */
export function buildReadinessChecklist(
  collected: Record<string, unknown>,
  progress?: PrepProgress
): ReadinessChecklistItem[] {
  const vacancyProfile = collected.vacancyProfile as { level?: string } | undefined;
  const seniority = resolveCandidateSeniorityLevel(
    vacancyProfile?.level,
    collected.candidateSeniority as string | undefined
  );
  const theoryTarget = inferSeniorityFromLevel(seniority) === 'junior' ? 3 : 2;
  const theoryLessons = Number(collected.theoryLessonsCompleted ?? 0);

  return [
    { label: 'Диагностика', done: Boolean(collected.diagnosticsPackComplete) },
    { label: `Уроки (${theoryLessons}/${theoryTarget})`, done: theoryLessons >= theoryTarget },
    { label: 'STAR с разбором', done: historyHasGradedEntry('starHistory', collected) },
    { label: 'Мок-интервью', done: collected.mockPhase === 'complete' },
    {
      label: 'План подготовки',
      done: Boolean(progress && progress.overallPercent >= 80),
    },
  ];
}

const DIMENSION_LABELS: Record<string, string> = {
  structure: 'Структура',
  depth: 'Глубина',
  metrics: 'Метрики',
  tradeOffs: 'Trade-offs',
  communication: 'Коммуникация',
  seniorityFit: 'Уровень',
};

type GradingLike = {
  overallScore?: number;
  dimensionScores?: Record<string, number>;
  fatalGaps?: string[];
  strengths?: string[];
  improvements?: string[];
  modelStructure?: string[];
};

function extractGradings(collected: Record<string, unknown>): GradingLike[] {
  const gradings: GradingLike[] = [];
  const sources = [
    collected.mockAnswers,
    collected.caseHistory,
    collected.starHistory,
    collected.diagnosticsHistory,
  ];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const entry of source) {
      if (entry && typeof entry === 'object' && 'grading' in entry) {
        const g = (entry as { grading?: GradingLike }).grading;
        if (g) gradings.push(g);
      }
    }
  }
  const lastGrade = collected.lastInterviewGrade as GradingLike | undefined;
  if (lastGrade) gradings.push(lastGrade);
  return gradings;
}

export function aggregateCompetencyScores(collected: Record<string, unknown>): Array<{
  dimension: string;
  label: string;
  score: number;
}> {
  const buckets = new Map<string, number[]>();
  for (const grading of extractGradings(collected)) {
    const dims = grading.dimensionScores;
    if (!dims) continue;
    for (const [key, value] of Object.entries(dims)) {
      if (typeof value !== 'number') continue;
      const list = buckets.get(key) ?? [];
      list.push(value);
      buckets.set(key, list);
    }
  }
  return Array.from(buckets.entries()).map(([dimension, scores]) => ({
    dimension,
    label: DIMENSION_LABELS[dimension] ?? dimension,
    score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
  }));
}

export function collectFatalGaps(collected: Record<string, unknown>): string[] {
  const gaps = new Set<string>();
  for (const grading of extractGradings(collected)) {
    for (const gap of grading.fatalGaps ?? []) {
      if (gap?.trim()) gaps.add(gap.trim());
    }
  }
  return Array.from(gaps).slice(0, 8);
}

export function collectStrengthsAndActions(collected: Record<string, unknown>): {
  strengths: string[];
  gaps: string[];
  actions: string[];
} {
  const strengths = new Set<string>();
  const improvements = new Set<string>();
  for (const grading of extractGradings(collected)) {
    for (const s of grading.strengths ?? []) {
      if (s?.trim()) strengths.add(s.trim());
    }
    for (const i of grading.improvements ?? []) {
      if (i?.trim()) improvements.add(i.trim());
    }
  }
  const fatal = collectFatalGaps(collected);
  const actions = improvements.size > 0 ? Array.from(improvements) : fatal;
  return {
    strengths: Array.from(strengths).slice(0, 3),
    gaps: fatal.slice(0, 3),
    actions: actions.slice(0, 3),
  };
}
