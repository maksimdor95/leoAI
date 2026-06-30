'use client';

import { Tooltip } from 'antd';
import type { InterviewPrepMode } from '@/types/chat';
import {
  PREP_ACTIVITY_TYPE_LABELS,
  buildActivityStartMessage,
  completedDaysCount,
  evaluateMockGate,
  type PrepActivity,
  type PrepProgress,
} from '@/lib/prepActivities';
import { INTERVIEW_PREP_MODE_TAB_LABELS } from '@/lib/interviewPrepModes';
import { useHumeTheme } from '@/lib/useHumeTheme';

type PrepTodayPanelProps = {
  progress: PrepProgress;
  collectedData: Record<string, unknown>;
  onActivityStart: (mode: InterviewPrepMode, startMessage: string) => void;
  onDownloadReport?: () => void;
};

function ActivityRow({
  activity,
  mockBlocked,
  mockBlockers,
  onStart,
  isHume,
}: {
  activity: PrepActivity;
  mockBlocked: boolean;
  mockBlockers: string[];
  onStart: () => void;
  isHume: boolean;
}) {
  const isMock = activity.mode === 'mock';
  const disabled = isMock && mockBlocked && !activity.completed;

  const button = (
    <button
      type="button"
      disabled={disabled || activity.completed}
      onClick={onStart}
      className={
        isHume
          ? `w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
              activity.completed
                ? 'border-[var(--color-seafoam)] bg-[var(--color-mint)]/40 opacity-90'
                : disabled
                  ? 'cursor-not-allowed border-[var(--color-border-hairline)] bg-[var(--color-paper)] opacity-50'
                  : 'border-[var(--color-border-hairline)] bg-[var(--color-paper)] hover:border-[rgba(34,34,34,0.16)] hover:bg-[var(--color-bone)]'
            }`
          : `w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
              activity.completed
                ? 'border-green-500/20 bg-green-500/5 opacity-80'
                : disabled
                  ? 'cursor-not-allowed border-white/5 bg-white/[0.02] opacity-50'
                  : 'border-white/10 bg-white/[0.04] hover:border-green-500/30 hover:bg-white/[0.07]'
            }`
      }
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 shrink-0 text-[11px] ${
            activity.completed
              ? isHume
                ? 'text-[var(--color-slate-plum)]'
                : 'text-green-400'
              : isHume
                ? 'text-[var(--color-smoke)]'
                : 'text-slate-500'
          }`}
          aria-hidden
        >
          {activity.completed ? '✓' : '○'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[10px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
              {PREP_ACTIVITY_TYPE_LABELS[activity.type]}
            </span>
            {activity.required ? (
              <span
                className={
                  isHume
                    ? 'rounded-full bg-[var(--color-meringue)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-ink)]'
                    : 'rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200/90'
                }
              >
                обязательно
              </span>
            ) : null}
            {activity.durationMin ? (
              <span className={`text-[9px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-600'}`}>
                ~{activity.durationMin} мин
              </span>
            ) : null}
          </div>
          <div
            className={`break-words text-[11px] leading-snug sm:text-xs ${
              activity.completed
                ? isHume
                  ? 'text-[var(--color-smoke)] line-through'
                  : 'text-slate-400 line-through'
                : isHume
                  ? 'text-[var(--color-ink)]'
                  : 'text-slate-100'
            }`}
          >
            {activity.title}
          </div>
          <div className={`mt-0.5 text-[10px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
            {INTERVIEW_PREP_MODE_TAB_LABELS[activity.mode]}
          </div>
        </div>
      </div>
    </button>
  );

  if (disabled && mockBlockers.length > 0) {
    return (
      <Tooltip
        title={
          <div className="max-w-xs space-y-1">
            <div className="font-medium">Мок пока недоступен</div>
            <ul className="list-disc pl-4 text-xs">
              {mockBlockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        }
      >
        <div>{button}</div>
      </Tooltip>
    );
  }

  return button;
}

export function PrepTodayPanel({
  progress,
  collectedData,
  onActivityStart,
  onDownloadReport,
}: PrepTodayPanelProps) {
  const isHume = useHumeTheme();
  const todayActivities = progress.activities.filter((a) => a.day === progress.currentDay);
  const dayFocus =
    todayActivities[0]?.title.split(' · ').slice(1).join(' · ') ?? `День ${progress.currentDay}`;
  const doneDays = completedDaysCount(progress);
  const mockGate = evaluateMockGate(collectedData);

  if (todayActivities.length === 0) {
    return null;
  }

  return (
    <div
      className={
        isHume
          ? 'prep-panel--hume rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-2.5 py-2.5 shadow-[0_1px_3px_rgba(34,34,34,0.06)] sm:px-3 sm:py-3'
          : 'rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2.5 sm:px-3 sm:py-3'
      }
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3
          className={
            isHume
              ? 'text-[10px] font-semibold text-[var(--color-ink)] sm:text-xs'
              : 'text-[10px] font-semibold text-amber-100 sm:text-xs'
          }
        >
          Сегодня · День {progress.currentDay}
        </h3>
        <span
          className={`text-[10px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-amber-200/70'}`}
        >
          {doneDays}/{progress.totalDays} дней · {progress.overallPercent}%
        </span>
      </div>
      <p
        className={`mb-2 break-words text-[10px] leading-snug sm:text-xs ${
          isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-300'
        }`}
      >
        {dayFocus}
      </p>
      <div className="space-y-1.5">
        {todayActivities.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            mockBlocked={!mockGate.allowed}
            mockBlockers={mockGate.blockers}
            isHume={isHume}
            onStart={() => {
              if (activity.completed) return;
              onActivityStart(activity.mode, buildActivityStartMessage(activity));
            }}
          />
        ))}
      </div>
      {!mockGate.allowed ? (
        <p
          className={`mt-2 text-[10px] leading-snug ${
            isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'
          }`}
        >
          Мок откроется после: {mockGate.blockers.map((b) => b.toLowerCase()).join('; ')}.
        </p>
      ) : null}
      {onDownloadReport &&
      (Boolean(collectedData.prepComplete) || Boolean(collectedData.diagnosticsPackComplete)) ? (
        <button
          type="button"
          onClick={onDownloadReport}
          className={
            isHume
              ? 'mt-2.5 w-full rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2 text-[11px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)]'
              : 'mt-2.5 w-full rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2 text-[11px] font-medium text-green-200 transition-colors hover:bg-green-500/20'
          }
        >
          Скачать PDF-отчёт (текущий снимок)
        </button>
      ) : null}
    </div>
  );
}
