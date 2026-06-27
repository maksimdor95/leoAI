'use client';

import { Tooltip } from 'antd';
import type { InterviewPrepMode } from '@/types/chat';
import {
  PREP_ACTIVITY_TYPE_LABELS,
  buildActivityStartMessage,
  completedDaysCount,
  evaluateMockGate,
  modeLabel,
  type PrepActivity,
  type PrepProgress,
} from '@/lib/prepActivities';
import { INTERVIEW_PREP_MODE_TAB_LABELS } from '@/lib/interviewPrepModes';

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
}: {
  activity: PrepActivity;
  mockBlocked: boolean;
  mockBlockers: string[];
  onStart: () => void;
}) {
  const isMock = activity.mode === 'mock';
  const disabled = isMock && mockBlocked && !activity.completed;

  const button = (
    <button
      type="button"
      disabled={disabled || activity.completed}
      onClick={onStart}
      className={`w-full text-left rounded-lg border px-2.5 py-2 transition-colors ${
        activity.completed
          ? 'border-green-500/20 bg-green-500/5 opacity-80'
          : disabled
            ? 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
            : 'border-white/10 bg-white/[0.04] hover:border-green-500/30 hover:bg-white/[0.07]'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 shrink-0 text-[11px] ${
            activity.completed ? 'text-green-400' : 'text-slate-500'
          }`}
          aria-hidden
        >
          {activity.completed ? '✓' : '○'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-500">
              {PREP_ACTIVITY_TYPE_LABELS[activity.type]}
            </span>
            {activity.required ? (
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-200/90">
                обязательно
              </span>
            ) : null}
            {activity.durationMin ? (
              <span className="text-[9px] text-slate-600">~{activity.durationMin} мин</span>
            ) : null}
          </div>
          <div
            className={`text-[11px] sm:text-xs leading-snug break-words ${
              activity.completed ? 'text-slate-400 line-through' : 'text-slate-100'
            }`}
          >
            {activity.title}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
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
  const todayActivities = progress.activities.filter((a) => a.day === progress.currentDay);
  const dayFocus =
    todayActivities[0]?.title.split(' · ').slice(1).join(' · ') ?? `День ${progress.currentDay}`;
  const doneDays = completedDaysCount(progress);
  const mockGate = evaluateMockGate(collectedData);

  if (todayActivities.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 sm:px-3 py-2.5 sm:py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="text-[10px] sm:text-xs font-semibold text-amber-100">
          Сегодня · День {progress.currentDay}
        </h3>
        <span className="text-[10px] text-amber-200/70">
          {doneDays}/{progress.totalDays} дней · {progress.overallPercent}%
        </span>
      </div>
      <p className="text-[10px] sm:text-xs text-slate-300 mb-2 leading-snug break-words">{dayFocus}</p>
      <div className="space-y-1.5">
        {todayActivities.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            mockBlocked={!mockGate.allowed}
            mockBlockers={mockGate.blockers}
            onStart={() => {
              if (activity.completed) return;
              onActivityStart(activity.mode, buildActivityStartMessage(activity));
            }}
          />
        ))}
      </div>
      {!mockGate.allowed ? (
        <p className="mt-2 text-[10px] text-slate-500 leading-snug">
          Мок откроется после: {mockGate.blockers.map((b) => b.toLowerCase()).join('; ')}.
        </p>
      ) : null}
      {onDownloadReport &&
      (Boolean(collectedData.prepComplete) || Boolean(collectedData.diagnosticsPackComplete)) ? (
        <button
          type="button"
          onClick={onDownloadReport}
          className="mt-2.5 w-full rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-2 text-[11px] font-medium text-green-200 transition-colors hover:bg-green-500/20"
        >
          Скачать PDF-отчёт (текущий снимок)
        </button>
      ) : null}
    </div>
  );
}
