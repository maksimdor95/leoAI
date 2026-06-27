'use client';

import { useMemo, useState } from 'react';
import {
  PREP_PACK_LABELS,
  packModeLabel,
  type PrepArtifact,
  type PrepPackType,
} from '@/lib/prepArtifacts';

type PrepArtifactsPanelProps = {
  artifacts: PrepArtifact[];
  compact?: boolean;
  onOpenInChat?: (artifact: PrepArtifact) => void;
};

function ArtifactCard({
  artifact,
  expanded,
  onToggle,
  onOpenInChat,
}: {
  artifact: PrepArtifact;
  expanded: boolean;
  onToggle: () => void;
  onOpenInChat?: (artifact: PrepArtifact) => void;
}) {
  const preview = artifact.content.split('\n').slice(0, 2).join(' ').slice(0, 140);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-2.5 py-2 border-0 bg-transparent hover:bg-white/[0.05] transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-emerald-300/80 font-medium">
              {PREP_PACK_LABELS[artifact.packType]}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-100 leading-snug break-words">
              {artifact.title}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {packModeLabel(artifact.mode)} ·{' '}
              {new Date(artifact.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              })}
            </div>
          </div>
          <span className="text-slate-500 text-xs shrink-0">{expanded ? '▾' : '▸'}</span>
        </div>
        {!expanded ? (
          <p className="mt-1 text-[10px] text-slate-400 line-clamp-2 leading-snug">{preview}</p>
        ) : null}
      </button>
      {expanded ? (
        <div className="px-2.5 pb-2.5 border-t border-white/5">
          <div className="mt-2 text-[11px] sm:text-xs text-slate-200 whitespace-pre-line leading-relaxed break-words max-h-48 overflow-y-auto chat-history-scroll">
            {artifact.content}
          </div>
          {onOpenInChat ? (
            <button
              type="button"
              onClick={() => onOpenInChat(artifact)}
              className="mt-2 border-0 bg-transparent p-0 text-[10px] text-amber-300/90 hover:text-amber-200 cursor-pointer"
            >
              Открыть в чате →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PrepArtifactsPanel({ artifacts, compact, onOpenInChat }: PrepArtifactsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PrepPackType | 'all'>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return artifacts;
    return artifacts.filter((a) => a.packType === filter);
  }, [artifacts, filter]);

  const packTypes = useMemo(() => {
    const types = new Set(artifacts.map((a) => a.packType));
    return Array.from(types) as PrepPackType[];
  }, [artifacts]);

  if (artifacts.length === 0) {
    return (
      <div
        className={`rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-3 ${
          compact ? '' : ''
        }`}
      >
        <h3 className="text-[10px] sm:text-xs font-semibold text-white mb-1">Артефакты</h3>
        <p className="text-[10px] sm:text-xs text-slate-500 leading-snug">
          Здесь появятся шпаргалки, карта пробелов, STAR и итог мока — по мере прохождения режимов.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-2.5 sm:px-3 py-2.5 sm:py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-[10px] sm:text-xs font-semibold text-emerald-100">
          Артефакты · {artifacts.length}
        </h3>
        {packTypes.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-full border-0 px-2 py-0.5 text-[9px] cursor-pointer outline-none ${
                filter === 'all'
                  ? 'bg-white/15 text-white'
                  : 'bg-transparent text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
            >
              Все
            </button>
            {packTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`rounded-full border-0 px-2 py-0.5 text-[9px] cursor-pointer outline-none ${
                  filter === type
                    ? 'bg-white/15 text-white'
                    : 'bg-transparent text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
                }`}
              >
                {PREP_PACK_LABELS[type]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {filtered.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            expanded={expandedId === artifact.id}
            onToggle={() =>
              setExpandedId((prev) => (prev === artifact.id ? null : artifact.id))
            }
            onOpenInChat={onOpenInChat}
          />
        ))}
      </div>
    </div>
  );
}
