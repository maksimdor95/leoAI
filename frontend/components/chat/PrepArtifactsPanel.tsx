'use client';

import { useMemo, useState } from 'react';
import {
  PREP_PACK_LABELS,
  packModeLabel,
  type PrepArtifact,
  type PrepPackType,
} from '@/lib/prepArtifacts';
import { useHumeTheme } from '@/lib/useHumeTheme';

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
  isHume,
}: {
  artifact: PrepArtifact;
  expanded: boolean;
  onToggle: () => void;
  onOpenInChat?: (artifact: PrepArtifact) => void;
  isHume: boolean;
}) {
  const preview = artifact.content.split('\n').slice(0, 2).join(' ').slice(0, 140);

  return (
    <div
      className={
        isHume
          ? 'overflow-hidden rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-paper)]'
          : 'overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]'
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className={
          isHume
            ? 'w-full cursor-pointer border-0 bg-transparent px-2.5 py-2 text-left outline-none transition-colors hover:bg-[var(--color-bone)] focus-visible:ring-1 focus-visible:ring-[var(--color-iris)]/30'
            : 'w-full cursor-pointer border-0 bg-transparent px-2.5 py-2 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-1 focus-visible:ring-emerald-500/30'
        }
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className={`text-[10px] font-medium ${
                isHume ? 'text-[var(--color-slate-plum)]' : 'text-emerald-300/80'
              }`}
            >
              {PREP_PACK_LABELS[artifact.packType]}
            </div>
            <div
              className={`break-words text-[11px] leading-snug sm:text-xs ${
                isHume ? 'text-[var(--color-ink)]' : 'text-slate-100'
              }`}
            >
              {artifact.title}
            </div>
            <div className={`mt-0.5 text-[10px] ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
              {packModeLabel(artifact.mode)} ·{' '}
              {new Date(artifact.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              })}
            </div>
          </div>
          <span className={`shrink-0 text-xs ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}>
            {expanded ? '▾' : '▸'}
          </span>
        </div>
        {!expanded ? (
          <p
            className={`mt-1 line-clamp-2 text-[10px] leading-snug ${
              isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'
            }`}
          >
            {preview}
          </p>
        ) : null}
      </button>
      {expanded ? (
        <div className={`border-t px-2.5 pb-2.5 ${isHume ? 'border-[var(--color-border-hairline)]' : 'border-white/5'}`}>
          <div
            className={`chat-history-scroll mt-2 max-h-48 overflow-y-auto whitespace-pre-line break-words text-[11px] leading-relaxed sm:text-xs ${
              isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-200'
            }`}
          >
            {artifact.content}
          </div>
          {onOpenInChat ? (
            <button
              type="button"
              onClick={() => onOpenInChat(artifact)}
              className={
                isHume
                  ? 'mt-2 cursor-pointer border-0 bg-transparent p-0 text-[10px] text-[var(--color-iris)] hover:text-[var(--color-ink)]'
                  : 'mt-2 cursor-pointer border-0 bg-transparent p-0 text-[10px] text-amber-300/90 hover:text-amber-200'
              }
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
  const isHume = useHumeTheme();
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
        className={
          isHume
            ? 'prep-panel--hume rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-2.5 py-3 shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
            : 'rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-3'
        }
      >
        <h3
          className={`mb-1 text-[10px] font-semibold sm:text-xs ${
            isHume ? 'text-[var(--color-ink)]' : 'text-white'
          }`}
        >
          Артефакты
        </h3>
        <p
          className={`text-[10px] leading-snug sm:text-xs ${
            isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'
          }`}
        >
          Здесь появятся шпаргалки, карта пробелов, STAR и итог мока — по мере прохождения режимов.
        </p>
      </div>
    );
  }

  const filterChipClass = (active: boolean) =>
    isHume
      ? active
        ? 'rounded-full border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-2 py-0.5 text-[9px] text-[var(--color-ink)]'
        : 'rounded-full border-0 bg-transparent px-2 py-0.5 text-[9px] text-[var(--color-smoke)] hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]'
      : active
        ? 'rounded-full border-0 bg-white/15 px-2 py-0.5 text-[9px] text-white'
        : 'rounded-full border-0 bg-transparent px-2 py-0.5 text-[9px] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300';

  return (
    <div
      className={
        isHume
          ? 'prep-panel--hume rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-2.5 py-2.5 shadow-[0_1px_3px_rgba(34,34,34,0.06)] sm:px-3 sm:py-3'
          : 'rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-2.5 py-2.5 sm:px-3 sm:py-3'
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3
          className={`text-[10px] font-semibold sm:text-xs ${
            isHume ? 'text-[var(--color-ink)]' : 'text-emerald-100'
          }`}
        >
          Артефакты · {artifacts.length}
        </h3>
        {packTypes.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`cursor-pointer outline-none ${filterChipClass(filter === 'all')}`}
            >
              Все
            </button>
            {packTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`cursor-pointer outline-none ${filterChipClass(filter === type)}`}
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
            isHume={isHume}
          />
        ))}
      </div>
    </div>
  );
}
