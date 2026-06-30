'use client';

import type { InterviewPrepMode, PrepPlanDayItem } from '@/types/chat';
import {
  INTERVIEW_PREP_MODE_TAB_LABELS,
  PREP_DAY_SUGGESTED_MODES,
} from '@/lib/interviewPrepModes';
import { Tooltip } from 'antd';
import { useHumeTheme } from '@/lib/useHumeTheme';

type PrepPlanCardProps = {
  title: string;
  planDays: PrepPlanDayItem[];
  compact?: boolean;
  onModeSelect?: (mode: InterviewPrepMode) => void;
  mockGateBlockers?: string[];
};

export function PrepPlanCard({
  title,
  planDays,
  compact,
  onModeSelect,
  mockGateBlockers = [],
}: PrepPlanCardProps) {
  const isHume = useHumeTheme();

  if (planDays.length === 0) {
    return null;
  }

  return (
    <div
      className={`${
        isHume
          ? 'prep-panel--hume rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
          : 'rounded-lg border border-white/10 bg-white/5 shadow-sm backdrop-blur-sm'
      } px-2.5 py-2.5 sm:px-3 sm:py-3 ${compact ? '' : 'sm:col-span-2 lg:col-span-3 xl:col-span-4'}`}
    >
      <h3
        className={`mb-2 text-[10px] font-semibold sm:mb-2.5 sm:text-xs ${
          isHume ? 'text-[var(--color-ink)]' : 'text-white'
        }`}
      >
        {title}
      </h3>
      <div className="space-y-2.5 sm:space-y-3">
        {planDays.map((day) => {
          const suggestedModes = PREP_DAY_SUGGESTED_MODES[day.day] ?? [];
          return (
            <div key={day.day}>
              <div
                className={`text-[10px] font-medium leading-snug sm:text-xs ${
                  isHume ? 'text-[var(--color-ink)]' : 'text-slate-100'
                }`}
              >
                День {day.day}: {day.focus}
              </div>
              {day.tasks.length > 0 ? (
                <ul
                  className={`mt-1 list-disc space-y-0.5 pl-3.5 sm:pl-4 ${
                    isHume ? 'marker:text-[var(--color-smoke)]' : 'marker:text-green-400/80'
                  }`}
                >
                  {day.tasks.map((task) => (
                    <li
                      key={`${day.day}-${task}`}
                      className={`break-words text-[10px] leading-snug sm:text-xs ${
                        isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-300'
                      }`}
                    >
                      {task}
                    </li>
                  ))}
                </ul>
              ) : null}
              {suggestedModes.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span
                    className={`shrink-0 text-[9px] sm:text-[10px] ${
                      isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'
                    }`}
                  >
                    Режимы:
                  </span>
                  {suggestedModes.map((mode) => {
                    const mockBlocked = mode === 'mock' && mockGateBlockers.length > 0;
                    const chip = onModeSelect ? (
                      <button
                        key={`${day.day}-${mode}`}
                        type="button"
                        disabled={mockBlocked}
                        onClick={() => {
                          if (!mockBlocked) {
                            onModeSelect(mode);
                          }
                        }}
                        className={`inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[10px] font-medium transition-colors ${
                          mockBlocked
                            ? isHume
                              ? 'cursor-not-allowed border-[var(--color-border-hairline)] bg-[var(--color-paper)] text-[var(--color-smoke)]'
                              : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-600'
                            : isHume
                              ? 'border-[var(--color-border-hairline)] bg-[var(--color-paper)] text-[var(--color-ink)] hover:bg-[var(--color-bone)]'
                              : 'border-green-500/25 bg-green-500/10 text-green-200/95 hover:border-green-400/50 hover:bg-green-500/20'
                        }`}
                      >
                        {INTERVIEW_PREP_MODE_TAB_LABELS[mode]}
                      </button>
                    ) : (
                      <span
                        key={`${day.day}-${mode}`}
                        className={
                          isHume
                            ? 'inline-flex h-6 shrink-0 items-center rounded-full border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-2 text-[10px] text-[var(--color-smoke)]'
                            : 'inline-flex h-6 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] px-2 text-[10px] text-slate-400'
                        }
                      >
                        {INTERVIEW_PREP_MODE_TAB_LABELS[mode]}
                      </span>
                    );

                    if (mockBlocked) {
                      return (
                        <Tooltip
                          key={`${day.day}-${mode}`}
                          title={
                            <div className="max-w-xs space-y-1">
                              <div className="font-medium">Мок пока недоступен</div>
                              <ul className="list-disc pl-4 text-xs">
                                {mockGateBlockers.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          }
                        >
                          <span>{chip}</span>
                        </Tooltip>
                      );
                    }

                    return chip;
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
