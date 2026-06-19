'use client';

import { Button } from 'antd';

export type VacanciesInsightMeta = {
  jobsInDb: number;
  maxMatchScore: number;
  matchThreshold: number;
  totalMatched: number;
  weakTierTotal: number;
  weakMatchFloor: number;
  profileFamily?: string | null;
  profileFamilyLabel?: string | null;
  familyRelevanceShare?: number;
  catalogWarning?: 'catalog_family_mismatch' | 'no_matches' | 'empty_catalog' | null;
};

const WEAK_MATCH_QUALITY_THRESHOLD = 25;

export function shouldShowVacanciesInsight(
  meta: VacanciesInsightMeta | null,
  recommendedCount: number,
  weakCount: number
): boolean {
  if (!meta || recommendedCount > 0) return false;
  if (weakCount === 0) return true;
  return meta.maxMatchScore < WEAK_MATCH_QUALITY_THRESHOLD;
}

export function buildVacanciesInsightReasons(meta: VacanciesInsightMeta): string[] {
  const reasons: string[] = [];

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

type VacanciesInsightPanelProps = {
  meta: VacanciesInsightMeta;
  onDetailedAnalysis: () => void;
  onEditProfile: () => void;
};

export function VacanciesInsightPanel({
  meta,
  onDetailedAnalysis,
  onEditProfile,
}: VacanciesInsightPanelProps) {
  const reasons = buildVacanciesInsightReasons(meta);

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-amber-100">Пока мало прямых совпадений</h3>
        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
          LEO уже сопоставил профиль с каталогом — вот что мешает точному подбору:
        </p>
      </div>
      <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed list-disc pl-4">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="primary"
          size="small"
          onClick={onDetailedAnalysis}
          className="!rounded-full !border-0 !bg-gradient-to-r !from-green-500 !to-emerald-600 !text-white !text-xs !font-medium"
        >
          Детальный анализ
        </Button>
        <Button
          size="small"
          onClick={onEditProfile}
          className="!rounded-full !border !border-white/15 !bg-white/[0.05] !text-slate-200 !text-xs"
        >
          Редактировать профиль
        </Button>
      </div>
    </div>
  );
}
