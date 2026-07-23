'use client';

import { Button, Tooltip } from 'antd';
import type { InterviewPrepMode } from '@/types/chat';
import {
  buildActivityStartMessage,
  evaluateMockGate,
  type PrepProgress,
} from '@/lib/prepActivities';
import { derivePrepRoute } from '@/lib/derivePrepRoute';
import { useHumeTheme } from '@/lib/useHumeTheme';

type PrepNextStepPanelProps = {
  progress: PrepProgress;
  collectedData: Record<string, unknown>;
  onActivityStart: (mode: InterviewPrepMode, startMessage: string) => void;
  onDownloadReport?: () => void;
};

export function PrepNextStepPanel({
  progress,
  collectedData,
  onActivityStart,
  onDownloadReport,
}: PrepNextStepPanelProps) {
  const isHume = useHumeTheme();
  const route = derivePrepRoute(progress, collectedData);
  const showPdf =
    Boolean(onDownloadReport) &&
    (Boolean(collectedData.prepComplete) || Boolean(collectedData.diagnosticsPackComplete));

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
          Можно скачать PDF или повторить мок / STAR через режимы ниже.
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
      <div className={`text-[10px] font-medium uppercase tracking-wide ${blocked ? (isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500') : isHume ? 'text-[var(--color-paper)]/70' : 'text-white/80'}`}>
        Следующий шаг · {typeLabel}
        {activity.durationMin ? ` · ~${activity.durationMin} мин` : ''}
      </div>
      <div className={`mt-1 text-sm font-semibold leading-snug ${blocked ? (isHume ? 'text-[var(--color-ink)]' : 'text-slate-200') : ''}`}>
        {activity.title}
      </div>
      <div className={`mt-2 text-[11px] font-medium ${blocked ? (isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500') : isHume ? 'text-[var(--color-paper)]/80' : 'text-white/90'}`}>
        {blocked ? 'Пока недоступно' : 'Начать →'}
      </div>
    </button>
  );

  return (
    <div
      className={
        isHume
          ? 'space-y-2 rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] p-3 shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
          : 'space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3'
      }
    >
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
      <p className={`text-[10px] leading-snug sm:text-[11px] ${isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-400'}`}>
        {route.paceHint}
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
