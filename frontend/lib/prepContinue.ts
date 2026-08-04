import type { PrepRoute } from '@/lib/derivePrepRoute';

export const PREP_PAUSE_MS = 24 * 60 * 60 * 1000;

export type PrepPace = 'sprint' | 'marathon';

export type PrepContinueState = {
  paused: boolean;
  pauseHours: number;
  stageLabel: string;
  stageIndex: number;
  nextTitle?: string;
  durationMin?: number;
  lastActiveAt: string;
};

const PACE_STORAGE_KEY = 'leo.prepPace';

export function parsePrepPace(value: unknown): PrepPace | null {
  if (value === 'sprint' || value === 'marathon') {
    return value;
  }
  return null;
}

/** Приоритет: collectedData.prepPace → localStorage → sprint */
export function resolvePrepPace(collected?: Record<string, unknown> | null): PrepPace {
  const fromCollected = parsePrepPace(collected?.prepPace);
  if (fromCollected) {
    return fromCollected;
  }
  if (typeof window === 'undefined') return 'sprint';
  try {
    const raw = window.localStorage.getItem(PACE_STORAGE_KEY);
    return parsePrepPace(raw) ?? 'sprint';
  } catch {
    return 'sprint';
  }
}

export function writePrepPaceLocal(pace: PrepPace): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PACE_STORAGE_KEY, pace);
  } catch {
    /* ignore */
  }
}

export function resolvePrepLastActiveAt(
  collected: Record<string, unknown>,
  fallbackIso?: string
): string | null {
  const fromCollected = collected.prepLastActiveAt;
  if (typeof fromCollected === 'string' && fromCollected.trim()) {
    return fromCollected;
  }
  if (fallbackIso && !Number.isNaN(new Date(fallbackIso).getTime())) {
    return fallbackIso;
  }
  return null;
}

/**
 * Пауза > 24 ч при незавершённом маршруте → показать «Продолжить с этапа N».
 */
export function resolvePrepContinue(
  route: PrepRoute,
  collected: Record<string, unknown>,
  options?: { nowMs?: number; fallbackLastActiveAt?: string }
): PrepContinueState | null {
  if (route.complete || !route.next) {
    return null;
  }
  const done =
    route.stepIndex > 1 ||
    (Array.isArray(
      (collected.prepProgress as { completedActivityIds?: string[] } | undefined)?.completedActivityIds
    ) &&
      ((collected.prepProgress as { completedActivityIds?: string[] }).completedActivityIds?.length ??
        0) > 0);
  const started =
    Boolean(collected.diagnosticsPackComplete) ||
    Number(collected.theoryLessonsCompleted ?? 0) > 0 ||
    Boolean(collected.prepPlan) ||
    done;

  if (!started) {
    return null;
  }

  const lastActiveAt = resolvePrepLastActiveAt(collected, options?.fallbackLastActiveAt);
  if (!lastActiveAt) {
    return null;
  }

  const lastMs = new Date(lastActiveAt).getTime();
  if (Number.isNaN(lastMs)) {
    return null;
  }

  const nowMs = options?.nowMs ?? Date.now();
  const delta = nowMs - lastMs;
  if (delta < PREP_PAUSE_MS) {
    return null;
  }

  return {
    paused: true,
    pauseHours: Math.max(1, Math.round(delta / (60 * 60 * 1000))),
    stageLabel: route.currentStage.label,
    stageIndex: route.currentStage.index,
    nextTitle: route.next.activity.title,
    durationMin: route.next.activity.durationMin,
    lastActiveAt,
  };
}

export function paceHintFor(pace: PrepPace, remainingMin: number, totalHoursHint: number): string {
  if (pace === 'marathon') {
    return remainingMin > 0
      ? `Марафон: ~${routeDurationLabel(remainingMin)} по шагам · через сутки пришлём напоминание`
      : `Марафон: по одному шагу в день · весь маршрут ~${totalHoursHint} ч`;
  }
  return remainingMin > 0
    ? `Спринт: ~${routeDurationLabel(remainingMin)} до конца · email-напоминание выключено`
    : `Спринт: весь маршрут ~${totalHoursHint} ч за вечер`;
}

function routeDurationLabel(remainingMin: number): string {
  if (remainingMin >= 60) {
    const hours = Math.round((remainingMin / 60) * 10) / 10;
    return `${hours} ч`;
  }
  return `${remainingMin} мин`;
}
