'use client';

import type { PrepPackType } from '@/types/chat';
import { PREP_PACK_LABELS } from '@/lib/prepArtifacts';

const PACK_ACCENT: Partial<Record<PrepPackType, string>> = {
  diagnostics_map: 'border-sky-500/30 bg-sky-500/[0.06]',
  theory_cheatsheet: 'border-violet-500/25 bg-violet-500/[0.05]',
  rescue_cheatsheet: 'border-amber-500/30 bg-amber-500/[0.06]',
  star_pack: 'border-green-500/25 bg-green-500/[0.05]',
  case_structure: 'border-emerald-500/25 bg-emerald-500/[0.05]',
  mock_summary: 'border-green-500/30 bg-green-500/[0.07]',
  prep_complete: 'border-green-500/35 bg-green-500/[0.08]',
};

type PrepPackStageCardProps = {
  packType: PrepPackType;
  modeLabel: string;
  content: string;
};

export function PrepPackStageCard({ packType, modeLabel, content }: PrepPackStageCardProps) {
  const accent = PACK_ACCENT[packType] ?? 'border-white/15 bg-white/[0.04]';

  return (
    <div className={`rounded-xl border px-3 sm:px-4 py-3 sm:py-4 ${accent}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/80 font-medium">
          Pack
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
          {PREP_PACK_LABELS[packType]}
        </span>
        <span className="text-[10px] text-slate-500">{modeLabel}</span>
      </div>
      <div className="text-sm sm:text-base text-slate-100 leading-relaxed whitespace-pre-line break-words">
        {content}
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        Сохранено в «Артефакты» во вкладке Подготовка.
      </p>
    </div>
  );
}
