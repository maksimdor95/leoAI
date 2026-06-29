'use client';

import { Button } from 'antd';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import {
  buildVacanciesInsightReasons,
  vacanciesUi,
} from '@/lib/vacanciesUiCopy';

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
  const isHume = useHumeTheme();
  const { settings } = useAppSettings();
  const locale = settings.locale;
  const v = (key: Parameters<typeof vacanciesUi>[1]) => vacanciesUi(locale, key);
  const reasons = buildVacanciesInsightReasons(meta, locale);

  return (
    <div
      className={
        isHume
          ? 'rounded-2xl border border-[rgba(34,34,34,0.08)] bg-[var(--color-meringue)] p-4 space-y-3'
          : 'rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 space-y-3'
      }
    >
      <div>
        <h3 className={isHume ? 'hume-heading !text-sm' : 'text-sm font-semibold text-amber-100'}>
          {v('insightTitle')}
        </h3>
        <p className={isHume ? 'mt-1 hume-body-sm leading-relaxed' : 'mt-1 text-xs text-slate-400 leading-relaxed'}>
          {v('insightLead')}
        </p>
      </div>
      <ul
        className={
          isHume
            ? 'space-y-1.5 hume-body-sm !text-xs leading-relaxed list-disc pl-4 text-[var(--color-slate-plum)]'
            : 'space-y-1.5 text-xs text-slate-300 leading-relaxed list-disc pl-4'
        }
      >
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="primary"
          size="small"
          onClick={onDetailedAnalysis}
          className={
            isHume
              ? 'hume-btn-pill !h-8 !px-4 !text-xs !border-none'
              : '!rounded-full !border-0 !bg-gradient-to-r !from-green-500 !to-emerald-600 !text-white !text-xs !font-medium'
          }
        >
          {v('detailedAnalysis')}
        </Button>
        <Button
          size="small"
          onClick={onEditProfile}
          className={
            isHume
              ? '!rounded-full !border !border-[rgba(34,34,34,0.08)] !bg-[var(--color-paper)] !text-[var(--color-ink)] !text-xs hover:!bg-[var(--color-bone)]'
              : '!rounded-full !border !border-white/15 !bg-white/[0.05] !text-slate-200 !text-xs'
          }
        >
          {v('editProfile')}
        </Button>
      </div>
    </div>
  );
}
