'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HeartFilled, HeartOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { formatJobSourceLabel } from '@/lib/jobSourceLabel';
import { humanizeMatchReasons } from '@/lib/humanizeMatchReasons';
import { useHumeTheme } from '@/lib/useHumeTheme';

const SWIPE_THRESHOLD_PX = 56;

type MatchedJobCardProps = {
  title: string;
  company: string;
  score: number;
  source?: string;
  sourceUrl?: string;
  reasons?: string[];
  isNew?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteAriaLabel?: string;
  variant?: 'recommended' | 'weak';
  onOpenVacancy?: () => void;
  onVacancyPrep?: () => void;
  vacancyPrepLoading?: boolean;
  /** Вправо = подходит (лайк). */
  onSwipeLike?: () => void;
  /** Влево = не подходит (dismiss). */
  onSwipeDislike?: () => void;
  likeAriaLabel?: string;
  dislikeAriaLabel?: string;
  /** Подсказка, что карточку можно нажать. */
  tapHint?: string;
};

export function MatchedJobCard({
  title,
  company,
  score,
  source,
  reasons,
  isNew,
  isFavorite = false,
  onToggleFavorite,
  favoriteAriaLabel = 'Добавить в избранное',
  variant = 'recommended',
  onOpenVacancy,
  onVacancyPrep,
  vacancyPrepLoading = false,
  onSwipeLike,
  onSwipeDislike,
  likeAriaLabel = 'Подходит',
  dislikeAriaLabel = 'Не подходит',
  tapHint = 'Нажмите на карточку, чтобы оценить',
}: MatchedJobCardProps) {
  const isHume = useHumeTheme();
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [feedbackActive, setFeedbackActive] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isWeak = variant === 'weak';
  const humanized = humanizeMatchReasons(reasons);
  const hasReasons = humanized.length > 0;
  const sourceLabel = formatJobSourceLabel(source);
  const swipeEnabled = Boolean(onSwipeLike || onSwipeDislike);

  const linkClass = isHume
    ? 'text-[var(--color-ink)] underline-offset-2 hover:underline'
    : 'text-green-400 hover:text-green-300';

  const toggleReasons = () => setReasonsOpen((open) => !open);

  const actionBtnClass = isHume
    ? `hume-btn-ghost !px-0 !py-0 !text-xs`
    : `cursor-pointer text-xs font-medium ${linkClass} bg-transparent border-0 p-0`;

  const finishLike = useCallback(() => {
    setExiting('right');
    window.setTimeout(() => {
      onSwipeLike?.();
      setExiting(null);
      setDragX(0);
      setFeedbackActive(false);
    }, 180);
  }, [onSwipeLike]);

  const finishDislike = useCallback(() => {
    setExiting('left');
    window.setTimeout(() => {
      onSwipeDislike?.();
      setExiting(null);
      setDragX(0);
      setFeedbackActive(false);
    }, 180);
  }, [onSwipeDislike]);

  useEffect(() => {
    if (!feedbackActive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFeedbackActive(false);
        setDragX(0);
      }
    };
    const onPointerDownOutside = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setFeedbackActive(false);
        setDragX(0);
      }
    };
    window.addEventListener('keydown', onKey);
    // Откладываем, чтобы тот же клик, что открыл стрелки, сразу их не закрыл.
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDownOutside);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDownOutside);
    };
  }, [feedbackActive]);

  const onPointerDownCard = (event: React.PointerEvent) => {
    if (!swipeEnabled || exiting) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    dragging.current = false;
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMoveCard = (event: React.PointerEvent) => {
    if (!pointerStart.current || !swipeEnabled || exiting) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (!dragging.current && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      dragging.current = true;
      setFeedbackActive(true);
    }
    if (dragging.current) {
      setDragX(Math.max(-120, Math.min(120, dx)));
    }
  };

  const onPointerUpCard = (event: React.PointerEvent) => {
    if (!swipeEnabled) return;
    const wasDragging = dragging.current;
    const start = pointerStart.current;
    pointerStart.current = null;
    dragging.current = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    if (wasDragging) {
      if (dragX >= SWIPE_THRESHOLD_PX) {
        finishLike();
        return;
      }
      if (dragX <= -SWIPE_THRESHOLD_PX) {
        finishDislike();
        return;
      }
      setDragX(0);
      return;
    }

    // Tap / click on card body → toggle arrows
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) {
      setFeedbackActive((v) => !v);
    }
  };

  const translateX =
    exiting === 'left' ? -280 : exiting === 'right' ? 280 : dragX;
  const opacity = exiting ? 0 : 1 - Math.min(0.35, Math.abs(dragX) / 280);

  const swipeHint =
    dragX >= SWIPE_THRESHOLD_PX || exiting === 'right'
      ? 'like'
      : dragX <= -SWIPE_THRESHOLD_PX || exiting === 'left'
        ? 'dislike'
        : dragX > 12
          ? 'like-soft'
          : dragX < -12
            ? 'dislike-soft'
            : null;

  const dislikeArrowClass = isHume
    ? 'flex h-7 w-7 items-center justify-center border-0 bg-transparent p-0 text-rose-500 shadow-none outline-none transition hover:text-rose-600'
    : 'flex h-7 w-7 items-center justify-center border-0 bg-transparent p-0 text-rose-400/90 shadow-none outline-none transition hover:text-rose-300';

  const likeArrowClass = isHume
    ? 'flex h-7 w-7 items-center justify-center border-0 bg-transparent p-0 text-emerald-600 shadow-none outline-none transition hover:text-emerald-700'
    : 'flex h-7 w-7 items-center justify-center border-0 bg-transparent p-0 text-emerald-400/90 shadow-none outline-none transition hover:text-emerald-300';

  const cardSurfaceClass = isHume
    ? `rounded-2xl border p-3 transition-[border-color,box-shadow,transform] ${
        isNew
          ? 'border-[rgba(192,148,228,0.4)] bg-[var(--color-rose-mist)] shadow-[0_1px_2px_rgba(34,34,34,0.05),0_4px_14px_rgba(120,80,160,0.1)]'
          : 'border-[rgba(34,34,34,0.1)] bg-[var(--color-paper)] shadow-[0_1px_2px_rgba(34,34,34,0.06),0_4px_14px_rgba(34,34,34,0.08)]'
      }${
        swipeEnabled
          ? ' hover:border-[rgba(34,34,34,0.18)] hover:shadow-[0_2px_4px_rgba(34,34,34,0.07),0_8px_22px_rgba(34,34,34,0.12)] active:scale-[0.985]'
          : ''
      }`
    : `rounded-xl border p-3 transition-[border-color,box-shadow,transform,background-color] ${
        isNew
          ? 'border-emerald-400/55 ring-1 ring-emerald-400/25 bg-white/[0.03] shadow-[0_0_20px_rgba(52,211,153,0.12)]'
          : isWeak
            ? 'border-white/[0.1] bg-white/[0.02]'
            : 'border-white/[0.12] bg-white/[0.03]'
      }${
        swipeEnabled
          ? ' hover:border-white/25 hover:bg-white/[0.05] active:scale-[0.985] active:bg-white/[0.06]'
          : ''
      }`;

  const swipeBorderClass =
    swipeHint === 'like' || swipeHint === 'like-soft'
      ? isHume
        ? ' !border-emerald-500/70'
        : ' !border-emerald-400/70 ring-1 ring-emerald-400/25'
      : swipeHint === 'dislike' || swipeHint === 'dislike-soft'
        ? isHume
          ? ' !border-rose-500/70'
          : ' !border-rose-400/70 ring-1 ring-rose-400/25'
        : '';

  return (
    <div
      ref={cardRef}
      role="group"
      aria-label={
        swipeEnabled ? `${title}, ${company}. ${tapHint}` : `${title}, ${company}`
      }
      onPointerDown={onPointerDownCard}
      onPointerMove={onPointerMoveCard}
      onPointerUp={onPointerUpCard}
      onPointerCancel={() => {
        pointerStart.current = null;
        dragging.current = false;
        setDragX(0);
      }}
      style={{
        transform: `translateX(${translateX}px)`,
        opacity,
        transition: dragging.current ? 'none' : 'transform 180ms ease, opacity 180ms ease',
        touchAction: swipeEnabled ? 'pan-y' : undefined,
      }}
      className={`matched-job-card-wrap relative px-px${swipeEnabled ? ' cursor-pointer' : ''}`}
    >
      {swipeEnabled && feedbackActive ? (
        <>
          <button
            type="button"
            aria-label={dislikeAriaLabel}
            onClick={(event) => {
              event.stopPropagation();
              finishDislike();
            }}
            className={`absolute left-0.5 top-1/2 z-10 -translate-y-1/2 ${dislikeArrowClass}${
              swipeHint === 'dislike' || swipeHint === 'dislike-soft' ? ' scale-110' : ''
            }`}
          >
            <LeftOutlined className="text-base" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={likeAriaLabel}
            onClick={(event) => {
              event.stopPropagation();
              finishLike();
            }}
            className={`absolute right-0.5 top-1/2 z-10 -translate-y-1/2 ${likeArrowClass}${
              swipeHint === 'like' || swipeHint === 'like-soft' ? ' scale-110' : ''
            }`}
          >
            <RightOutlined className="text-base" aria-hidden />
          </button>
        </>
      ) : null}

      <div
        className={`matched-job-card relative z-[1] ${
          isWeak ? 'matched-job-card--weak' : 'matched-job-card--recommended'
        }${isNew ? ' matched-job-card--new' : ''}${
          isFavorite ? ' matched-job-card--favorite' : ''
        }${feedbackActive ? ' matched-job-card--feedback' : ''} ${
          feedbackActive && swipeEnabled ? 'mx-9 ' : ''
        }${cardSurfaceClass}${swipeBorderClass}`}
      >
      {onToggleFavorite ? (
        <button
          type="button"
          aria-label={favoriteAriaLabel}
          aria-pressed={isFavorite}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          className={
            isHume
              ? `absolute right-2 top-2 z-[11] flex h-7 w-7 items-center justify-center border-0 !bg-transparent p-0 shadow-none outline-none transition-colors ${
                  isFavorite
                    ? 'text-[var(--color-iris)] hover:text-[var(--color-ink)]'
                    : 'text-[var(--color-smoke)] hover:text-[var(--color-iris)]'
                }`
              : `absolute right-1.5 top-1.5 z-[11] flex h-7 w-7 items-center justify-center border-0 !bg-transparent p-0 shadow-none outline-none transition-colors ${
                  isFavorite
                    ? 'text-rose-400 hover:text-rose-300'
                    : 'text-slate-500 hover:text-rose-300'
                }`
          }
        >
          {isFavorite ? (
            <HeartFilled className="text-sm" aria-hidden />
          ) : (
            <HeartOutlined className="text-sm" aria-hidden />
          )}
        </button>
      ) : null}

      <div
        className={`flex items-start justify-between gap-2 ${onToggleFavorite ? 'pr-8' : ''}`}
      >
        <div
          className={
            isHume
              ? 'text-sm font-medium text-[var(--color-ink)] leading-snug'
              : 'text-sm font-semibold text-white leading-snug'
          }
        >
          {title}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {isNew ? (
            <span
              className={
                isHume
                  ? 'hume-chip !text-[10px] !bg-[var(--color-mint)] !border-transparent'
                  : 'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-300'
              }
            >
              Новая
            </span>
          ) : null}
          {isWeak ? (
            <span
              className={
                isHume ? 'hume-label-sm !text-[9px]' : 'text-[10px] font-medium text-slate-500'
              }
            >
              слабее
            </span>
          ) : null}
        </div>
      </div>

      <div className={isHume ? 'mt-1 hume-body-sm !text-xs' : 'mt-1 text-xs text-slate-300'}>
        {company}
      </div>

      <div
        className={
          isHume
            ? 'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 hume-body-sm !text-xs'
            : 'mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400'
        }
      >
        <span>
          Match:{' '}
          {hasReasons ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                toggleReasons();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleReasons();
                }
              }}
              aria-expanded={reasonsOpen}
              className={`cursor-pointer font-medium tabular-nums transition-colors hover:underline ${linkClass}`}
            >
              {score}
            </span>
          ) : (
            <span className="tabular-nums">{score}</span>
          )}
        </span>
        {sourceLabel ? (
          <span
            className={
              isHume
                ? 'inline-flex rounded-full border border-[rgba(34,34,34,0.1)] bg-[var(--color-meringue)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-smoke)]'
                : 'inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400'
            }
          >
            {sourceLabel}
          </span>
        ) : null}
      </div>

      {hasReasons && reasonsOpen ? (
        <ul
          className={
            isHume
              ? 'mt-2 space-y-1 rounded-xl border border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)] px-2.5 py-2'
              : 'mt-2 space-y-1 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2'
          }
        >
          {humanized.map((item) => (
            <li key={item.text} className="flex items-start gap-1.5 text-[11px] leading-snug">
              <span
                className={`mt-0.5 shrink-0 ${
                  isHume
                    ? item.tone === 'positive'
                      ? 'text-[var(--color-iris)]'
                      : item.tone === 'negative'
                        ? 'text-rose-500'
                        : 'text-[var(--color-smoke)]'
                    : item.tone === 'positive'
                      ? 'text-emerald-400/90'
                      : item.tone === 'negative'
                        ? 'text-rose-400/80'
                        : 'text-slate-500'
                }`}
                aria-hidden
              >
                {item.tone === 'positive' ? '✓' : item.tone === 'negative' ? '✗' : '·'}
              </span>
              <span
                className={
                  isHume
                    ? 'text-[var(--color-slate-plum)]'
                    : item.tone === 'positive'
                      ? 'text-slate-300'
                      : item.tone === 'negative'
                        ? 'text-rose-300/90'
                        : 'text-slate-500'
                }
              >
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {(onOpenVacancy || onVacancyPrep) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onOpenVacancy ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenVacancy();
              }}
              className={actionBtnClass}
            >
              Открыть вакансию
            </button>
          ) : null}
          {onVacancyPrep ? (
            <button
              type="button"
              disabled={vacancyPrepLoading}
              onClick={
                vacancyPrepLoading
                  ? undefined
                  : (event) => {
                      event.stopPropagation();
                      onVacancyPrep();
                    }
              }
              className={`${actionBtnClass}${vacancyPrepLoading ? ' opacity-50 cursor-not-allowed' : ''}`}
            >
              {vacancyPrepLoading ? 'Готовим разбор…' : 'Разбор вакансии'}
            </button>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}
