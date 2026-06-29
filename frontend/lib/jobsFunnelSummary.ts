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
};

function formatScannedCount(meta: JobsFunnelMeta, locale: AppLocale): string {
  if (meta.jobsScanned < meta.jobsInDb) {
    return locale === 'en'
      ? `${meta.jobsScanned} of ${meta.jobsInDb}`
      : `${meta.jobsScanned} из ${meta.jobsInDb}`;
  }
  return String(meta.jobsInDb);
}

/** Краткий текст для tooltip «как считался подбор». */
export function buildJobsMatchInfoTooltip(
  meta: JobsFunnelMeta,
  locale: AppLocale = 'ru'
): string {
  const scanned = formatScannedCount(meta, locale);

  if (locale === 'en') {
    return [
      `Compared your profile against ${scanned} jobs in the catalog.`,
      `${meta.totalMatched} in Recommended, ${meta.weakTierTotal} with weak match.`,
    ].join('\n');
  }

  return [
    `Сверили профиль с ${scanned} вакансиями в каталоге.`,
    `${meta.totalMatched} в «Рекомендуем», ${meta.weakTierTotal} со слабым совпадением.`,
  ].join('\n');
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
