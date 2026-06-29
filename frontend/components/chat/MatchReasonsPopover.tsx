'use client';

import { DownOutlined } from '@ant-design/icons';
import { Popover } from 'antd';
import { humanizeMatchReasons } from '@/lib/humanizeMatchReasons';
import { useHumeTheme } from '@/lib/useHumeTheme';

type MatchReasonsPopoverProps = {
  score: number;
  reasons?: string[];
  variant?: 'recommended' | 'weak';
  className?: string;
};

function reasonToneClass(
  tone: 'positive' | 'negative' | 'neutral',
  isHume: boolean
): string {
  if (isHume) {
    if (tone === 'positive') return 'text-[var(--color-iris)]';
    if (tone === 'negative') return 'text-rose-500';
    return 'text-[var(--color-smoke)]';
  }
  if (tone === 'positive') return 'text-emerald-400/90';
  if (tone === 'negative') return 'text-rose-400/80';
  return 'text-slate-500';
}

function reasonTextClass(tone: 'positive' | 'negative' | 'neutral', isHume: boolean): string {
  if (isHume) return 'text-[var(--color-slate-plum)]';
  if (tone === 'positive') return 'text-slate-300';
  if (tone === 'negative') return 'text-rose-300/90';
  return 'text-slate-500';
}

export function MatchReasonsPopover({
  score,
  reasons,
  variant = 'recommended',
  className = '',
}: MatchReasonsPopoverProps) {
  const isHume = useHumeTheme();
  const isWeak = variant === 'weak';
  const humanized = humanizeMatchReasons(reasons);
  const accentClass = isHume
    ? isWeak
      ? 'text-[var(--color-meringue)]'
      : 'text-[var(--color-smoke)]'
    : isWeak
      ? 'text-amber-400'
      : 'text-emerald-400';

  if (humanized.length === 0) {
    return (
      <span className={`font-medium tabular-nums ${accentClass} ${className}`.trim()}>
        Match: {score}
      </span>
    );
  }

  const popoverContent = (
    <ul className="min-w-[220px] max-w-[min(320px,calc(100vw-48px))] space-y-1.5 py-0.5">
      {humanized.map((item) => (
        <li key={item.text} className="flex items-start gap-2 text-xs leading-snug">
          <span className={`mt-0.5 shrink-0 ${reasonToneClass(item.tone, isHume)}`} aria-hidden>
            {item.tone === 'positive' ? '✓' : item.tone === 'negative' ? '✗' : '·'}
          </span>
          <span className={reasonTextClass(item.tone, isHume)}>{item.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      title={
        <span className={isHume ? 'vacancy-section-label !mb-0' : 'text-[11px] font-semibold uppercase tracking-wide text-slate-500'}>
          Почему матч
        </span>
      }
      content={popoverContent}
      overlayClassName={isHume ? 'match-reasons-popover match-reasons-popover--hume' : 'match-reasons-popover'}
    >
      <button
        type="button"
        className={`inline-flex items-center gap-1.5 rounded-md border-0 bg-transparent p-0 text-xs transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          isHume ? 'vacancy-muted-text focus-visible:outline-[var(--color-iris)]' : 'text-slate-400 focus-visible:outline-emerald-500/50'
        } ${className}`.trim()}
        aria-label={`Match ${score}, показать почему`}
      >
        <span>Match:</span>
        <span className={`font-medium tabular-nums ${accentClass}`}>{score}</span>
        <DownOutlined
          className={`!text-sm leading-none ${isHume ? '!text-[var(--color-smoke)]' : '!text-slate-400'}`}
          aria-hidden
        />
      </button>
    </Popover>
  );
}
