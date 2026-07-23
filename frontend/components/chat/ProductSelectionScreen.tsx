'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightOutlined, BulbOutlined, SearchOutlined } from '@ant-design/icons';
import { VoiceIndicator } from '@/components/chat/VoiceIndicator';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { captureEvent } from '@/lib/analytics';
import {
  getProductScenarios,
  productSelectionUi,
  type ProductScenarioCopy,
} from '@/lib/productSelectionCopy';

export type ProductType = 'jack' | 'wannanew' | 'interview-prep';

interface ProductSelectionScreenProps {
  onSelect: (product: ProductType, starterMessage?: string) => void;
}

type ProductAccent = 'green' | 'amber';

type ProductScenario = ProductScenarioCopy & {
  accent: ProductAccent;
  icon: React.ReactNode;
};

const GREETING_GRADIENT_WORD = 'LEO';

function renderHumeGreeting(greetingText: string, typed: string, complete: boolean) {
  if (!complete) {
    return <span className="hume-display">{typed}</span>;
  }
  const parts = greetingText.split(new RegExp(`(${GREETING_GRADIENT_WORD})`));
  return (
    <span className="hume-display">
      {parts.map((part, index) =>
        part === GREETING_GRADIENT_WORD ? (
          <span key={index} className="hume-gradient-text">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}

const PARTICLE_POSITIONS = [
  { left: '8%', top: '18%', delay: '0s', duration: '3.4s' },
  { left: '82%', top: '12%', delay: '0.6s', duration: '4.1s' },
  { left: '28%', top: '62%', delay: '1.1s', duration: '3.8s' },
  { left: '72%', top: '48%', delay: '0.3s', duration: '4.4s' },
  { left: '18%', top: '78%', delay: '0.9s', duration: '3.6s' },
  { left: '90%', top: '68%', delay: '1.4s', duration: '4s' },
  { left: '52%', top: '28%', delay: '0.2s', duration: '3.2s' },
  { left: '44%', top: '88%', delay: '1s', duration: '4.2s' },
];

const PRODUCT_META: Record<
  ProductType,
  { accent: ProductAccent; icon: React.ReactNode }
> = {
  jack: { accent: 'green', icon: <SearchOutlined /> },
  'interview-prep': { accent: 'amber', icon: <BulbOutlined /> },
  wannanew: { accent: 'amber', icon: <BulbOutlined /> },
};

function buildProductScenarios(locale: 'ru' | 'en'): ProductScenario[] {
  return getProductScenarios(locale).map((scenario) => ({
    ...scenario,
    ...PRODUCT_META[scenario.product],
  }));
}

const ACCENT_STYLES: Record<
  ProductAccent,
  {
    orb: string;
    icon: string;
    border: string;
    borderActive: string;
    glow: string;
    shadow: string;
    chip: string;
    previewBadge: string;
  }
> = {
  green: {
    orb: 'bg-green-500/20',
    icon: 'border-green-500/35 bg-gradient-to-br from-green-500/25 to-green-600/15 text-green-300 group-hover:from-green-500/35 group-hover:to-green-600/25',
    border: 'border-white/10 hover:border-green-500/35',
    borderActive: 'border-green-400/55 shadow-[0_16px_40px_-24px_rgba(34,197,94,0.45)]',
    glow: 'from-green-500/10',
    shadow: 'shadow-green-500/15',
    chip: 'border-green-500/25 bg-green-500/10 text-green-200/90',
    previewBadge: 'border-green-400/25 bg-green-400/10 text-green-200',
  },
  amber: {
    orb: 'bg-amber-500/20',
    icon: 'border-amber-500/35 bg-gradient-to-br from-amber-500/25 to-amber-600/15 text-amber-200 group-hover:from-amber-500/35 group-hover:to-amber-600/25',
    border: 'border-white/10 hover:border-amber-500/35',
    borderActive: 'border-amber-400/55 shadow-[0_16px_40px_-24px_rgba(245,158,11,0.4)]',
    glow: 'from-amber-500/10',
    shadow: 'shadow-amber-500/15',
    chip: 'border-amber-500/25 bg-amber-500/10 text-amber-100/90',
    previewBadge: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
  },
};

const HUME_ACCENT_STYLES: Record<
  ProductAccent,
  {
    orb: string;
    icon: string;
    border: string;
    borderActive: string;
    glow: string;
    chip: string;
    previewBadge: string;
    cardActive: string;
  }
> = {
  green: {
    orb: 'bg-[#daf7ee]/70',
    icon: 'border-[rgba(34,34,34,0.08)] bg-[#daf7ee] text-[#222222]',
    border: 'border-[rgba(34,34,34,0.08)] hover:border-[rgba(34,34,34,0.14)]',
    borderActive: 'border-[rgba(34,34,34,0.14)]',
    glow: 'from-[#daf7ee]/80',
    chip: 'border-[rgba(34,34,34,0.08)] bg-[#fff9f3] text-[#574853]',
    previewBadge: 'border-[rgba(34,34,34,0.08)] bg-[#daf7ee] text-[#222222]',
    cardActive: 'bg-[#f7fcfa]',
  },
  amber: {
    orb: 'bg-[#ffe9cf]/75',
    icon: 'border-[rgba(34,34,34,0.08)] bg-[#ffe9cf] text-[#222222]',
    border: 'border-[rgba(34,34,34,0.08)] hover:border-[rgba(34,34,34,0.14)]',
    borderActive: 'border-[rgba(34,34,34,0.14)]',
    glow: 'from-[#ffe9cf]/80',
    chip: 'border-[rgba(34,34,34,0.08)] bg-[#fff9f3] text-[#574853]',
    previewBadge: 'border-[rgba(34,34,34,0.08)] bg-[#ffe9cf] text-[#222222]',
    cardActive: 'bg-[#fffbf5]',
  },
};

function useCanHover() {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return canHover;
}

function useTypingText(text: string, speedMs = 30, startDelayMs = 450) {
  const [displayed, setDisplayed] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayed(text);
      setIsComplete(true);
      return;
    }

    setDisplayed('');
    setIsComplete(false);

    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      let index = 0;
      interval = setInterval(() => {
        index += 1;
        setDisplayed(text.slice(0, index));
        if (index >= text.length) {
          if (interval) clearInterval(interval);
          setIsComplete(true);
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speedMs, startDelayMs, reducedMotion]);

  return { displayed, isComplete };
}

function CinematicBackground({ accent, isHume }: { accent: ProductAccent; isHume: boolean }) {
  const styles = isHume ? HUME_ACCENT_STYLES[accent] : ACCENT_STYLES[accent];

  if (isHume) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className={`absolute -left-20 top-8 h-56 w-56 rounded-full blur-3xl ${styles.orb}`}
        />
        <div
          className={`absolute -right-12 bottom-4 h-64 w-64 rounded-full blur-3xl ${styles.orb}`}
        />
        <div className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-[#fce0ee]/40 blur-3xl" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={`absolute -left-24 top-0 h-64 w-64 rounded-full blur-3xl animate-cinematic-glow ${styles.orb}`}
      />
      <div
        className={`absolute -right-16 bottom-0 h-72 w-72 rounded-full blur-3xl animate-cinematic-glow ${styles.orb}`}
        style={{ animationDelay: '2s' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050913]/20 to-[#050913]/80" />
      {PARTICLE_POSITIONS.map((pos, index) => (
        <div
          key={index}
          className="absolute h-1 w-1 rounded-full bg-green-500/25 animate-float"
          style={{
            left: pos.left,
            top: pos.top,
            animationDelay: pos.delay,
            animationDuration: pos.duration,
          }}
        />
      ))}
    </div>
  );
}

function ScenarioPreviewPanel({
  scenario,
  previewKey,
  isHume,
  previewTitle,
  previewBadge,
}: {
  scenario: ProductScenario;
  previewKey: number;
  isHume: boolean;
  previewTitle: string;
  previewBadge: string;
}) {
  const styles = isHume ? HUME_ACCENT_STYLES[scenario.accent] : ACCENT_STYLES[scenario.accent];

  return (
    <div
      className={`flex min-h-[240px] flex-col p-4 sm:p-5 lg:h-auto lg:min-h-0 lg:p-4 ${
        isHume
          ? 'hume-preview-panel hume-card'
          : 'rounded-2xl border border-white/10 bg-[#030712]/85 backdrop-blur-xl sm:rounded-3xl'
      }`}
    >
      <div
        className={`mb-4 flex shrink-0 items-center justify-between border-b pb-3 ${
          isHume ? 'border-[var(--color-border-hairline)]' : 'border-white/10'
        }`}
      >
        <div className="min-w-0 pr-2">
          <div className={isHume ? 'hume-heading text-sm' : 'text-sm font-semibold text-white'}>
            {previewTitle}
          </div>
          <div className={isHume ? 'hume-body-sm truncate !text-xs' : 'truncate text-xs text-slate-500'}>
            {scenario.title}
          </div>
        </div>
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${
            isHume
              ? 'hume-preview-badge hume-chip border-0 !py-1'
              : `border text-[10px] font-semibold uppercase tracking-wide ${styles.previewBadge}`
          }`}
        >
          {!isHume ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" /> : null}
          {previewBadge}
        </div>
      </div>

      <div className="mb-4 shrink-0 lg:hidden">
        <p className={isHume ? 'hume-body-sm' : 'text-xs leading-relaxed text-slate-400 sm:text-sm'}>
          {scenario.spotlight}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {scenario.metrics.map((metric) => (
            <span
              key={metric}
              className={
                              isHume ? 'hume-chip !text-[10px] !normal-case !tracking-normal' : `rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles.chip}`
                            }
            >
              {metric}
            </span>
          ))}
        </div>
      </div>

      <div key={previewKey} className="flex flex-col gap-3">
        {scenario.messages.map((message, index) => (
          <div
            key={`${previewKey}-${index}`}
            className={`flex animate-scenario-preview-in ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words [overflow-wrap:anywhere] sm:px-4 sm:py-3 ${
                message.role === 'user'
                  ? isHume
                    ? 'hume-user-bubble'
                    : 'bg-green-500 text-white shadow-lg shadow-green-950/25'
                  : isHume
                    ? 'hume-assistant-bubble border border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)] text-[var(--color-ink)]'
                    : 'border border-white/10 bg-white/[0.05] text-slate-100'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div
        className={`mt-4 flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2.5 ${
          isHume
            ? 'border-[rgba(34,34,34,0.08)] bg-[#fff9f3]'
            : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <div
          className={`min-w-0 flex-1 text-xs sm:text-sm ${
            isHume ? 'text-[#7a7876]' : 'text-slate-500'
          }`}
        >
          <span className="lg:hidden">Нажмите стрелку на карточке, чтобы начать</span>
          <span className="hidden lg:inline">
            Нажмите стрелку на карточке слева, чтобы начать диалог
          </span>
        </div>
        {isHume ? (
          <div className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-[#c094e4]/80" />
            <span className="h-2 w-2 rounded-full bg-[#f7bbe6]/80" />
            <span className="h-2 w-2 rounded-full bg-[#ffb760]/80" />
          </div>
        ) : (
          <div className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-red-400/70" />
            <span className="h-2 w-2 rounded-full bg-amber-300/70" />
            <span className="h-2 w-2 rounded-full bg-green-400/80" />
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductSelectionScreen({ onSelect }: ProductSelectionScreenProps) {
  const canHover = useCanHover();
  const { settings } = useAppSettings();
  const isHume = settings.theme === 'hume-light';
  const ps = productSelectionUi(settings.locale);
  const productScenarios = buildProductScenarios(settings.locale);
  const [activeProduct, setActiveProduct] = useState<ProductType>('jack');
  const [previewKey, setPreviewKey] = useState(0);
  const ttsBeatAtRef = useRef(0);
  const assistantLevelRef = useRef(0);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const activeScenario =
    productScenarios.find((scenario) => scenario.product === activeProduct) ?? productScenarios[0];

  const { displayed: typedGreeting, isComplete: greetingComplete } = useTypingText(ps.greeting);

  useEffect(() => {
    setPreviewKey((key) => key + 1);
  }, [settings.locale]);

  useEffect(() => {
    captureEvent('chat_product_selection_viewed', { locale: settings.locale });
  }, [settings.locale]);

  const activateScenario = useCallback(
    (product: ProductType) => {
      setActiveProduct((current) => {
        if (current !== product) {
          setPreviewKey((key) => key + 1);
        }
        return product;
      });

      if (!canHover) {
        requestAnimationFrame(() => {
          previewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    },
    [canHover],
  );

  return (
    <div
      className={`leo-product-selection relative flex w-full flex-col px-3 py-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-5 lg:h-full lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-4 lg:pb-4 ${
        isHume ? 'leo-product-selection--hume' : ''
      }`}
    >
      <CinematicBackground accent={activeScenario.accent} isHume={isHume} />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-5 lg:h-full lg:min-h-0 lg:flex-1 lg:gap-3 lg:overflow-hidden">
        {/* Hero */}
        <div className="flex shrink-0 flex-col items-center gap-3 text-center sm:gap-4 lg:gap-2">
          <div
            className={`animate-fadeIn inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 lg:hidden ${
              isHume
                ? 'hume-label hume-chip border-0 bg-[var(--color-bone)]'
                : 'border border-white/10 bg-white/[0.04] text-[10px] font-semibold uppercase tracking-[0.28em] text-green-200/90 backdrop-blur sm:text-[11px]'
            }`}
            style={{ animationDelay: '0.05s' }}
          >
            {!isHume ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-400 shadow-[0_0_16px_rgba(34,197,94,0.85)]" />
            ) : (
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-iris)]" aria-hidden />
            )}
            {ps.badge}
          </div>

          <div className="w-full max-w-[40rem] space-y-2 sm:space-y-3 lg:space-y-1">
            <h1
              className={
                isHume
                  ? 'min-h-[2.5rem] sm:min-h-[2.75rem] lg:min-h-0'
                  : 'min-h-[2.5rem] text-xl font-bold leading-tight sm:min-h-[3rem] sm:text-3xl lg:text-4xl'
              }
              aria-label={ps.greeting}
            >
              {isHume ? (
                <>
                  {renderHumeGreeting(ps.greeting, typedGreeting, greetingComplete)}
                  {!greetingComplete && (
                    <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-[var(--color-iris)] align-[-0.1em]" />
                  )}
                </>
              ) : (
                <>
                  <span
                    className={
                      greetingComplete
                        ? 'animate-gradient-text bg-clip-text text-transparent'
                        : 'text-white'
                    }
                  >
                    {typedGreeting}
                  </span>
                  {!greetingComplete && (
                    <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-green-400 align-[-0.1em]" />
                  )}
                </>
              )}
            </h1>
            <p
              className={`animate-fadeIn max-w-[640px] mx-auto ${
                isHume
                  ? 'hume-body text-sm sm:text-base lg:text-[15px] lg:leading-snug'
                  : 'text-sm text-slate-300 sm:text-lg'
              }`}
              style={{ animationDelay: '0.25s' }}
            >
              {canHover ? (
                <>
                  <span className="lg:hidden">{ps.subtitleHoverMobile}</span>
                  <span className="hidden lg:inline">{ps.subtitleHoverDesktop}</span>
                </>
              ) : (
                ps.subtitleTouch
              )}
            </p>
          </div>
        </div>

        {/* Wave — на всю ширину сетки карточек + превью */}
        <div
          className="leo-product-wave-row animate-fadeIn w-full shrink-0"
          style={{ animationDelay: '0.35s' }}
        >
          <VoiceIndicator
            isActive={false}
            isMuted
            mode="idle"
            ttsBeatAtRef={ttsBeatAtRef}
            assistantLevelRef={assistantLevelRef}
            waveOnly
            waveHeroBanner
          />
        </div>

        {/* Split: cards + preview */}
        <div className="grid min-h-0 grid-cols-1 gap-4 sm:gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start lg:gap-5 lg:overflow-hidden">
          <div className="flex min-h-0 flex-col gap-3 py-0.5 sm:gap-4 lg:gap-3 lg:overflow-y-auto lg:overscroll-y-contain lg:pr-0.5">
            {productScenarios.map((scenario, index) => {
              const darkStyles = ACCENT_STYLES[scenario.accent];
              const humeStyles = HUME_ACCENT_STYLES[scenario.accent];
              const isActive = activeProduct === scenario.product;

              return (
                <div
                  key={scenario.product}
                  role="button"
                  tabIndex={0}
                  onClick={() => activateScenario(scenario.product)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      activateScenario(scenario.product);
                    }
                  }}
                  onMouseEnter={canHover ? () => activateScenario(scenario.product) : undefined}
                  onFocus={() => activateScenario(scenario.product)}
                  className={`group relative cursor-pointer overflow-hidden p-5 text-left transition-[background-color,border-color,box-shadow] duration-300 animate-fadeIn focus:outline-none focus-visible:outline-none sm:p-6 lg:p-4 hume-scenario-card ${
                    isHume
                      ? `hume-card ${isActive ? 'hume-card-active' : ''}`
                      : `rounded-2xl border sm:rounded-3xl bg-white/[0.04] backdrop-blur focus-visible:ring-2 focus-visible:ring-green-400/45 ${
                          isActive
                            ? `${darkStyles.borderActive} bg-white/[0.07]`
                            : `${darkStyles.border} hover:bg-white/[0.07] hover:shadow-xl ${darkStyles.shadow}`
                        }`
                  } ${!isHume ? 'rounded-2xl border sm:rounded-3xl' : ''}`}
                  style={{ animationDelay: `${0.45 + index * 0.1}s` }}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${
                      isHume ? humeStyles.glow : darkStyles.glow
                    } to-transparent opacity-0 transition-opacity duration-300 ${
                      isActive ? 'opacity-100' : 'group-hover:opacity-100'
                    }`}
                  />
                  <div className="relative flex items-start gap-3 sm:gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xl transition-all duration-300 sm:h-14 sm:w-14 sm:text-2xl ${
                        isHume ? humeStyles.icon : darkStyles.icon
                      }`}
                    >
                      {scenario.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={
                            isHume ? 'hume-heading text-lg sm:text-xl' : 'text-base font-semibold text-white sm:text-xl'
                          }
                        >
                          {scenario.title}
                        </h3>
                        <button
                          type="button"
                          aria-label={ps.startAria(scenario.title)}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(scenario.product);
                          }}
                          className={`mt-0.5 shrink-0 active:scale-95 ${
                            isActive
                              ? isHume
                                ? 'hume-btn-pill-icon scale-105'
                                : `${darkStyles.previewBadge} mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border sm:h-10 sm:w-10 scale-105`
                              : isHume
                                ? 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)] text-[var(--color-smoke)] transition-opacity hover:text-[var(--color-ink)]'
                                : 'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white sm:h-10 sm:w-10'
                          }`}
                        >
                          <ArrowRightOutlined className="text-sm" />
                        </button>
                      </div>
                      <p className={isHume ? 'mt-1 hume-body-sm' : 'mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm'}>
                        {scenario.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {scenario.metrics.map((metric) => (
                          <span
                            key={metric}
                            className={
                              isHume ? 'hume-chip !text-[10px]' : `rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${darkStyles.chip}`
                            }
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            ref={previewPanelRef}
            className="animate-fadeIn min-h-[240px] lg:min-h-0 lg:self-start"
            style={{ animationDelay: '0.55s' }}
          >
            <ScenarioPreviewPanel
              scenario={activeScenario}
              previewKey={previewKey}
              isHume={isHume}
              previewTitle={ps.previewTitle}
              previewBadge={ps.previewBadge}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
