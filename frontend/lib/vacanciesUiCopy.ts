import type { AppLocale } from '@/types/appSettings';
import type { VacanciesInsightMeta } from '@/components/chat/VacanciesInsightPanel';

const copy = {
  ru: {
    insightTitle: 'Пока мало прямых совпадений',
    insightLead:
      'LEO уже сопоставил профиль с каталогом — вот что мешает точному подбору:',
    detailedAnalysis: 'Детальный анализ',
    editProfile: 'Редактировать профиль',
    matchedTitle: 'Подобранные вакансии',
    matchedTooltip:
      'Мы сопоставляем ваши ответы из чата с вакансиями в каталоге: учитываем роль, стек, уровень, формат и опыт. Чем больше релевантных деталей в профиле, тем точнее рекомендации.',
    matchedTooltipAria: 'Как формируется подбор вакансий',
    refreshTooltip:
      'Сначала скачиваем свежие вакансии под ваш профиль, затем пересчитываем матч по каталогу. Полный цикл ~20–60 с.',
    refreshAria: 'Обновить каталог и пересчитать матч',
    gateTitle: 'Подбор откроется после базового профиля',
    gateBody:
      'Укажите в чате желаемую роль и опыт (или пройдите ещё несколько вопросов детального пути). Тогда LEO сопоставит профиль с каталогом вакансий и покажет рекомендации.',
    continueInChat: 'Продолжить в чате',
    recommended: 'Рекомендуем',
    weakMatch: 'Слабое совпадение',
    possibleWeakMatch: 'Возможные варианты (слабое совпадение)',
    autoUpdateHint: 'Отвечайте в диалоге — подбор вакансий обновится автоматически.',
    wannanewNoJobs: 'Для продукта wannanew вакансии не подбираются.',
    newBadgeTooltip: 'Появились при последнем пересчёте — на карточках метка «Новая» (~18 с)',
    emptyCatalog:
      'Каталог ещё пустой. Нажмите кнопку обновления ↻, чтобы запустить сбор под ваш профиль.',
  },
  en: {
    insightTitle: 'Few strong matches so far',
    insightLead: 'LEO matched your profile to the catalog — here’s what limits accuracy:',
    detailedAnalysis: 'Detailed analysis',
    editProfile: 'Edit profile',
    matchedTitle: 'Matched jobs',
    matchedTooltip:
      'We match your chat answers to jobs in the catalog: role, stack, level, format, and experience. The more relevant details in your profile, the better the recommendations.',
    matchedTooltipAria: 'How job matching works',
    refreshTooltip:
      'We fetch fresh jobs for your profile, then recalculate matches. Full cycle ~20–60 s.',
    refreshAria: 'Refresh catalog and recalculate matches',
    gateTitle: 'Matching unlocks after a basic profile',
    gateBody:
      'Share your target role and experience in chat (or answer a few more detailed-path questions). Then LEO will match your profile to the job catalog and show recommendations.',
    continueInChat: 'Continue in chat',
    recommended: 'Recommended',
    weakMatch: 'Weak match',
    possibleWeakMatch: 'Possible options (weak match)',
    autoUpdateHint: 'Keep chatting — job matches update automatically.',
    wannanewNoJobs: 'WannaNew does not include job matching.',
    newBadgeTooltip: 'Added in the last refresh — “New” badge on cards (~18 s)',
    emptyCatalog:
      'The catalog is still empty. Click refresh ↻ to start collecting jobs for your profile.',
  },
} as const;

export type VacanciesUiCopyKey = keyof (typeof copy)['ru'];

export function vacanciesUi(locale: AppLocale, key: VacanciesUiCopyKey): string {
  return copy[locale][key];
}

export function buildVacanciesInsightReasons(
  meta: VacanciesInsightMeta,
  locale: AppLocale
): string[] {
  const reasons: string[] = [];

  if (locale === 'en') {
    if (!meta.profileFamilyLabel || meta.profileFamily === 'unknown') {
      reasons.push('Profile direction is unclear — hard to pick relevant roles.');
    }
    if (meta.maxMatchScore < meta.matchThreshold) {
      reasons.push(
        `Best match score is ${meta.maxMatchScore} (need ${meta.matchThreshold}+ for Recommended).`
      );
    }
    if (
      typeof meta.familyRelevanceShare === 'number' &&
      meta.familyRelevanceShare < 0.15 &&
      meta.jobsInDb > 0
    ) {
      reasons.push(
        `Few jobs in your field in the catalog (~${Math.round(meta.familyRelevanceShare * 100)}% relevant).`
      );
    }
    if (meta.weakTierTotal === 0 && meta.jobsInDb > 0) {
      reasons.push('Profile is still too brief — detailed analysis helps matching.');
    }
    if (meta.catalogWarning === 'no_matches' && reasons.length < 3) {
      reasons.push('No direct matches yet — common for niche or non-IT roles.');
    }
    if (reasons.length === 0) {
      reasons.push('Matching ran, but no suitable jobs yet.');
      reasons.push('Deepen your profile or edit fields in the Profile tab.');
    }
    return reasons.slice(0, 3);
  }

  if (!meta.profileFamilyLabel || meta.profileFamily === 'unknown') {
    reasons.push('Направление профиля пока не определено — матчеру сложно отобрать релевантные роли.');
  }
  if (meta.maxMatchScore < meta.matchThreshold) {
    reasons.push(
      `Лучший балл совпадения — ${meta.maxMatchScore} (нужно от ${meta.matchThreshold} для блока «Рекомендуем»).`
    );
  }
  if (
    typeof meta.familyRelevanceShare === 'number' &&
    meta.familyRelevanceShare < 0.15 &&
    meta.jobsInDb > 0
  ) {
    reasons.push(
      `В каталоге мало вакансий вашего направления (около ${Math.round(meta.familyRelevanceShare * 100)}% релевантных).`
    );
  }
  if (meta.weakTierTotal === 0 && meta.jobsInDb > 0) {
    reasons.push('Профиль пока слишком краткий — для точного подбора нужен детальный анализ.');
  }
  if (meta.catalogWarning === 'no_matches' && reasons.length < 3) {
    reasons.push('Прямых совпадений нет — это нормально для нишевых или не-IT ролей.');
  }
  if (reasons.length === 0) {
    reasons.push('Подбор пересчитан, но подходящих вакансий пока нет.');
    reasons.push('Углубите профиль или поправьте данные во вкладке «Профиль».');
  }
  return reasons.slice(0, 3);
}

export function catalogFamilyMismatchWarning(
  locale: AppLocale,
  profileFamilyLabel: string | null | undefined,
  familyRelevanceShare: number | undefined
): string {
  if (locale === 'en') {
    const area = profileFamilyLabel ? ` in “${profileFamilyLabel}”` : '';
    const share =
      typeof familyRelevanceShare === 'number'
        ? ` (only ${Math.round(familyRelevanceShare * 100)}% relevant).`
        : '.';
    return `The current catalog has few jobs${area}${share} Click the refresh ↻ button to fetch fresh listings for your profile.`;
  }
  const area = profileFamilyLabel ? ` из области «${profileFamilyLabel}»` : '';
  const share =
    typeof familyRelevanceShare === 'number'
      ? ` (релевантных только ${Math.round(familyRelevanceShare * 100)}%).`
      : '.';
  return `В текущем каталоге мало вакансий${area}${share} Нажмите кнопку обновления ↻, чтобы скачать свежие объявления именно под ваш профиль.`;
}
