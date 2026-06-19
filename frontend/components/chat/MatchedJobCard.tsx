'use client';

import { useState } from 'react';
import { humanizeMatchReasons } from '@/lib/humanizeMatchReasons';

type MatchedJobCardProps = {
  title: string;
  company: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  reasons?: string[];
  isNew?: boolean;
  variant?: 'recommended' | 'weak';
  onVacancyPrep?: () => void;
  vacancyPrepLoading?: boolean;
};

export function MatchedJobCard({
  title,
  company,
  score,
  source,
  sourceUrl,
  reasons,
  isNew,
  variant = 'recommended',
  onVacancyPrep,
  vacancyPrepLoading = false,
}: MatchedJobCardProps) {
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const isWeak = variant === 'weak';
  const humanized = humanizeMatchReasons(reasons);
  const hasReasons = humanized.length > 0;
  const linkClass = isWeak
    ? 'text-amber-400/90 hover:text-amber-300'
    : 'text-green-400 hover:text-green-300';

  const toggleReasons = () => setReasonsOpen((open) => !open);

  return (
    <div
      className={`rounded-xl border p-3 ${
        isWeak
          ? isNew
            ? 'border-amber-400/45 ring-1 ring-amber-400/20 bg-white/[0.02]'
            : 'border-amber-900/40 bg-white/[0.02]'
          : isNew
            ? 'border-emerald-400/55 ring-1 ring-emerald-400/25 bg-white/[0.03] shadow-[0_0_20px_rgba(52,211,153,0.12)]'
            : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-white leading-snug">{title}</div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {isNew ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isWeak ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              Новая
            </span>
          ) : null}
          {isWeak ? (
            <span className="text-[10px] font-medium text-amber-500/80">слабее</span>
          ) : null}
        </div>
      </div>

      <div className="mt-1 text-xs text-slate-300">{company}</div>

      <div className="mt-2 text-xs text-slate-400">
        {source ? `Источник: ${source} · ` : ''}
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
      </div>

      {hasReasons && reasonsOpen ? (
        <ul className="mt-2 space-y-1 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
          {humanized.map((item) => (
            <li key={item.text} className="flex items-start gap-1.5 text-[11px] leading-snug">
              <span
                className={`mt-0.5 shrink-0 ${
                  item.tone === 'positive'
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
                  item.tone === 'positive'
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

      {(sourceUrl || onVacancyPrep) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={`inline-block text-xs font-medium ${linkClass}`}
            >
              Открыть вакансию
            </a>
          ) : null}
          {onVacancyPrep ? (
            <span
              role="button"
              tabIndex={vacancyPrepLoading ? -1 : 0}
              onClick={vacancyPrepLoading ? undefined : onVacancyPrep}
              onKeyDown={(event) => {
                if (vacancyPrepLoading) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onVacancyPrep();
                }
              }}
              aria-disabled={vacancyPrepLoading}
              className={`cursor-pointer text-xs font-medium text-green-400 hover:text-green-300 ${
                vacancyPrepLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {vacancyPrepLoading ? 'Готовим разбор…' : 'Разбор вакансии'}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
