'use client';

import {
  formatPrepDate,
  resolvePrepRetention,
  resolveStarBank,
  type StarBankEntry,
} from '@/lib/prepRetention';
import { useHumeTheme } from '@/lib/useHumeTheme';

type PrepRetentionPanelProps = {
  collectedData: Record<string, unknown>;
  compact?: boolean;
};

function starPreview(entry: StarBankEntry): string {
  const text = entry.userMessage.trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 140)}…`;
}

export function PrepRetentionPanel({ collectedData, compact }: PrepRetentionPanelProps) {
  const isHume = useHumeTheme();
  const retention = resolvePrepRetention(collectedData);
  const starBank = resolveStarBank(collectedData);

  if (!retention) {
    return null;
  }

  const history = retention.prepVacancyHistory ?? [];

  return (
    <div
      className={
        isHume
          ? `prep-panel--hume rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] shadow-[0_1px_3px_rgba(34,34,34,0.06)] ${
              compact ? 'space-y-2 p-2.5' : 'space-y-3 p-3 sm:p-4'
            }`
          : `rounded-xl border border-amber-500/25 bg-amber-500/5 ${
              compact ? 'space-y-2 p-2.5' : 'space-y-3 p-3 sm:p-4'
            }`
      }
    >
      <div>
        <div
          className={
            isHume
              ? 'hume-label-sm'
              : 'text-[10px] font-medium uppercase tracking-wider text-amber-300/90 sm:text-xs'
          }
        >
          Повторная подготовка
        </div>
        <p
          className={
            isHume
              ? 'mt-1 text-xs leading-relaxed text-[var(--color-ink)] sm:text-sm'
              : 'mt-1 text-xs leading-relaxed text-slate-200 sm:text-sm'
          }
        >
          Сессия #{retention.prepSessionNumber}
          {retention.priorRole ? ` · ранее: ${retention.priorRole}` : ''}
          {retention.shortenedDiagnostics ? ' · ускоренная диагностика' : ''}
        </p>
      </div>

      {history.length > 0 ? (
        <div className="space-y-1.5">
          <div
            className={
              isHume
                ? 'hume-label-sm !text-[10px]'
                : 'text-[10px] uppercase tracking-wide text-slate-400'
            }
          >
            Прошлые вакансии
          </div>
          <ul className="space-y-1">
            {history.slice(0, 4).map((item) => (
              <li
                key={item.sessionId}
                className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs"
              >
                <span className={isHume ? 'text-[var(--color-ink)]' : 'text-white/90'}>
                  {item.role ?? 'Роль не указана'}
                </span>
                {item.preparedAt ? (
                  <span className={isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}>
                    {formatPrepDate(item.preparedAt)}
                  </span>
                ) : null}
                {item.prepComplete ? (
                  <span className={isHume ? 'text-[var(--color-slate-plum)]' : 'text-emerald-400/90'}>
                    мок пройден
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {starBank.length > 0 ? (
        <div className="space-y-1.5">
          <div
            className={
              isHume
                ? 'hume-label-sm !text-[10px]'
                : 'text-[10px] uppercase tracking-wide text-slate-400'
            }
          >
            Банк STAR ({starBank.length})
          </div>
          <ul className="space-y-1.5">
            {starBank.slice(0, 3).map((entry) => (
              <li
                key={entry.id}
                className={
                  isHume
                    ? 'rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-2 py-1.5 text-xs text-[var(--color-slate-plum)]'
                    : 'rounded-lg border border-white/5 bg-black/20 px-2 py-1.5 text-xs text-slate-300'
                }
              >
                {entry.role ? (
                  <span
                    className={`mb-0.5 block ${isHume ? 'font-medium text-[var(--color-ink)]' : 'text-amber-200/90'}`}
                  >
                    {entry.role}
                  </span>
                ) : null}
                <span className="leading-relaxed">{starPreview(entry)}</span>
              </li>
            ))}
          </ul>
          <p className={`text-[11px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'}`}>
            Откройте режим STAR — LEO поможет переупаковать историю под текущую вакансию.
          </p>
        </div>
      ) : null}
    </div>
  );
}
