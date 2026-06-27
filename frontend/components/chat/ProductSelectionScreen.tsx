'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightOutlined, BulbOutlined, SearchOutlined } from '@ant-design/icons';
import { VoiceIndicator } from '@/components/chat/VoiceIndicator';

export type ProductType = 'jack' | 'wannanew' | 'interview-prep';

interface ProductSelectionScreenProps {
  onSelect: (product: ProductType, starterMessage?: string) => void;
}

type ProductAccent = 'green' | 'amber';

type ProductScenario = {
  product: ProductType;
  title: string;
  description: string;
  accent: ProductAccent;
  icon: React.ReactNode;
  metrics: string[];
  spotlight: string;
  messages: { role: 'leo' | 'user'; text: string }[];
};

const GREETING_TEXT = 'Привет! Я LEO, AI-помощник.';

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

const PRODUCT_SCENARIOS: ProductScenario[] = [
  {
    product: 'jack',
    title: 'Подбор вакансий',
    description: 'Соберу профиль и подберу вакансии под ваш опыт',
    accent: 'green',
    icon: <SearchOutlined />,
    metrics: ['5–7 мин', 'shortlist', 'match score'],
    spotlight:
      'LEO собирает профиль из живого диалога, сравнивает вакансии с опытом и объясняет, почему матч сильный.',
    messages: [
      {
        role: 'leo',
        text: 'Здравствуйте! Соберу профиль и подберу вакансии. Выберите: быстрый подбор, детальный анализ или проанализировать готовое резюме.',
      },
      { role: 'user', text: 'Быстрый подбор' },
      {
        role: 'leo',
        text: 'Отлично. Уточню роль, опыт и формат — и покажу первые релевантные вакансии с объяснением match score.',
      },
    ],
  },
  {
    product: 'interview-prep',
    title: 'Подготовка к собеседованию',
    description: 'Тренажёр по вакансии или пробное интервью с персональным отчётом',
    accent: 'amber',
    icon: <BulbOutlined />,
    metrics: ['PDF-отчёт', 'любая роль', 'мок-интервью'],
    spotlight:
      'Можно разобрать конкретную вакансию или пройти пробное интервью на любую позицию — от сантехника до пилота.',
    messages: [
      {
        role: 'leo',
        text: 'Помогу подготовиться к собеседованию. Выберите: пробное собеседование или разбор вакансии?',
      },
      { role: 'user', text: 'Пробное собеседование' },
      {
        role: 'leo',
        text: 'Проведу интервью как представитель компании-работодателя. В конце — персональный отчёт с рекомендациями.',
      },
    ],
  },
];

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
    borderActive: 'border-green-400/50 shadow-[0_0_0_1px_rgba(74,222,128,0.25),0_20px_50px_-20px_rgba(34,197,94,0.35)]',
    glow: 'from-green-500/10',
    shadow: 'shadow-green-500/15',
    chip: 'border-green-500/25 bg-green-500/10 text-green-200/90',
    previewBadge: 'border-green-400/25 bg-green-400/10 text-green-200',
  },
  amber: {
    orb: 'bg-amber-500/20',
    icon: 'border-amber-500/35 bg-gradient-to-br from-amber-500/25 to-amber-600/15 text-amber-200 group-hover:from-amber-500/35 group-hover:to-amber-600/25',
    border: 'border-white/10 hover:border-amber-500/35',
    borderActive: 'border-amber-400/50 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_20px_50px_-20px_rgba(245,158,11,0.35)]',
    glow: 'from-amber-500/10',
    shadow: 'shadow-amber-500/15',
    chip: 'border-amber-500/25 bg-amber-500/10 text-amber-100/90',
    previewBadge: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
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

function CinematicBackground({ accent }: { accent: ProductAccent }) {
  const styles = ACCENT_STYLES[accent];

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
}: {
  scenario: ProductScenario;
  previewKey: number;
}) {
  const styles = ACCENT_STYLES[scenario.accent];

  return (
    <div className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#030712]/85 p-4 backdrop-blur-xl sm:rounded-3xl sm:p-5 lg:min-h-[360px]">
      <div className="mb-4 flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
        <div className="min-w-0 pr-2">
          <div className="text-sm font-semibold text-white">Превью диалога</div>
          <div className="truncate text-xs text-slate-500">{scenario.title}</div>
        </div>
        <div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${styles.previewBadge}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
          живой сценарий
        </div>
      </div>

      <div className="mb-4 shrink-0">
        <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">{scenario.spotlight}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {scenario.metrics.map((metric) => (
            <span
              key={metric}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${styles.chip}`}
            >
              {metric}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div key={previewKey} className="mt-auto flex flex-col gap-3">
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
                    ? 'bg-green-500 text-white shadow-lg shadow-green-950/25'
                    : 'border border-white/10 bg-white/[0.05] text-slate-100'
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <div className="min-w-0 flex-1 text-xs text-slate-500 sm:text-sm">
          <span className="lg:hidden">Нажмите стрелку на карточке, чтобы начать</span>
          <span className="hidden lg:inline">
            Нажмите стрелку на карточке слева, чтобы начать диалог
          </span>
        </div>
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-red-400/70" />
          <span className="h-2 w-2 rounded-full bg-amber-300/70" />
          <span className="h-2 w-2 rounded-full bg-green-400/80" />
        </div>
      </div>
    </div>
  );
}

export function ProductSelectionScreen({ onSelect }: ProductSelectionScreenProps) {
  const canHover = useCanHover();
  const [activeProduct, setActiveProduct] = useState<ProductType>('jack');
  const [previewKey, setPreviewKey] = useState(0);
  const ttsBeatAtRef = useRef(0);
  const assistantLevelRef = useRef(0);
  const previewPanelRef = useRef<HTMLDivElement>(null);

  const activeScenario =
    PRODUCT_SCENARIOS.find((scenario) => scenario.product === activeProduct) ?? PRODUCT_SCENARIOS[0];

  const { displayed: typedGreeting, isComplete: greetingComplete } = useTypingText(GREETING_TEXT);

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
    <div className="relative flex w-full flex-col px-3 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-6 lg:min-h-full lg:px-6 lg:py-7">
      <CinematicBackground accent={activeScenario.accent} />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 sm:gap-6 lg:flex-1 lg:gap-7">
        {/* Hero */}
        <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
          <div
            className="animate-fadeIn inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-green-200/90 backdrop-blur sm:text-[11px]"
            style={{ animationDelay: '0.05s' }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-400 shadow-[0_0_16px_rgba(34,197,94,0.85)]" />
            Ваш персональный AI-ассистент
          </div>

          <div className="w-full max-w-2xl space-y-2 sm:space-y-3">
            <h1
              className="min-h-[2.5rem] text-xl font-bold leading-tight sm:min-h-[3rem] sm:text-3xl lg:text-4xl"
              aria-label={GREETING_TEXT}
            >
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
            </h1>
            <p
              className="animate-fadeIn text-sm text-slate-300 sm:text-lg"
              style={{ animationDelay: '0.25s' }}
            >
              {canHover ? (
                <>
                  <span className="lg:hidden">Выбери сценарий — ниже покажу превью</span>
                  <span className="hidden lg:inline">
                    Выбери сценарий слева — справа покажу превью. Стрелка на карточке запускает чат
                  </span>
                </>
              ) : (
                'Нажми на карточку — ниже покажу превью. Стрелка справа запустит чат'
              )}
            </p>
          </div>

          <div
            className="animate-fadeIn w-full max-w-xl px-2"
            style={{ animationDelay: '0.35s' }}
          >
            <VoiceIndicator
              isActive={false}
              isMuted
              mode="idle"
              ttsBeatAtRef={ttsBeatAtRef}
              assistantLevelRef={assistantLevelRef}
              waveOnly
            />
          </div>
        </div>

        {/* Split: cards + preview */}
        <div className="grid flex-1 grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-stretch lg:gap-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            {PRODUCT_SCENARIOS.map((scenario, index) => {
              const styles = ACCENT_STYLES[scenario.accent];
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
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white/[0.04] p-4 text-left backdrop-blur transition-all duration-300 animate-fadeIn focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/45 sm:rounded-3xl sm:p-5 ${
                    isActive
                      ? `${styles.borderActive} scale-[1.01] bg-white/[0.07]`
                      : `${styles.border} hover:scale-[1.01] hover:bg-white/[0.07] hover:shadow-xl ${styles.shadow}`
                  }`}
                  style={{ animationDelay: `${0.45 + index * 0.1}s` }}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${styles.glow} to-transparent opacity-0 transition-opacity duration-300 ${
                      isActive ? 'opacity-100' : 'group-hover:opacity-100'
                    }`}
                  />
                  <div className="relative flex items-start gap-3 sm:gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xl transition-all duration-300 sm:h-14 sm:w-14 sm:text-2xl ${styles.icon}`}
                    >
                      {scenario.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-white sm:text-xl">{scenario.title}</h3>
                        <button
                          type="button"
                          aria-label={`Начать: ${scenario.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(scenario.product);
                          }}
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300 active:scale-95 sm:h-10 sm:w-10 ${
                            isActive
                              ? `${styles.previewBadge} scale-105 shadow-lg`
                              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          <ArrowRightOutlined className="text-sm" />
                        </button>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
                        {scenario.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {scenario.metrics.map((metric) => (
                          <span
                            key={metric}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium sm:text-[11px] ${styles.chip}`}
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
            className="animate-fadeIn min-h-[280px] lg:min-h-0"
            style={{ animationDelay: '0.55s' }}
          >
            <ScenarioPreviewPanel
              scenario={activeScenario}
              previewKey={previewKey}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
