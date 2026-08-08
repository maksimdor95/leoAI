'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { toSecondPersonMarketFit } from '@/lib/marketFitCopy';
import { classifySkillGapBucket } from '@/lib/skillGapBucket';
import { matchCoursesForGaps } from '@/lib/insightCoursesCatalog';
import { captureEvent } from '@/lib/analytics';
import type { AppLocale } from '@/types/appSettings';

export type MissingSkillDetail = {
  skill: string;
  count: number;
};

export type VacanciesMarketInsightData = {
  locale: AppLocale;
  marketFitSummary?: string | null;
  missingSkillsTop?: string[];
  missingSkillsDetails?: MissingSkillDetail[];
  missingSkillsAmongTopN?: number;
  missingSkillsTotalUnique?: number;
  nextActions?: string[];
  catalogHints?: string[];
  matchDelta?: {
    beforeRecommended: number;
    afterRecommended: number;
    beforeMaxScore: number;
    afterMaxScore: number;
  } | null;
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
      onClick={() => {
        captureEvent('insight_opened', {
          gaps_count: (missingSkillsTop ?? []).length,
          has_fit: Boolean(marketFitSummary?.trim()),
        });
        onOpen();
      }}
    >
      {label}
    </button>
  );
}

type ModalProps = VacanciesMarketInsightData & {
  open: boolean;
  onClose: () => void;
  /** One-click: merge selected skills into profile + rematch. Stay in modal. */
  onAddSkills?: (
    skills: string[]
  ) => Promise<{
    missingSkillsDetails?: MissingSkillDetail[];
    missingSkillsAmongTopN?: number;
  } | void>;
  addingSkills?: boolean;
};

export function VacanciesMarketInsightModal({
  locale,
  marketFitSummary,
  missingSkillsTop = [],
  missingSkillsDetails,
  missingSkillsAmongTopN,
  nextActions = [],
  catalogHints = [],
  matchDelta = null,
  open,
  onClose,
  onAddSkills,
  addingSkills = false,
}: ModalProps) {
  const isHume = useHumeTheme();

  const liveDetails = useMemo(() => {
    if (missingSkillsDetails?.length) return missingSkillsDetails.filter((d) => d.skill);
    return missingSkillsTop.filter(Boolean).map((skill) => ({ skill, count: 0 }));
  }, [missingSkillsDetails, missingSkillsTop]);

  /** Freeze Fit/actions while open; gaps refresh only from rematch result (not a racey live prop). */
  type InsightSnapshot = {
    fit: string;
    actions: string[];
    hints: string[];
    details: MissingSkillDetail[];
    amongN: number;
  };

  const [snap, setSnap] = useState<InsightSnapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  /** Skills feeding the courses carousel — keep last closed set if rematch clears the list. */
  const [courseSkills, setCourseSkills] = useState<string[]>([]);
  const [coursesFromClosed, setCoursesFromClosed] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const wasOpenRef = useRef(false);
  /** Skills the user already added/dismissed this open — never flash them back from a stale rematch. */
  const closedGapsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      closedGapsRef.current = new Set();
      const next: InsightSnapshot = {
        fit: marketFitSummary?.trim() ?? '',
        actions: [...nextActions],
        hints: [...catalogHints],
        details: liveDetails,
        amongN: missingSkillsAmongTopN ?? 0,
      };
      setSnap(next);
      setSelected(new Set(next.details.map((d) => d.skill)));
      setCourseSkills(next.details.map((d) => d.skill));
      setCoursesFromClosed(false);
    }
    if (!open && wasOpenRef.current) {
      setSnap(null);
      setSelected(new Set());
      setCourseSkills([]);
      setCoursesFromClosed(false);
      setLocalBusy(false);
      closedGapsRef.current = new Set();
    }
    wasOpenRef.current = open;
  }, [
    open,
    marketFitSummary,
    nextActions,
    catalogHints,
    liveDetails,
    missingSkillsAmongTopN,
  ]);

  const filterClosed = (rows: MissingSkillDetail[]) =>
    rows.filter((d) => d.skill && !closedGapsRef.current.has(d.skill.toLowerCase()));

  const applyGapDetails = (
    nextDetails: MissingSkillDetail[],
    amongNValue: number,
    opts?: { closedSkills?: string[]; updateCourses?: boolean }
  ) => {
    const filtered = filterClosed(nextDetails);
    setSnap((prev) => {
      const base: InsightSnapshot = prev ?? {
        fit: marketFitSummary?.trim() ?? '',
        actions: [...nextActions],
        hints: [...catalogHints],
        details: [],
        amongN: amongNValue,
      };
      return {
        ...base,
        details: filtered,
        amongN: amongNValue,
      };
    });
    setSelected(new Set(filtered.map((d) => d.skill)));
    if (opts?.updateCourses === false) return;
    if (filtered.length > 0) {
      setCourseSkills(filtered.map((d) => d.skill));
      setCoursesFromClosed(false);
    } else if (opts?.closedSkills?.length) {
      setCourseSkills(opts.closedSkills);
      setCoursesFromClosed(true);
    }
  };

  const details = snap?.details ?? liveDetails;
  const amongN = snap?.amongN ?? missingSkillsAmongTopN ?? 0;
  const frozenFit = snap?.fit ?? '';
  const frozenActions = snap?.actions ?? nextActions;
  const frozenHints = snap?.hints ?? catalogHints;

  const hasInsightContent =
    Boolean(frozenFit) ||
    details.length > 0 ||
    courseSkills.length > 0 ||
    frozenActions.length > 0 ||
    Boolean(matchDelta);

  if (!hasInsightContent) {
    return null;
  }

  const hasFit = Boolean(frozenFit);
  const selectedList = details.map((d) => d.skill).filter((s) => selected.has(s));
  const selectedHard = selectedList.filter((s) => classifySkillGapBucket(s) === 'hard').length;
  const selectedSoft = selectedList.filter((s) => classifySkillGapBucket(s) === 'soft').length;
  const courses = matchCoursesForGaps(
    (localBusy || addingSkills) && courseSkills.length > 0
      ? courseSkills
      : details.length > 0
        ? details.map((d) => d.skill)
        : courseSkills
  );
  const allSelected = details.length > 0 && selectedList.length === details.length;

  const title = locale === 'en' ? 'Insight' : 'Инсайт';
  const fitTitle = locale === 'en' ? 'Market fit' : 'Fit к рынку';
  const gapsTitle = locale === 'en' ? 'Add missing skills' : 'Добавить в профиль';
  const gapsLead =
    locale === 'en'
      ? 'Gaps that appear in more than 35 of your matches. After you save, the match refreshes — closed ones drop out.'
      : 'Пробелы, которые встречаются более чем в 35 вакансиях подбора. После сохранения подбор обновится — закрытые исчезнут.';
  const gapsEmpty =
    locale === 'en'
      ? 'Frequent gaps above the threshold are closed for now. New ones may appear as the market shifts.'
      : 'Частые пробелы выше порога закрыты. Новые могут появиться, когда рынок или подбор изменятся.';
  const gapsFootnote =
    details.length === 0
      ? null
      : locale === 'en'
        ? `Showing gaps in 36+ jobs (${details.length}). Weaker signals are hidden.`
        : `Показаны пробелы из 36+ вакансий (${details.length}). Более редкие скрыты.`;
  const editCta = (() => {
    if (selectedList.length === 0) {
      return locale === 'en' ? 'Select at least one skill' : 'Выберите хотя бы один навык';
    }
    const parts: string[] = [];
    if (selectedHard > 0) {
      parts.push(
        locale === 'en' ? `${selectedHard} technical` : `${selectedHard} техн.`
      );
    }
    if (selectedSoft > 0) {
      parts.push(
        locale === 'en' ? `${selectedSoft} leadership` : `${selectedSoft} управл.`
      );
    }
    return locale === 'en'
      ? `Add to profile (${parts.join(' · ')})`
      : `Добавить в профиль (${parts.join(' · ')})`;
  })();
  const selectAllLabel = locale === 'en' ? 'Select all' : 'Выбрать все';
  const clearLabel = locale === 'en' ? 'Clear' : 'Снять все';
  const coursesTitle = locale === 'en' ? 'Courses for your gaps' : 'Курсы по вашим пробелам';
  const coursesLead = coursesFromClosed
    ? locale === 'en'
      ? 'Based on skills you just added — useful to deepen them.'
      : 'По навыкам, которые только что добавили — можно усилить их курсом.'
    : locale === 'en'
      ? 'Curated by LEO from your real gaps — open the provider site to learn more.'
      : 'Подборка LEO по реальным пробелам профиля. Переход на сайт провайдера.';
  const goCourse = locale === 'en' ? 'Go to course' : 'Перейти к курсу';
  const coversLabel = locale === 'en' ? 'Covers' : 'Закрывает';
  const otherTitle = locale === 'en' ? 'What else limits match' : 'Что ещё режет матч';
  const actionsTitle = locale === 'en' ? 'Next steps' : 'Что сделать';
  const deltaTitle = locale === 'en' ? 'After last update' : 'После последнего обновления';

  const formatGapCount = (count: number): string | null => {
    if (count <= 0) return null;
    if (locale === 'en') {
      return count === 1 ? 'in 1 job' : `in ${count} jobs`;
    }
    // «в 1 вакансии» / «в 2 вакансиях»
    return count === 1 ? 'в 1 вакансии' : `в ${count} вакансиях`;
  };

  const freqHint =
    locale === 'en'
      ? amongN > 0
        ? `How often this gap appears across ${amongN} matched jobs`
        : 'How often this gap appears in your matches'
      : amongN > 0
        ? `Сколько раз пробел встречается среди ${amongN} подходящих вакансий`
        : 'Сколько раз пробел встречается в подходящих вакансиях';

  const deltaMeaningful = Boolean(
    matchDelta &&
      (matchDelta.beforeRecommended !== matchDelta.afterRecommended ||
        matchDelta.beforeMaxScore !== matchDelta.afterMaxScore)
  );

  const sectionTitleClass = isHume
    ? 'text-[10px] font-medium uppercase tracking-wide text-[var(--color-smoke)]'
    : 'text-[10px] font-semibold uppercase tracking-wide text-emerald-200/80';

  const bodyClass = isHume
    ? 'hume-body-sm leading-relaxed'
    : 'text-sm text-slate-300 leading-relaxed';

  const ctaClass = isHume
    ? 'inline-flex items-center justify-center rounded-full border border-[rgba(34,34,34,0.12)] bg-[var(--color-ink)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50'
    : 'inline-flex items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/25 px-4 py-2 text-[13px] font-medium text-emerald-50 transition-colors hover:bg-emerald-500/35 disabled:opacity-50';

  const secondaryLinkClass = isHume
    ? 'border-0 bg-transparent p-0 text-[12px] font-medium text-[var(--color-smoke)] shadow-none hover:text-[var(--color-ink)] disabled:opacity-50'
    : 'border-0 bg-transparent p-0 text-[12px] font-medium text-slate-400 shadow-none hover:text-slate-200 disabled:opacity-50';

  const toggleSkill = (skill: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return next;
    });
  };

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
            <p className={bodyClass}>{toSecondPersonMarketFit(frozenFit)}</p>
          </section>
        ) : null}

        {frozenActions.length > 0 ? (
          <section className="space-y-2">
            <div className={sectionTitleClass}>{actionsTitle}</div>
            <ul
              className={
                isHume
                  ? 'list-disc space-y-1 pl-4 text-[13px] text-[var(--color-smoke)]'
                  : 'list-disc space-y-1 pl-4 text-[13px] text-slate-400'
              }
            >
              {frozenActions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3">
          <div>
            <div className={sectionTitleClass}>{gapsTitle}</div>
            <p
              className={
                isHume
                  ? 'mt-1.5 text-[13px] leading-relaxed text-[var(--color-smoke)]'
                  : 'mt-1.5 text-[13px] leading-relaxed text-slate-400'
              }
            >
              {details.length > 0 ? gapsLead : gapsEmpty}
            </p>
            {gapsFootnote ? (
              <p
                className={
                  isHume
                    ? 'mt-1 text-[11px] text-[var(--color-smoke)]'
                    : 'mt-1 text-[11px] text-slate-500'
                }
              >
                {gapsFootnote}
              </p>
            ) : null}
          </div>

          {details.length > 0 ? (
            <ul className="space-y-1.5" role="listbox" aria-multiselectable="true">
              {details.map((item) => {
                const isOn = selected.has(item.skill);
                const countText = formatGapCount(item.count);
                const countLabel = countText ? (
                  <span
                    className={
                      isHume
                        ? 'shrink-0 text-[11px] text-[var(--color-smoke)]'
                        : 'shrink-0 text-[11px] text-slate-500'
                    }
                    title={freqHint}
                  >
                    {countText}
                  </span>
                ) : null;
                return (
                  <li key={item.skill}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      disabled={addingSkills || localBusy}
                      onClick={() => toggleSkill(item.skill)}
                      className={
                        isHume
                          ? `flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              isOn
                                ? 'border-[rgba(34,34,34,0.16)] bg-[var(--color-meringue)]'
                                : 'border-[rgba(34,34,34,0.08)] bg-[var(--color-paper)] opacity-75'
                            }`
                          : `flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              isOn
                                ? 'border-emerald-400/35 bg-emerald-500/15'
                                : 'border-white/10 bg-white/[0.03] opacity-70'
                            }`
                      }
                    >
                      <span
                        aria-hidden
                        className={
                          isHume
                            ? `flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                                isOn
                                  ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                                  : 'border-[rgba(34,34,34,0.2)] bg-white text-transparent'
                              }`
                            : `flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] ${
                                isOn
                                  ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                                  : 'border-white/25 bg-transparent text-transparent'
                              }`
                        }
                      >
                        ✓
                      </span>
                      <span
                        className={
                          isHume
                            ? 'min-w-0 flex-1 text-[13px] font-medium text-[var(--color-ink)]'
                            : 'min-w-0 flex-1 text-[13px] font-medium text-slate-100'
                        }
                      >
                        {item.skill}
                      </span>
                      {countLabel}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {onAddSkills && details.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
              <button
                type="button"
                className={ctaClass}
                disabled={addingSkills || localBusy || selectedList.length === 0}
                onClick={() => {
                  const toAdd = selectedList;
                  if (toAdd.length === 0 || !onAddSkills || localBusy || addingSkills) return;
                  captureEvent('insight_skills_added', {
                    count: toAdd.length,
                    skills: toAdd.slice(0, 8),
                  });
                  const closed = new Set(toAdd.map((s) => s.toLowerCase()));
                  const previousDetails = details;
                  const previousAmong = amongN;
                  for (const s of closed) closedGapsRef.current.add(s);
                  // Optimistic: drop selected gaps immediately; keep courses stable until rematch.
                  applyGapDetails(
                    details.filter((d) => !closed.has(d.skill.toLowerCase())),
                    amongN,
                    { closedSkills: toAdd, updateCourses: false }
                  );
                  setLocalBusy(true);
                  void (async () => {
                    try {
                      const result = await onAddSkills(toAdd);
                      if (!result) {
                        for (const s of closed) closedGapsRef.current.delete(s);
                        applyGapDetails(previousDetails, previousAmong);
                        return;
                      }
                      applyGapDetails(
                        (result.missingSkillsDetails ?? []).filter((d) => d.skill),
                        result.missingSkillsAmongTopN ?? previousAmong,
                        { closedSkills: toAdd, updateCourses: true }
                      );
                    } catch {
                      for (const s of closed) closedGapsRef.current.delete(s);
                      applyGapDetails(previousDetails, previousAmong);
                    } finally {
                      setLocalBusy(false);
                    }
                  })();
                }}
              >
                {addingSkills || localBusy
                  ? locale === 'en'
                    ? 'Updating…'
                    : 'Обновляем…'
                  : editCta}
              </button>
              <button
                type="button"
                className={secondaryLinkClass}
                disabled={addingSkills || localBusy}
                onClick={() => {
                  if (allSelected) setSelected(new Set());
                  else setSelected(new Set(details.map((d) => d.skill)));
                }}
              >
                {allSelected ? clearLabel : selectAllLabel}
              </button>
            </div>
          ) : null}
        </section>

        {deltaMeaningful && matchDelta ? (
          <section className="space-y-1.5">
            <div className={sectionTitleClass}>{deltaTitle}</div>
            <p className={bodyClass}>
              {locale === 'en'
                ? `Recommended: ${matchDelta.beforeRecommended} → ${matchDelta.afterRecommended} · max score: ${matchDelta.beforeMaxScore} → ${matchDelta.afterMaxScore}`
                : `Рекомендованных: ${matchDelta.beforeRecommended} → ${matchDelta.afterRecommended} · макс. score: ${matchDelta.beforeMaxScore} → ${matchDelta.afterMaxScore}`}
            </p>
          </section>
        ) : null}

        {frozenHints.length > 0 ? (
          <section className="space-y-2">
            <div className={sectionTitleClass}>{otherTitle}</div>
            <ul
              className={
                isHume
                  ? 'list-disc space-y-1 pl-4 text-[13px] text-[var(--color-smoke)]'
                  : 'list-disc space-y-1 pl-4 text-[13px] text-slate-400'
              }
            >
              {frozenHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {courses.length > 0 ? (
          <section className="space-y-2.5">
            <div className={sectionTitleClass}>{coursesTitle}</div>
            <p
              className={
                isHume
                  ? 'text-[13px] leading-relaxed text-[var(--color-smoke)]'
                  : 'text-[13px] leading-relaxed text-slate-400'
              }
            >
              {coursesLead}
            </p>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
              {courses.map((course) => (
                <article
                  key={course.id}
                  className={
                    isHume
                      ? 'w-[240px] shrink-0 snap-start rounded-2xl border border-[rgba(34,34,34,0.1)] bg-[var(--color-paper)] p-3.5'
                      : 'w-[240px] shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.04] p-3.5'
                  }
                >
                  <div
                    className={
                      isHume
                        ? 'text-[11px] text-[var(--color-smoke)]'
                        : 'text-[11px] text-slate-400'
                    }
                  >
                    {[course.level, course.duration].filter(Boolean).join(' · ')}
                  </div>
                  <div
                    className={
                      isHume
                        ? 'mt-1.5 text-[15px] font-semibold leading-snug text-[var(--color-ink)]'
                        : 'mt-1.5 text-[15px] font-semibold leading-snug text-white'
                    }
                  >
                    {course.title}
                  </div>
                  <div
                    className={
                      isHume
                        ? 'mt-1 text-[12px] text-[var(--color-smoke)]'
                        : 'mt-1 text-[12px] text-slate-400'
                    }
                  >
                    {course.provider}
                  </div>
                  <div
                    className={
                      isHume
                        ? 'mt-2 text-[11px] leading-snug text-[var(--color-smoke)]'
                        : 'mt-2 text-[11px] leading-snug text-slate-500'
                    }
                  >
                    {coversLabel}: {course.matchedGaps.slice(0, 2).join(', ')}
                  </div>
                  <a
                    href={course.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      captureEvent('insight_course_clicked', {
                        course_id: course.id,
                        provider: course.provider,
                        matched_gaps: course.matchedGaps.slice(0, 4),
                      })
                    }
                    className={
                      isHume
                        ? 'mt-3 flex w-full items-center justify-center rounded-full bg-[var(--color-ink)] px-3 py-2 text-[12px] font-medium text-white'
                        : 'mt-3 flex w-full items-center justify-center rounded-full bg-white px-3 py-2 text-[12px] font-medium text-slate-900'
                    }
                  >
                    {goCourse}
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
