'use client';

import { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import type { InterviewPrepMode } from '@/types/chat';
import {
  buildActivityStartMessage,
  evaluateMockGate,
  type PrepProgress,
} from '@/lib/prepActivities';
import { derivePrepRoute } from '@/lib/derivePrepRoute';
import {
  paceHintFor,
  resolvePrepContinue,
  resolvePrepPace,
  writePrepPaceLocal,
  type PrepPace,
} from '@/lib/prepContinue';
import { useHumeTheme } from '@/lib/useHumeTheme';

type PrepNextStepPanelProps = {
  progress: PrepProgress;
  collectedData: Record<string, unknown>;
  onActivityStart: (mode: InterviewPrepMode, startMessage: string) => void;
  onDownloadReport?: () => void;
  /** Fallback, если в collected ещё нет prepLastActiveAt (напр. last message ts). */
  lastActiveFallback?: string;
  /** Persist pace to session collectedData (P1 DoD). */
  onPaceChange?: (pace: PrepPace) => void | Promise<void>;
};

export function PrepNextStepPanel({
  progress,
  collectedData,
  onActivityStart,
  onDownloadReport,
  lastActiveFallback,
  onPaceChange,
}: PrepNextStepPanelProps) {
  const isHume = useHumeTheme();
  const [pace, setPace] = useState<PrepPace>(() => resolvePrepPace(collectedData));
  const [paceSaving, setPaceSaving] = useState(false);
  const route = derivePrepRoute(progress, collectedData);
  const continueState = resolvePrepContinue(route, collectedData, {
    fallbackLastActiveAt: lastActiveFallback,
  });
  const showPdf =
    Boolean(onDownloadReport) &&
    (Boolean(collectedData.prepComplete) || Boolean(collectedData.diagnosticsPackComplete));

  useEffect(() => {
    setPace(resolvePrepPace(collectedData));
  }, [collectedData.prepPace]);

  const selectPace = (next: PrepPace) => {
    setPace(next);
    writePrepPaceLocal(next);
    if (!onPaceChange) {
      return;
    }
    setPaceSaving(true);
    void Promise.resolve(onPaceChange(next)).finally(() => setPaceSaving(false));
  };

  if (route.complete) {
    return (
      <div
        className={
          isHume
            ? 'rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-3 py-3 shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
            : 'rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-3'
        }
      >
        <div
          className={`text-xs font-semibold sm:text-sm ${
            isHume ? 'text-[var(--color-ink)]' : 'text-emerald-100'
          }`}
        >
          Маршрут пройден
        </div>
        <p className={`mt-1 text-[11px] leading-snug sm:text-xs ${isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-300'}`}>
          Можно скачать PDF или повторить мок / STAR / вопросы ниже.
        </p>
        {showPdf && onDownloadReport ? (
          <Button
            type="primary"
            size="small"
            onClick={onDownloadReport}
            className={
              isHume
                ? '!mt-2.5 !h-9 !w-full !rounded-full !border-none !bg-[var(--color-ink)] !text-[var(--color-paper)]'
                : '!mt-2.5 !h-9 !w-full !rounded-full !border-none !bg-green-500'
            }
          >
            Скачать PDF-отчёт
          </Button>
        ) : null}
      </div>
    );
  }

  const next = route.next;
  if (!next) {
    return null;
  }

  const { activity, typeLabel, blocked, blockers } = next;
  const start = () => {
    if (blocked || activity.completed) return;
    onActivityStart(activity.mode, buildActivityStartMessage(activity));
  };

  const hint = paceHintFor(pace, route.remainingMin, route.totalHoursHint);
  const isResume = Boolean(continueState);

  const cta = (
    <button
      type="button"
      disabled={blocked}
      onClick={start}
      className={
        isHume
          ? `w-full rounded-xl border px-3 py-3 text-left transition-colors ${
              blocked
                ? 'cursor-not-allowed border-[var(--color-border-hairline)] bg-[var(--color-paper)] opacity-60'
                : 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90'
            }`
          : `w-full rounded-xl border px-3 py-3 text-left transition-colors ${
              blocked
                ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-60'
                : 'border-green-500/40 bg-green-500/90 text-white hover:bg-green-400'
            }`
      }
    >
      <div
        className={`text-[10px] font-medium uppercase tracking-wide ${
          blocked
            ? isHume
              ? 'text-[var(--color-smoke)]'
              : 'text-slate-500'
            : isHume
              ? 'text-[var(--color-paper)]/70'
              : 'text-white/80'
        }`}
      >
        {isResume
          ? `Продолжить · этап ${continueState!.stageIndex} «${continueState!.stageLabel}»`
          : `Следующий шаг · ${typeLabel}`}
        {activity.durationMin ? ` · ~${activity.durationMin} мин` : ''}
      </div>
      <div
        className={`mt-1 text-sm font-semibold leading-snug ${
          blocked ? (isHume ? 'text-[var(--color-ink)]' : 'text-slate-200') : ''
        }`}
      >
        {activity.title}
      </div>
      <div
        className={`mt-2 text-[11px] font-medium ${
          blocked
            ? isHume
              ? 'text-[var(--color-smoke)]'
              : 'text-slate-500'
            : isHume
              ? 'text-[var(--color-paper)]/80'
              : 'text-white/90'
        }`}
      >
        {blocked ? 'Пока недоступно' : isResume ? 'Продолжить →' : 'Начать →'}
      </div>
    </button>
  );

  const paceChipClass = (active: boolean) =>
    isHume
      ? `rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
          active
            ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]'
            : 'border-[var(--color-border-hairline)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-bone)]'
        }`
      : `rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
          active
            ? 'border-green-400/60 bg-green-500/30 text-green-100'
            : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
        }`;

  return (
    <div
      className={
        isHume
          ? 'space-y-2 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] p-3 shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
          : 'space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3'
      }
    >
      {isResume ? (
        <div
          className={
            isHume
              ? 'rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-2.5 py-2'
              : 'rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2'
          }
        >
          <p
            className={`text-[11px] font-medium leading-snug ${
              isHume ? 'text-[var(--color-ink)]' : 'text-amber-100'
            }`}
          >
            Вы остановились на этапе {continueState!.stageIndex} «{continueState!.stageLabel}»
            {continueState!.pauseHours ? ` · пауза ~${continueState!.pauseHours} ч` : ''}
          </p>
          <p
            className={`mt-0.5 text-[10px] leading-snug ${
              isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'
            }`}
          >
            Продолжите с того же шага — прогресс сохранён.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div
          className={`text-[11px] font-semibold sm:text-xs ${
            isHume ? 'text-[var(--color-ink)]' : 'text-slate-100'
          }`}
        >
          {route.progressLabel}
        </div>
        {route.remainingMin > 0 ? (
          <span className={`text-[10px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
            ~{route.remainingMin} мин осталось
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[10px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
          Темп:
        </span>
        <button type="button" className={paceChipClass(pace === 'sprint')} onClick={() => selectPace('sprint')} disabled={paceSaving}>
          Спринт · вечер
        </button>
        <button
          type="button"
          className={paceChipClass(pace === 'marathon')}
          onClick={() => selectPace('marathon')}
          disabled={paceSaving}
        >
          Марафон · по шагу
        </button>
      </div>

      <p className={`text-[10px] leading-snug sm:text-[11px] ${isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-400'}`}>
        {hint}
      </p>

      {blocked && blockers.length > 0 ? (
        <Tooltip
          title={
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          }
        >
          <div>{cta}</div>
        </Tooltip>
      ) : (
        cta
      )}
      {blocked && blockers.length > 0 ? (
        <p className={`text-[10px] leading-snug ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
          Сначала: {blockers.map((b) => b.toLowerCase()).join('; ')}.
        </p>
      ) : null}
      {showPdf && onDownloadReport && evaluateMockGate(collectedData).allowed === false ? (
        <button
          type="button"
          onClick={onDownloadReport}
          className={
            isHume
              ? 'w-full rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-[11px] font-medium text-[var(--color-ink)]'
              : 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-slate-200'
          }
        >
          Скачать текущий PDF-снимок
        </button>
      ) : null}
    </div>
  );
}
