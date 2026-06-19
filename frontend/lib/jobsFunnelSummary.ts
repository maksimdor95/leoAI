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

/** Краткий текст для tooltip «как считался подбор». */
export function buildJobsMatchInfoTooltip(
  meta: JobsFunnelMeta,
  shownRecommended: number,
  shownWeak: number
): string {
  const scanned =
    meta.jobsScanned < meta.jobsInDb
      ? `последние ${meta.jobsScanned} из ${meta.jobsInDb}`
      : `${meta.jobsInDb}`;

  const parts: string[] = [
    `Сверили профиль с ${scanned} вакансиями в каталоге.`,
    `В списке: ${shownRecommended} в «Рекомендуем» и ${shownWeak} со слабым совпадением.`,
  ];

  const hiddenRec = meta.totalMatched - shownRecommended;
  const hiddenWeak = meta.weakTierTotal - shownWeak;
  if (hiddenRec > 0 || hiddenWeak > 0) {
    const extra: string[] = [];
    if (hiddenRec > 0) extra.push(`ещё ${hiddenRec} рекомендуемых`);
    if (hiddenWeak > 0) extra.push(`ещё ${hiddenWeak} слабых`);
    parts.push(`Не показали: ${extra.join(', ')}.`);
  }

  return parts.join('\n');
}

export function jobsRefreshStatusLabel(
  state: 'idle' | 'scraping' | 'matching' | 'success' | 'error',
  lastUpdatedAt: string | null
): string {
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
