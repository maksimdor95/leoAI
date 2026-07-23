'use client';

import { useHumeTheme } from '@/lib/useHumeTheme';

type ProfileCompletenessBarProps = {
  completeness: number;
  missingFields?: string[];
  locale?: 'ru' | 'en';
};

export function ProfileCompletenessBar({
  completeness,
  missingFields,
  locale = 'ru',
}: ProfileCompletenessBarProps) {
  const isHume = useHumeTheme();
  const percent = Math.round(Math.max(0, Math.min(1, completeness)) * 100);

  return (
    <div
      className={
        isHume
          ? 'rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-paper)] p-3 space-y-2'
          : 'rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={
            isHume
              ? 'hume-label-sm !text-[10px]'
              : 'text-[10px] font-medium uppercase tracking-wider text-slate-400'
          }
        >
          {locale === 'en' ? 'Profile completeness' : 'Полнота профиля'}
        </span>
        <span
          className={
            isHume
              ? 'text-xs font-semibold tabular-nums text-[var(--color-ink)]'
              : 'text-xs font-semibold tabular-nums text-white'
          }
        >
          {percent}%
        </span>
      </div>
      <div
        className={
          isHume ? 'h-1.5 overflow-hidden rounded-full bg-[var(--color-border-hairline)]' : 'h-1.5 overflow-hidden rounded-full bg-white/10'
        }
      >
        <div
          className={
            isHume
              ? 'h-full rounded-full bg-[var(--color-iris)] transition-all'
              : 'h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all'
          }
          style={{ width: `${percent}%` }}
        />
      </div>
      {missingFields?.length ? (
        <p
          className={
            isHume
              ? 'text-[11px] leading-relaxed text-[var(--color-smoke)]'
              : 'text-[11px] leading-relaxed text-slate-400'
          }
        >
          {locale === 'en' ? 'Missing: ' : 'Не хватает: '}
          {missingFields.slice(0, 3).join(', ')}
        </p>
      ) : null}
    </div>
  );
}
