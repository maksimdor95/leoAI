'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExportOutlined, HeartFilled, HeartOutlined } from '@ant-design/icons';
import { Button, Modal, Spin, message } from 'antd';
import { fetchJobDetails, recordJobInteraction } from '@/lib/jobApi';
import { ApplicationDraftPanel } from '@/components/chat/ApplicationDraftPanel';
import { stripHtmlFromText } from '@/lib/buildVacancyPrepText';
import { MatchReasonsPopover } from '@/components/chat/MatchReasonsPopover';
import { formatJobSourceLabel } from '@/lib/jobSourceLabel';
import { uniqueLocationLabels } from '@/lib/locationLabels';
import type { JobDetailsResponse, MatchedJobPreviewContext } from '@/types/jobs';
import { useHumeTheme } from '@/lib/useHumeTheme';

type VacancyPreviewDrawerProps = {
  open: boolean;
  onClose: () => void;
  context: MatchedJobPreviewContext | null;
  onVacancyPrep?: () => void;
  vacancyPrepLoading?: boolean;
  sessionId?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteAriaLabel?: string;
};

function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (!min && !max) return null;
  const suffix = currency === 'RUR' || currency === 'RUB' ? ' ₽' : currency ? ` ${currency}` : '';
  if (min && max) {
    return `${min.toLocaleString('ru-RU')} – ${max.toLocaleString('ru-RU')}${suffix}`;
  }
  if (min) return `от ${min.toLocaleString('ru-RU')}${suffix}`;
  return `до ${max!.toLocaleString('ru-RU')}${suffix}`;
}

function workModeLabel(mode: string | null | undefined): string | null {
  if (!mode) return null;
  if (mode === 'remote') return 'Удалённо';
  if (mode === 'hybrid') return 'Гибрид';
  if (mode === 'office') return 'Офис';
  return mode;
}

function getVacancyModalStyles(isHume: boolean) {
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

export function VacancyPreviewDrawer({
  open,
  onClose,
  context,
  onVacancyPrep,
  vacancyPrepLoading = false,
  sessionId,
  isFavorite = false,
  onToggleFavorite,
  favoriteAriaLabel = 'Добавить в избранное',
}: VacancyPreviewDrawerProps) {
  const isHume = useHumeTheme();
  const [details, setDetails] = useState<JobDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState('');

  const contextJobId = context?.jobId ?? null;
  const loadedJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    setCoverLetter('');
  }, [contextJobId]);

  useEffect(() => {
    if (!open || !contextJobId) {
      return;
    }

    let cancelled = false;
    const isNewJob = loadedJobIdRef.current !== contextJobId;
    if (isNewJob) {
      setLoading(true);
      setError(null);
      setDetails(null);
    }

    void recordJobInteraction(contextJobId, 'view');

    const load = (refresh: boolean) =>
      fetchJobDetails(contextJobId, { refresh })
        .then((data) => {
          if (cancelled) return;
          const hasBody =
            Boolean(data.job.description?.trim()) || Boolean(data.job.requirements?.trim());
          const needsHhMeta =
            data.job.source === 'hh.ru' && !data.conditions && !refresh;
          if ((!hasBody && !refresh && data.job.source === 'hh.ru') || needsHhMeta) {
            return fetchJobDetails(contextJobId, { refresh: true });
          }
          return data;
        })
        .then((data) => {
          if (!cancelled && data) {
            setDetails(data);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить вакансию');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            loadedJobIdRef.current = contextJobId;
          }
        });

    void load(false);

    return () => {
      cancelled = true;
    };
  }, [open, contextJobId]);

  const job = details?.job;
  const isWeak = context?.variant === 'weak';
  const accentClass = isHume
    ? isWeak
      ? 'text-[var(--color-meringue)]'
      : 'text-[var(--color-smoke)]'
    : isWeak
      ? 'text-amber-400'
      : 'text-emerald-400';
  const descriptionText = job?.description?.trim()
    ? stripHtmlFromText(job.description)
    : '';
  const requirementsText = job?.requirements?.trim()
    ? stripHtmlFromText(job.requirements)
    : '';

  const publicUrl = details?.publicUrl ?? context?.sourceUrl ?? null;
  const salary = formatSalary(job?.salary_min, job?.salary_max, job?.currency);
  const conditions = details?.conditions ?? job?.source_meta ?? null;
  const employmentForms =
    conditions?.employmentForms?.length ? conditions.employmentForms.join(' · ') : null;
  const scheduleLabel = conditions?.workScheduleDays || conditions?.scheduleLabel || null;
  const workFormatLabel =
    conditions?.workFormatLabel || workModeLabel(job?.work_mode) || null;
  const locationLabels = useMemo(
    () => uniqueLocationLabels(job?.location),
    [job?.location]
  );

  const factChips = useMemo(() => {
    const chips: string[] = [];
    if (salary) chips.push(salary);
    chips.push(...locationLabels);
    if (conditions?.experienceLabel) chips.push(conditions.experienceLabel);
    if (conditions?.employmentLabel) chips.push(conditions.employmentLabel);
    if (employmentForms) chips.push(employmentForms);
    if (scheduleLabel) chips.push(scheduleLabel);
    if (conditions?.workingHours) chips.push(conditions.workingHours);
    if (workFormatLabel) chips.push(workFormatLabel);
    return chips;
  }, [
    salary,
    locationLabels,
    conditions?.experienceLabel,
    conditions?.employmentLabel,
    employmentForms,
    scheduleLabel,
    conditions?.workingHours,
    workFormatLabel,
  ]);

  const handleApplyOnSite = useCallback(async () => {
    if (!publicUrl || !contextJobId) return;
    if (coverLetter.trim()) {
      try {
        await navigator.clipboard.writeText(coverLetter);
      } catch {
        message.warning('Скопируйте письмо вручную');
      }
    }
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
    void recordJobInteraction(contextJobId, 'apply_intent');
    message.info('Открыли вакансию на сайте. Вставьте письмо в поле отклика.');
  }, [coverLetter, contextJobId, publicUrl]);

  const applyOnSiteButton = publicUrl ? (
    <Button
      type="primary"
      icon={<ExportOutlined aria-hidden />}
      onClick={() => void handleApplyOnSite()}
      className={
        isHume
          ? 'vacancy-primary-btn'
          : '!bg-emerald-600 hover:!bg-emerald-500 !border-emerald-600'
      }
    >
      Откликнуться на сайте
    </Button>
  ) : null;

  const secondaryBtnClass = isHume
    ? 'vacancy-secondary-btn'
    : '!border-white/15 !text-slate-200 !bg-white/5 hover:!bg-white/10';

  const sourceLabel = formatJobSourceLabel(job?.source ?? context?.source);

  const favoriteButton =
    onToggleFavorite && context ? (
      <button
        type="button"
        aria-label={favoriteAriaLabel}
        aria-pressed={isFavorite}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        className={
          isHume
            ? `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(34,34,34,0.08)] !bg-[var(--color-paper)] transition-colors ${
                isFavorite
                  ? 'text-[var(--color-iris)] hover:!bg-[var(--color-rose-mist)]'
                  : 'text-[var(--color-smoke)] hover:border-[rgba(34,34,34,0.12)] hover:!bg-[var(--color-rose-mist)] hover:text-[var(--color-iris)]'
              }`
            : `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                isFavorite
                  ? 'text-rose-400 hover:bg-rose-500/10'
                  : 'text-slate-500 hover:bg-white/[0.06] hover:text-rose-300'
              }`
        }
      >
        {isFavorite ? (
          <HeartFilled className="text-sm" aria-hidden />
        ) : (
          <HeartOutlined className="text-sm" aria-hidden />
        )}
      </button>
    ) : null;

  const metadataRow = context ? (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${
        isHume ? 'vacancy-muted-text' : 'text-slate-400'
      }`}
    >
      <MatchReasonsPopover
        score={context.score}
        reasons={context.reasons}
        variant={context.variant}
      />
      {sourceLabel ? <span>{sourceLabel}</span> : null}
      {favoriteButton}
      {details?.stale ? (
        <span
          className={
            isHume
              ? 'rounded-full bg-[var(--color-meringue)] px-2 py-0.5 text-[var(--color-slate-plum)]'
              : 'rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-300'
          }
        >
          данные могли устареть
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable
      centered={false}
      width="100%"
      wrapClassName={`vacancy-preview-modal-wrap ${isHume ? 'vacancy-preview-modal-wrap--hume' : ''}`}
      className="vacancy-preview-modal"
      destroyOnHidden={false}
      styles={getVacancyModalStyles(isHume)}
      title={
        context ? (
          <div>
            <div className={`vacancy-accent-badge mb-1 ${isHume ? '' : `text-xs uppercase tracking-[0.35em] ${accentClass}/80`}`}>
              {isWeak ? 'Слабое совпадение' : 'Рекомендуем'}
            </div>
            <h2
              className={
                isHume
                  ? 'vacancy-title text-base sm:text-lg md:text-xl leading-snug pr-2 sm:pr-6'
                  : 'text-base sm:text-lg md:text-xl font-semibold text-white leading-snug pr-2 sm:pr-6'
              }
            >
              {job?.title ?? context.title}
            </h2>
            <div className={isHume ? 'mt-1 vacancy-muted-text text-sm' : 'mt-1 text-sm text-slate-400'}>
              {job?.company ?? context.company}
            </div>
          </div>
        ) : null
      }
    >
      {loading && !details ? (
        <div className="space-y-4">
          {metadataRow}
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        </div>
      ) : error && !details ? (
        <div className="space-y-3">
          <p className={isHume ? 'text-sm text-red-600' : 'text-sm text-red-300'}>{error}</p>
          <Button type="primary" onClick={onClose} className={isHume ? 'vacancy-primary-btn' : undefined}>
            Закрыть
          </Button>
        </div>
      ) : (
        <div className={isHume ? 'vacancy-drawer vacancy-drawer--hume' : 'vacancy-drawer vacancy-drawer--dark'}>
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:px-8">
          <div className="space-y-4 min-w-0">
          {metadataRow}

          {factChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {factChips.map((label) => (
                <span
                  key={label}
                  className={isHume ? 'vacancy-chip' : 'rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300'}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          {job?.skills?.length ? (
            <div>
              <div className={isHume ? 'vacancy-section-label' : 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2'}>
                Навыки
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <span
                    key={skill}
                    className={isHume ? 'vacancy-skill-chip' : 'rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-slate-300'}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {descriptionText ? (
            <div>
              <div className={isHume ? 'vacancy-section-label' : 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2'}>
                Описание
              </div>
              <div className={`max-w-prose ${isHume ? 'vacancy-body-text whitespace-pre-wrap' : 'whitespace-pre-wrap text-sm leading-relaxed text-slate-300'}`}>
                {descriptionText}
              </div>
            </div>
          ) : null}

          {requirementsText ? (
            <div>
              <div className={isHume ? 'vacancy-section-label' : 'text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2'}>
                Требования
              </div>
              <div className={`max-w-prose ${isHume ? 'vacancy-body-text whitespace-pre-wrap' : 'whitespace-pre-wrap text-sm leading-relaxed text-slate-300'}`}>
                {requirementsText}
              </div>
            </div>
          ) : null}

          {!descriptionText && !requirementsText ? (
            <p className={isHume ? 'vacancy-muted-text text-sm' : 'text-sm text-slate-500'}>
              Полное описание недоступно — откройте вакансию на сайте источника.
            </p>
          ) : null}

          <div className={`flex flex-wrap items-center gap-2 pt-2 lg:hidden ${isHume ? 'vacancy-divider border-t' : 'border-t border-white/10'}`}>
            {applyOnSiteButton}
            {onVacancyPrep ? (
              <Button
                loading={vacancyPrepLoading}
                onClick={onVacancyPrep}
                className={secondaryBtnClass}
              >
                {vacancyPrepLoading ? 'Готовим разбор…' : 'Разбор вакансии'}
              </Button>
            ) : null}
          </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
          <div className={`hidden lg:flex flex-col gap-2 pb-4 ${isHume ? 'vacancy-divider border-b' : 'border-b border-white/10'}`}>
            {applyOnSiteButton}
            {onVacancyPrep ? (
              <Button
                loading={vacancyPrepLoading}
                onClick={onVacancyPrep}
                className={secondaryBtnClass}
              >
                {vacancyPrepLoading ? 'Готовим разбор…' : 'Разбор вакансии'}
              </Button>
            ) : null}
          </div>
          {context ? (
            <ApplicationDraftPanel
              jobId={context.jobId}
              sessionId={sessionId}
              matchReasons={context.reasons}
              onCoverLetterChange={setCoverLetter}
            />
          ) : null}
          </aside>
        </div>
        </div>
      )}
    </Modal>
  );
}
