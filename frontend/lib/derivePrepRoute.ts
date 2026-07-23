import type { InterviewPrepMode } from '@/types/chat';
import {
  PREP_ACTIVITY_TYPE_LABELS,
  buildActivityStartMessage,
  evaluateMockGate,
  type PrepActivity,
  type PrepProgress,
} from '@/lib/prepActivities';

/** Логические этапы маршрута (поверх day-based activities). */
export type PrepStageId = 's1' | 's2' | 's3' | 's4' | 's5';

export type PrepStageMeta = {
  id: PrepStageId;
  index: number;
  label: string;
  shortLabel: string;
};

export const PREP_STAGES: PrepStageMeta[] = [
  { id: 's1', index: 1, label: 'Диагностика', shortLabel: 'Диагностика' },
  { id: 's2', index: 2, label: 'Закрытие пробелов', shortLabel: 'Уроки' },
  { id: 's3', index: 3, label: 'Практика', shortLabel: 'Практика' },
  { id: 's4', index: 4, label: 'Репетиция', shortLabel: 'Мок' },
  { id: 's5', index: 5, label: 'Готовность', shortLabel: 'Итог' },
];

const TOTAL_STAGES = PREP_STAGES.length;

export function stageForMode(mode: InterviewPrepMode): PrepStageMeta {
  switch (mode) {
    case 'diagnostics':
      return PREP_STAGES[0];
    case 'theory':
      return PREP_STAGES[1];
    case 'case':
    case 'star':
      return PREP_STAGES[2];
    case 'mock':
      return PREP_STAGES[3];
    case 'employer_questions':
      return PREP_STAGES[4];
    default:
      return PREP_STAGES[0];
  }
}

export type PrepNextStep = {
  activity: PrepActivity;
  stage: PrepStageMeta;
  typeLabel: string;
  startMessage: string;
  /** Мок заблокирован гейтом */
  blocked: boolean;
  blockers: string[];
};

export type PrepRoute = {
  /** Первая незавершённая обязательная (или мок, если открыт) активность */
  next: PrepNextStep | null;
  /** Все шаги маршрута завершены */
  complete: boolean;
  /** «Шаг 2 из 8» по обязательным активностям */
  stepIndex: number;
  stepTotal: number;
  /** Этап текущего следующего шага (или последний, если complete) */
  currentStage: PrepStageMeta;
  /** Ориентир оставшихся минут по незавершённым required */
  remainingMin: number;
  /** Ориентир всего маршрута в часах (округление вверх до 0.5) */
  totalHoursHint: number;
  progressLabel: string;
  paceHint: string;
};

function sortActivities(activities: PrepActivity[]): PrepActivity[] {
  const modeOrder: InterviewPrepMode[] = [
    'diagnostics',
    'theory',
    'star',
    'case',
    'employer_questions',
    'mock',
  ];
  return [...activities].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return modeOrder.indexOf(a.mode) - modeOrder.indexOf(b.mode);
  });
}

/**
 * Вычисляемый слой поверх PrepProgress (day-based):
 * один «следующий шаг» + лейблы этапов S1–S5 без смены схемы данных.
 */
export function derivePrepRoute(
  progress: PrepProgress,
  collected: Record<string, unknown> = {}
): PrepRoute {
  const ordered = sortActivities(progress.activities);
  const required = ordered.filter((a) => a.required);
  const requiredDone = required.filter((a) => a.completed).length;
  const stepTotal = Math.max(required.length, 1);
  const stepIndex = Math.min(requiredDone + 1, stepTotal);

  const remainingMin = required
    .filter((a) => !a.completed)
    .reduce((sum, a) => sum + (a.durationMin ?? 20), 0);
  const totalMin = required.reduce((sum, a) => sum + (a.durationMin ?? 20), 0);
  const totalHoursHint = Math.max(1, Math.round((totalMin / 60) * 2) / 2);

  const gate = evaluateMockGate(collected);
  const complete = required.length > 0 && required.every((a) => a.completed);

  let nextActivity: PrepActivity | null = null;
  for (const activity of ordered) {
    if (activity.completed) continue;
    if (!activity.required && activity.mode !== 'mock') continue;
    if (activity.mode === 'mock' && !gate.allowed && !activity.required) continue;
    nextActivity = activity;
    break;
  }
  // Fallback: первая незавершённая (включая optional), если required все done но есть optional
  if (!nextActivity && !complete) {
    nextActivity = ordered.find((a) => !a.completed) ?? null;
  }

  const currentStage = nextActivity
    ? stageForMode(nextActivity.mode)
    : PREP_STAGES[TOTAL_STAGES - 1];

  const next: PrepNextStep | null = nextActivity
    ? {
        activity: nextActivity,
        stage: stageForMode(nextActivity.mode),
        typeLabel: PREP_ACTIVITY_TYPE_LABELS[nextActivity.type],
        startMessage: buildActivityStartMessage(nextActivity),
        blocked: nextActivity.mode === 'mock' && !gate.allowed,
        blockers: nextActivity.mode === 'mock' ? gate.blockers : [],
      }
    : null;

  const progressLabel = complete
    ? `Маршрут пройден · ${requiredDone} шагов`
    : `Шаг ${stepIndex} из ${stepTotal} · этап «${currentStage.label}»`;

  const paceHint =
    remainingMin > 0
      ? `Сейчас ~${remainingMin} мин до конца маршрута · можно за вечер или по шагу`
      : 'Можно за вечер (~3 ч) или по одному шагу в день';

  return {
    next,
    complete,
    stepIndex,
    stepTotal,
    currentStage,
    remainingMin,
    totalHoursHint,
    progressLabel,
    paceHint,
  };
}

export function formatPrepContractLine(params: {
  role?: string;
  level?: string;
  stepTotal?: number;
  totalHoursHint?: number;
}): string {
  const roleBit = [params.role, params.level].filter(Boolean).join(' · ') || 'Ваша вакансия';
  const steps = params.stepTotal ?? 6;
  const hours = params.totalHoursHint ?? 3;
  return `${roleBit} · ${steps} шагов · ~${hours} ч в чате`;
}
