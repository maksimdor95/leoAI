'use client';

import { useState } from 'react';
import { formatJobSourceLabel } from '@/lib/jobSourceLabel';
import { humanizeMatchReasons } from '@/lib/humanizeMatchReasons';
import { useHumeTheme } from '@/lib/useHumeTheme';

type MatchedJobCardProps = {
  title: string;
  company: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  reasons?: string[];
  isNew?: boolean;
  variant?: 'recommended' | 'weak';
  onOpenVacancy?: () => void;
  onVacancyPrep?: () => void;
  vacancyPrepLoading?: boolean;
};

export function MatchedJobCard({
  title,
  company,
  score,
  source,
  reasons,
  isNew,
  variant = 'recommended',
  onOpenVacancy,
  onVacancyPrep,
  vacancyPrepLoading = false,
}: MatchedJobCardProps) {
  const isHume = useHumeTheme();
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const isWeak = variant === 'weak';
  const humanized = humanizeMatchReasons(reasons);
  const hasReasons = humanized.length > 0;
  const sourceLabel = formatJobSourceLabel(source);

  const linkClass = isHume
    ? 'text-[var(--color-ink)] underline-offset-2 hover:underline'
    : isWeak
      ? 'text-amber-400/90 hover:text-amber-300'
      : 'text-green-400 hover:text-green-300';

  const toggleReasons = () => setReasonsOpen((open) => !open);

  const actionBtnClass = isHume
    ? `hume-btn-ghost !px-0 !py-0 !text-xs`
    : `cursor-pointer text-xs font-medium ${linkClass} bg-transparent border-0 p-0`;

  return (
    <div
      className={`matched-job-card ${
        isWeak ? 'matched-job-card--weak' : 'matched-job-card--recommended'
      }${isNew ? ' matched-job-card--new' : ''} ${
        isHume
          ? `rounded-2xl border p-3 ${
              isWeak
                ? isNew
                  ? 'border-[rgba(255,183,96,0.35)] bg-[var(--color-meringue)]'
                  : 'border-[rgba(34,34,34,0.12)] bg-[var(--color-bone)] shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
                : isNew
                  ? 'border-[rgba(192,148,228,0.35)] bg-[var(--color-rose-mist)]'
                  : 'border-[rgba(34,34,34,0.12)] bg-[var(--color-bone)] shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
            }`
          : `rounded-xl border p-3 ${
              isWeak
                ? isNew
                  ? 'border-amber-400/45 ring-1 ring-amber-400/20 bg-white/[0.02]'
                  : 'border-amber-900/40 bg-white/[0.02]'
                : isNew
                  ? 'border-emerald-400/55 ring-1 ring-emerald-400/25 bg-white/[0.03] shadow-[0_0_20px_rgba(52,211,153,0.12)]'
                  : 'border-white/[0.12] bg-white/[0.03]'
            }`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={
            isHume
              ? 'text-sm font-medium text-[var(--color-ink)] leading-snug'
              : 'text-sm font-semibold text-white leading-snug'
          }
        >
          {title}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {isNew ? (
            <span
              className={
                isHume
                  ? `hume-chip !text-[10px] ${
                      isWeak ? '!bg-[var(--color-meringue)]' : '!bg-[var(--color-mint)]'
                    } !border-transparent`
                  : `rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      isWeak ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`
              }
            >
              Новая
            </span>
          ) : null}
          {isWeak ? (
            <span
              className={
                isHume ? 'hume-label-sm !text-[9px]' : 'text-[10px] font-medium text-amber-500/80'
              }
            >
              слабее
            </span>
          ) : null}
        </div>
      </div>

      <div className={isHume ? 'mt-1 hume-body-sm !text-xs' : 'mt-1 text-xs text-slate-300'}>
        {company}
      </div>

      <div
        className={
          isHume
            ? 'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 hume-body-sm !text-xs'
            : 'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400'
        }
      >
        <span>
          Match:{' '}
          {hasReasons ? (
            <span
              role="button"
              tabIndex={0}
              onClick={toggleReasons}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleReasons();
                }
              }}
              aria-expanded={reasonsOpen}
              className={`cursor-pointer font-medium tabular-nums transition-colors hover:underline ${linkClass}`}
            >
              {score}
            </span>
          ) : (
            <span className="tabular-nums">{score}</span>
          )}
        </span>
        {sourceLabel ? (
          <span
            className={
              isHume
                ? 'inline-flex rounded-full border border-[rgba(34,34,34,0.1)] bg-[var(--color-meringue)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-smoke)]'
                : 'inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400'
            }
          >
            {sourceLabel}
          </span>
        ) : null}
      </div>

      {hasReasons && reasonsOpen ? (
        <ul
          className={
            isHume
              ? 'mt-2 space-y-1 rounded-xl border border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)] px-2.5 py-2'
              : 'mt-2 space-y-1 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2'
          }
        >
          {humanized.map((item) => (
            <li key={item.text} className="flex items-start gap-1.5 text-[11px] leading-snug">
              <span
                className={`mt-0.5 shrink-0 ${
                  isHume
                    ? item.tone === 'positive'
                      ? 'text-[var(--color-iris)]'
                      : item.tone === 'negative'
                        ? 'text-rose-500'
                        : 'text-[var(--color-smoke)]'
                    : item.tone === 'positive'
                      ? 'text-emerald-400/90'
                      : item.tone === 'negative'
                        ? 'text-rose-400/80'
                        : 'text-slate-500'
                }`}
                aria-hidden
              >
                {item.tone === 'positive' ? '✓' : item.tone === 'negative' ? '✗' : '·'}
              </span>
              <span
                className={
                  isHume
                    ? 'text-[var(--color-slate-plum)]'
                    : item.tone === 'positive'
                      ? 'text-slate-300'
                      : item.tone === 'negative'
                        ? 'text-rose-300/90'
                        : 'text-slate-500'
                }
              >
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {(onOpenVacancy || onVacancyPrep) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onOpenVacancy ? (
            <button type="button" onClick={onOpenVacancy} className={actionBtnClass}>
              Открыть вакансию
            </button>
          ) : null}
          {onVacancyPrep ? (
            <button
              type="button"
              disabled={vacancyPrepLoading}
              onClick={vacancyPrepLoading ? undefined : onVacancyPrep}
              className={`${actionBtnClass}${vacancyPrepLoading ? ' opacity-50 cursor-not-allowed' : ''}`}
            >
              {vacancyPrepLoading ? 'Готовим разбор…' : 'Разбор вакансии'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
