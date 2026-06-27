import type { InterviewPrepMode, PrepPlanDayItem } from '@/types/chat';
import {
  INTERVIEW_PREP_MODE_LABELS,
  buildInterviewPrepModeStartMessage,
} from '@/lib/interviewPrepModes';

export type PrepActivityType = 'learn' | 'apply' | 'pack';

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

export interface MockGateResult {
  allowed: boolean;
  blockers: string[];
  minTheoryLessons: number;
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

export const PREP_ACTIVITY_TYPE_LABELS: Record<PrepActivityType, string> = {
  learn: '🎓 Учёба',
  apply: '🎯 Практика',
  pack: '📋 Итог',
};

function inferSeniorityFromLevel(level?: string): 'junior' | 'middle' | 'senior' | 'lead' | 'unknown' {
  const value = (level ?? '').toLowerCase();
  if (/(junior|intern|стажер|джун)/.test(value)) return 'junior';
  if (/(middle|mid|мидл)/.test(value)) return 'middle';
  if (/(senior|sen|сеньор)/.test(value)) return 'senior';
  if (/(lead|head|staff|principal|director|vp|руковод)/.test(value)) return 'lead';
  return 'unknown';
}

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

function isModeActivityCompleted(mode: InterviewPrepMode, collected: Record<string, unknown>): boolean {
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
  planDays: PrepPlanDayItem[],
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
  planDays: PrepPlanDayItem[],
  collected: Record<string, unknown>
): PrepProgress | null {
  if (planDays.length === 0) {
    return null;
  }

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

export function evaluateMockGate(collected: Record<string, unknown>): MockGateResult {
  const vacancyProfile = collected.vacancyProfile as { level?: string } | undefined;
  const explicitSeniority =
    typeof collected.candidateSeniority === 'string' ? collected.candidateSeniority : undefined;
  const seniority = explicitSeniority?.trim() || vacancyProfile?.level?.trim();
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

/** §6.3 — одно сообщение при клике на активность (смена режима + контекст дня). */
export function buildActivityStartMessage(activity: PrepActivity): string {
  return buildInterviewPrepModeStartMessage(activity.mode, activity.day);
}

export function completedDaysCount(progress: PrepProgress): number {
  const days = [...new Set(progress.activities.map((a) => a.day))].sort((a, b) => a - b);
  return days.filter((day) => {
    const required = progress.activities.filter((a) => a.day === day && a.required);
    return required.length > 0 && required.every((a) => a.completed);
  }).length;
}

export function modeLabel(mode: InterviewPrepMode): string {
  return INTERVIEW_PREP_MODE_LABELS[mode];
}
