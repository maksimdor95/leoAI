'use client';

import type { InterviewPrepMode, PrepPlanDayItem } from '@/types/chat';
import {
  INTERVIEW_PREP_MODE_TAB_LABELS,
  PREP_DAY_SUGGESTED_MODES,
} from '@/lib/interviewPrepModes';

type PrepPlanCardProps = {
  title: string;
  planDays: PrepPlanDayItem[];
  compact?: boolean;
  onModeSelect?: (mode: InterviewPrepMode) => void;
};

export function PrepPlanCard({ title, planDays, compact, onModeSelect }: PrepPlanCardProps) {
  if (planDays.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm shadow-sm px-2.5 sm:px-3 py-2.5 sm:py-3 ${
        compact ? '' : 'sm:col-span-2 lg:col-span-3 xl:col-span-4'
      }`}
    >
      <h3 className="text-[10px] sm:text-xs font-semibold text-white mb-2 sm:mb-2.5">{title}</h3>
      <div className="space-y-2.5 sm:space-y-3">
        {planDays.map((day) => {
          const suggestedModes = PREP_DAY_SUGGESTED_MODES[day.day] ?? [];
          return (
            <div key={day.day}>
              <div className="text-[10px] sm:text-xs font-medium text-slate-100 leading-snug">
                День {day.day}: {day.focus}
              </div>
              {day.tasks.length > 0 ? (
                <ul className="mt-1 space-y-0.5 pl-3.5 sm:pl-4 list-disc marker:text-green-400/80">
                  {day.tasks.map((task) => (
                    <li
                      key={`${day.day}-${task}`}
                      className="text-[10px] sm:text-xs text-slate-300 leading-snug break-words"
                    >
                      {task}
                    </li>
                  ))}
                </ul>
              ) : null}
              {suggestedModes.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] text-slate-500 shrink-0">
                    Режимы:
                  </span>
                  {suggestedModes.map((mode) =>
                    onModeSelect ? (
                      <button
                        key={`${day.day}-${mode}`}
                        type="button"
                        onClick={() => onModeSelect(mode)}
                        className="inline-flex h-6 shrink-0 items-center rounded-full border border-green-500/25 bg-green-500/10 px-2 text-[10px] font-medium text-green-200/95 transition-colors hover:border-green-400/50 hover:bg-green-500/20"
                      >
                        {INTERVIEW_PREP_MODE_TAB_LABELS[mode]}
                      </button>
                    ) : (
                      <span
                        key={`${day.day}-${mode}`}
                        className="inline-flex h-6 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] px-2 text-[10px] text-slate-400"
                      >
                        {INTERVIEW_PREP_MODE_TAB_LABELS[mode]}
                      </span>
                    )
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
