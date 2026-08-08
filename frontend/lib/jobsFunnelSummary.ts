import type { AppLocale } from '@/types/appSettings';

/** Метаданные воронки подбора (ответ GET /api/jobs/match). */
export type JobsFunnelMeta = {
  jobsInDb: number;
  jobsScanned: number;
  maxMatchScore: number;
  matchThreshold: number;
  totalMatched: number;
  weakTierTotal: number;
  profileFamilyLabel?: string | null;
  familyCatalogCount?: number;
  matchLayers?: {
    llmRerank?: {
      status?: string;
      authPresent?: boolean;
      reason?: string;
      explainCount?: number;
      durationMs?: number;
    };
  };
};

function formatScannedCount(meta: JobsFunnelMeta, locale: AppLocale): string {
  if (meta.jobsScanned < meta.jobsInDb) {
    return locale === 'en'
      ? `${meta.jobsScanned} of ${meta.jobsInDb}`
      : `${meta.jobsScanned} из ${meta.jobsInDb}`;
  }
  return String(meta.jobsInDb);
}

function formatLlmRerankLine(
  meta: JobsFunnelMeta,
  locale: AppLocale
): string | null {
  const rr = meta.matchLayers?.llmRerank;
  if (!rr?.status) return null;

  if (locale === 'en') {
    switch (rr.status) {
      case 'applied':
        return `AI explain: applied (${rr.explainCount ?? 0} jobs${
          typeof rr.durationMs === 'number' ? `, ${rr.durationMs} ms` : ''
        }).`;
      case 'failed':
        return `AI explain: fail-open (${rr.reason || 'error'}) — rule-based scores kept.`;
      case 'empty':
        return 'AI explain: empty response (fail-open) — rule-based scores kept.';
      case 'disabled':
        return 'AI explain: disabled.';
      case 'skipped':
        return `AI explain: skipped (${rr.reason || 'n/a'}).`;
      default:
        return `AI explain: ${rr.status}.`;
    }
  }

  switch (rr.status) {
    case 'applied':
      return `AI-объяснение: применено (${rr.explainCount ?? 0} вакансий${
        typeof rr.durationMs === 'number' ? `, ${rr.durationMs} мс` : ''
      }).`;
    case 'failed':
      return `AI-объяснение: fail-open (${rr.reason || 'ошибка'}) — оставлены rule-based скоры.`;
    case 'empty':
      return 'AI-объяснение: пустой ответ (fail-open) — оставлены rule-based скоры.';
    case 'disabled':
      return 'AI-объяснение: выключено.';
    case 'skipped':
      return `AI-объяснение: пропущено (${rr.reason || 'н/д'}).`;
    default:
      return `AI-объяснение: ${rr.status}.`;
  }
}

/** Краткий текст для tooltip «как считался подбор». */
export function buildJobsMatchInfoTooltip(
  meta: JobsFunnelMeta,
  locale: AppLocale = 'ru'
): string {
  const scanned = formatScannedCount(meta, locale);
  const llmLine = formatLlmRerankLine(meta, locale);

  if (locale === 'en') {
    return [
      `Compared your profile against ${scanned} jobs in the catalog.`,
      `${meta.totalMatched} in Recommended, ${meta.weakTierTotal} with weak match.`,
      llmLine,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Сверили профиль с ${scanned} вакансиями в каталоге.`,
    `${meta.totalMatched} в «Рекомендуем», ${meta.weakTierTotal} со слабым совпадением.`,
    llmLine,
  ]
    .filter(Boolean)
    .join('\n');
}

export function jobsRefreshStatusLabel(
  state: 'idle' | 'scraping' | 'matching' | 'success' | 'error',
  lastUpdatedAt: string | null,
  locale: AppLocale = 'ru'
): string {
  if (locale === 'en') {
    switch (state) {
      case 'scraping':
        return 'Fetching fresh jobs for your profile…';
      case 'matching':
        return 'Matching profile to catalog…';
      case 'error':
        return 'Update failed — please try again.';
      case 'success':
        return lastUpdatedAt ? `Match updated at ${lastUpdatedAt}` : 'Match updated';
      default:
        return 'Matching has not run yet';
    }
  }

  switch (state) {
    case 'scraping':
      return 'Собираем свежие вакансии под профиль…';
    case 'matching':
      return 'Сопоставляем профиль с каталогом…';
    case 'error':
      return 'Ошибка обновления, попробуйте ещё раз.';
    case 'success':
      return lastUpdatedAt ? `Матч обновлён в ${lastUpdatedAt}` : 'Матч обновлён';
    default:
      return 'Подбор пока не запускался';
  }
}
