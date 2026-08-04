import type { ConversationSession } from '../types/session';
import type { PrepProgress } from './prepActivities';

export type PrepContinueEmailDraft = {
  emailKey: string;
  stageLabel: string;
  nextTitle: string;
  durationMin: number;
  stepIndex: number;
  stepTotal: number;
  progressPercent: number;
  role?: string;
};

const MODE_STAGE_LABEL: Record<string, string> = {
  diagnostics: 'Диагностика',
  theory: 'Закрытие пробелов',
  star: 'Практика',
  case: 'Практика',
  mock: 'Репетиция',
  employer_questions: 'Готовность',
};

export type BuildPrepContinueDraftOptions = {
  /** Если true — письмо только после паузы ≥ pauseMs от prepLastActiveAt */
  requirePauseElapsed?: boolean;
  pauseMs?: number;
  nowMs?: number;
};

/**
 * Черновик email «продолжить этап», если маршрут незавершён и есть следующий шаг.
 * Используется и для планирования (без паузы), и для отправки воркером (с паузой).
 */
export function buildPrepContinueEmailDraftFromCollected(
  collected: Record<string, unknown>,
  options: BuildPrepContinueDraftOptions = {}
): PrepContinueEmailDraft | null {
  const progress = collected.prepProgress as PrepProgress | undefined;
  if (!progress || !Array.isArray(progress.activities) || progress.activities.length === 0) {
    return null;
  }

  const required = progress.activities.filter((a) => a.required);
  const completedRequired = required.filter((a) => a.completed);
  if (completedRequired.length === 0) {
    return null;
  }
  if (required.length > 0 && completedRequired.length >= required.length) {
    return null;
  }

  const next =
    progress.activities.find((a) => a.required && !a.completed) ??
    progress.activities.find((a) => !a.completed);
  if (!next) {
    return null;
  }

  const emailKey = `stage-${completedRequired.length}-${next.id}`;
  if (collected.prepContinueEmailKey === emailKey) {
    return null;
  }

  if (options.requirePauseElapsed) {
    const pauseMs = options.pauseMs ?? 24 * 60 * 60 * 1000;
    const nowMs = options.nowMs ?? Date.now();
    const lastActive =
      typeof collected.prepLastActiveAt === 'string' ? collected.prepLastActiveAt : null;
    if (!lastActive) {
      return null;
    }
    const lastMs = new Date(lastActive).getTime();
    if (Number.isNaN(lastMs) || nowMs - lastMs < pauseMs) {
      return null;
    }
  }

  const vacancy = collected.vacancyProfile as { role?: string } | undefined;
  const stepTotal = Math.max(required.length, 1);
  const stepIndex = Math.min(completedRequired.length + 1, stepTotal);

  return {
    emailKey,
    stageLabel: MODE_STAGE_LABEL[next.mode] ?? 'Подготовка',
    nextTitle: next.title,
    durationMin: next.durationMin ?? 20,
    stepIndex,
    stepTotal,
    progressPercent: progress.overallPercent ?? 0,
    role: typeof vacancy?.role === 'string' ? vacancy.role : undefined,
  };
}

/** @deprecated use buildPrepContinueEmailDraftFromCollected — kept for call-site clarity */
export function buildPrepContinueEmailDraft(
  session: ConversationSession,
  options?: BuildPrepContinueDraftOptions
): PrepContinueEmailDraft | null {
  if (session.metadata.product !== 'interview-prep') {
    return null;
  }
  return buildPrepContinueEmailDraftFromCollected(session.metadata.collectedData || {}, options);
}

export function parsePrepPace(value: unknown): 'sprint' | 'marathon' | null {
  if (value === 'sprint' || value === 'marathon') {
    return value;
  }
  return null;
}

/** Спринт = без email; марафон или темп не выбран → планируем. */
export function shouldSchedulePrepReminder(collected: Record<string, unknown>): boolean {
  return collected.prepPace !== 'sprint';
}
