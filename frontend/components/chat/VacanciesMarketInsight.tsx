'use client';

import { DownOutlined } from '@ant-design/icons';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { toSecondPersonMarketFit } from '@/lib/marketFitCopy';
import type { AppLocale } from '@/types/appSettings';

export type VacanciesMarketInsightData = {
  locale: AppLocale;
  marketFitSummary?: string | null;
  missingSkillsTop?: string[];
};

export function hasVacanciesMarketInsight(data: VacanciesMarketInsightData): boolean {
  const hasFit = Boolean(data.marketFitSummary?.trim());
  const skills = (data.missingSkillsTop ?? []).filter(Boolean);
  return hasFit || skills.length > 0;
}

type TriggerProps = VacanciesMarketInsightData & {
  open: boolean;
  onToggle: () => void;
};

export function VacanciesMarketInsightTrigger({
  locale,
  marketFitSummary,
  missingSkillsTop = [],
  open,
  onToggle,
}: TriggerProps) {
  const isHume = useHumeTheme();
  if (!hasVacanciesMarketInsight({ locale, marketFitSummary, missingSkillsTop })) return null;

  const label = locale === 'en' ? 'Insight' : 'Инсайт';

  const triggerClass = isHume
    ? `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        open
          ? 'border-[rgba(34,34,34,0.16)] bg-[var(--color-meringue)] text-[var(--color-ink)]'
          : 'border-[rgba(34,34,34,0.1)] bg-[var(--color-paper)] text-[var(--color-smoke)] hover:border-[rgba(34,34,34,0.16)] hover:text-[var(--color-ink)]'
      }`
    : `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        open
          ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-400/25 hover:text-emerald-200'
      }`;

  return (
    <button
      type="button"
      className={triggerClass}
      aria-expanded={open}
      aria-controls="vacancies-market-insight-panel"
      onClick={onToggle}
    >
      <span>{label}</span>
      <DownOutlined
        className={`!text-[9px] opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
        aria-hidden
      />
    </button>
  );
}

type PanelProps = VacanciesMarketInsightData & {
  open: boolean;
  onEditProfile?: () => void;
};

export function VacanciesMarketInsightPanel({
  locale,
  marketFitSummary,
  missingSkillsTop = [],
  open,
  onEditProfile,
}: PanelProps) {
  const isHume = useHumeTheme();
  if (!open) return null;
  if (!hasVacanciesMarketInsight({ locale, marketFitSummary, missingSkillsTop })) return null;

  const skills = missingSkillsTop.filter(Boolean).slice(0, 4);
  const hasFit = Boolean(marketFitSummary?.trim());
  const label = locale === 'en' ? 'Insight' : 'Инсайт';
  const fitTitle = locale === 'en' ? 'Market fit' : 'Fit к рынку';
  const gapsTitle = locale === 'en' ? 'Gaps vs top matches' : 'Пробелы vs топ выдачи';
  const gapsLead =
    locale === 'en'
      ? 'These skills often appear in your top jobs but are weak in your profile. Tap the button — we open Profile and add them to Technical skills. Then save and refresh the match.'
      : 'Эти навыки часто есть в топе вакансий, но слабо отражены у вас. Нажмите кнопку — откроем профиль и добавим их в «Технические навыки». Сохраните и обновите матч ↻.';
  const editCta = locale === 'en' ? 'Add to technical skills' : 'Добавить в технические навыки';

  const panelClass = isHume
    ? 'rounded-2xl border border-[rgba(34,34,34,0.08)] bg-[var(--color-meringue)] p-3.5 space-y-3'
    : 'rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 space-y-3';

  const sectionTitleClass = isHume
    ? 'text-[10px] font-medium uppercase tracking-wide text-[var(--color-smoke)]'
    : 'text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80';

  const bodyClass = isHume
    ? 'hume-body-sm leading-relaxed'
    : 'text-xs text-slate-300 leading-relaxed';

  const ctaClass = isHume
    ? 'mt-1 inline-flex items-center rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)]'
    : 'mt-1 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition-colors hover:bg-emerald-500/25';

  return (
    <div
      id="vacancies-market-insight-panel"
      className={panelClass}
      role="region"
      aria-label={label}
    >
      {hasFit ? (
        <div className="space-y-1">
          <div className={sectionTitleClass}>{fitTitle}</div>
          <p className={bodyClass}>{toSecondPersonMarketFit(marketFitSummary!.trim())}</p>
        </div>
      ) : null}

      {skills.length > 0 ? (
        <div className="space-y-1.5">
          <div className={sectionTitleClass}>{gapsTitle}</div>
          <p className={isHume ? 'text-[11px] leading-relaxed text-[var(--color-smoke)]' : 'text-[11px] leading-relaxed text-slate-400'}>
            {gapsLead}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <span
                key={skill}
                className={
                  isHume
                    ? 'rounded-full border border-[rgba(34,34,34,0.08)] bg-[var(--color-paper)] px-2 py-0.5 text-[11px] text-[var(--color-ink)]'
                    : 'rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-200'
                }
              >
                {skill}
              </span>
            ))}
          </div>
          {onEditProfile ? (
            <button type="button" className={ctaClass} onClick={onEditProfile}>
              {editCta}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
