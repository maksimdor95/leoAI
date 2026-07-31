'use client';

import { Modal } from 'antd';
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

/** Same full-screen shell as VacancyPreviewDrawer («Открыть вакансию»). */
function getInsightModalStyles(isHume: boolean) {
  if (isHume) {
    return {
      content: {
        backgroundColor: '#ffffff',
        border: 'none',
        borderRadius: 0,
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100vw',
        maxWidth: '100vw',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
      },
      header: {
        backgroundColor: '#ffffff',
        borderBottom: '1px solid rgba(34, 34, 34, 0.08)',
        marginBottom: 0,
        padding: '16px 56px 16px 20px',
        flexShrink: 0,
      },
      body: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '20px 20px 32px',
        WebkitOverflowScrolling: 'touch' as const,
      },
      mask: {
        backgroundColor: 'rgba(34, 34, 34, 0.24)',
      },
    };
  }

  return {
    content: {
      backgroundColor: '#0a0f1e',
      border: 'none',
      borderRadius: 0,
      height: '100dvh',
      maxHeight: '100dvh',
      width: '100vw',
      maxWidth: '100vw',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
    },
    header: {
      backgroundColor: '#0a0f1e',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      marginBottom: 0,
      padding: '16px 56px 16px 20px',
      flexShrink: 0,
    },
    body: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: '20px 20px 32px',
      WebkitOverflowScrolling: 'touch' as const,
    },
    mask: {
      backgroundColor: 'rgba(0, 0, 0, 0.82)',
    },
  };
}

type TriggerProps = VacanciesMarketInsightData & {
  open: boolean;
  onOpen: () => void;
};

export function VacanciesMarketInsightTrigger({
  locale,
  marketFitSummary,
  missingSkillsTop = [],
  open,
  onOpen,
}: TriggerProps) {
  const isHume = useHumeTheme();
  if (!hasVacanciesMarketInsight({ locale, marketFitSummary, missingSkillsTop })) return null;

  const label = locale === 'en' ? 'Insight' : 'Инсайт';

  const triggerClass = isHume
    ? `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        open
          ? 'border-[rgba(34,34,34,0.16)] bg-[var(--color-meringue)] text-[var(--color-ink)]'
          : 'border-[rgba(34,34,34,0.1)] bg-[var(--color-paper)] text-[var(--color-smoke)] hover:border-[rgba(34,34,34,0.16)] hover:text-[var(--color-ink)]'
      }`
    : `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        open
          ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-emerald-400/25 hover:text-emerald-200'
      }`;

  return (
    <button
      type="button"
      className={triggerClass}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
    >
      {label}
    </button>
  );
}

type ModalProps = VacanciesMarketInsightData & {
  open: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
};

export function VacanciesMarketInsightModal({
  locale,
  marketFitSummary,
  missingSkillsTop = [],
  open,
  onClose,
  onEditProfile,
}: ModalProps) {
  const isHume = useHumeTheme();
  if (!hasVacanciesMarketInsight({ locale, marketFitSummary, missingSkillsTop })) {
    return null;
  }

  const skills = missingSkillsTop.filter(Boolean).slice(0, 4);
  const hasFit = Boolean(marketFitSummary?.trim());
  const title = locale === 'en' ? 'Insight' : 'Инсайт';
  const fitTitle = locale === 'en' ? 'Market fit' : 'Fit к рынку';
  const gapsTitle = locale === 'en' ? 'Gaps vs top matches' : 'Пробелы vs топ выдачи';
  const gapsLead =
    locale === 'en'
      ? 'These skills often appear in your top jobs but are weak in your profile. Tap the button — we open Profile and add them to Technical skills. Then save and refresh the match.'
      : 'Эти навыки часто есть в топе вакансий, но слабо отражены у вас. Нажмите кнопку — откроем профиль и добавим их в «Технические навыки». Сохраните и обновите матч ↻.';
  const editCta = locale === 'en' ? 'Add to technical skills' : 'Добавить в технические навыки';

  const sectionTitleClass = isHume
    ? 'text-[10px] font-medium uppercase tracking-wide text-[var(--color-smoke)]'
    : 'text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80';

  const bodyClass = isHume
    ? 'hume-body-sm leading-relaxed'
    : 'text-sm text-slate-300 leading-relaxed';

  const ctaClass = isHume
    ? 'mt-2 inline-flex items-center rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-bone)]'
    : 'mt-2 inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-medium text-emerald-100 transition-colors hover:bg-emerald-500/25';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable
      destroyOnHidden
      centered={false}
      width="100%"
      title={<span className={isHume ? 'text-[var(--color-ink)]' : 'text-white'}>{title}</span>}
      wrapClassName={`vacancy-preview-modal-wrap ${isHume ? 'vacancy-preview-modal-wrap--hume' : ''}`}
      className={isHume ? 'vacancy-preview-modal vacancy-preview-modal--hume' : 'vacancy-preview-modal'}
      styles={getInsightModalStyles(isHume)}
    >
      <div className="space-y-6">
        {hasFit ? (
          <section className="space-y-2">
            <div className={sectionTitleClass}>{fitTitle}</div>
            <p className={bodyClass}>{toSecondPersonMarketFit(marketFitSummary!.trim())}</p>
          </section>
        ) : null}

        {skills.length > 0 ? (
          <section className="space-y-2.5">
            <div className={sectionTitleClass}>{gapsTitle}</div>
            <p
              className={
                isHume
                  ? 'text-[13px] leading-relaxed text-[var(--color-smoke)]'
                  : 'text-[13px] leading-relaxed text-slate-400'
              }
            >
              {gapsLead}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className={
                    isHume
                      ? 'rounded-full border border-[rgba(34,34,34,0.08)] bg-[var(--color-paper)] px-2.5 py-1 text-[12px] text-[var(--color-ink)]'
                      : 'rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[12px] text-slate-200'
                  }
                >
                  {skill}
                </span>
              ))}
            </div>
            {onEditProfile ? (
              <button
                type="button"
                className={ctaClass}
                onClick={() => {
                  onClose();
                  onEditProfile();
                }}
              >
                {editCta}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
