'use client';

import {
  formatPrepDate,
  resolvePrepRetention,
  resolveStarBank,
  type StarBankEntry,
} from '@/lib/prepRetention';

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
  const retention = resolvePrepRetention(collectedData);
  const starBank = resolveStarBank(collectedData);

  if (!retention) {
    return null;
  }

  const history = retention.prepVacancyHistory ?? [];

  return (
    <div
      className={`rounded-xl border border-amber-500/25 bg-amber-500/5 ${
        compact ? 'p-2.5 space-y-2' : 'p-3 sm:p-4 space-y-3'
      }`}
    >
      <div>
        <div className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-300/90 font-medium">
          Повторная подготовка
        </div>
        <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed">
          Сессия #{retention.prepSessionNumber}
          {retention.priorRole ? ` · ранее: ${retention.priorRole}` : ''}
          {retention.shortenedDiagnostics ? ' · ускоренная диагностика' : ''}
        </p>
      </div>

      {history.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Прошлые вакансии</div>
          <ul className="space-y-1">
            {history.slice(0, 4).map((item) => (
              <li
                key={item.sessionId}
                className="text-xs text-slate-300 flex flex-wrap gap-x-2 gap-y-0.5"
              >
                <span className="text-white/90">{item.role ?? 'Роль не указана'}</span>
                {item.preparedAt ? (
                  <span className="text-slate-500">{formatPrepDate(item.preparedAt)}</span>
                ) : null}
                {item.prepComplete ? (
                  <span className="text-emerald-400/90">мок пройден</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {starBank.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            Банк STAR ({starBank.length})
          </div>
          <ul className="space-y-1.5">
            {starBank.slice(0, 3).map((entry) => (
              <li
                key={entry.id}
                className="text-xs text-slate-300 border border-white/5 rounded-lg px-2 py-1.5 bg-black/20"
              >
                {entry.role ? (
                  <span className="text-amber-200/90 block mb-0.5">{entry.role}</span>
                ) : null}
                <span className="leading-relaxed">{starPreview(entry)}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-400">
            Откройте режим STAR — LEO поможет переупаковать историю под текущую вакансию.
          </p>
        </div>
      ) : null}
    </div>
  );
}
