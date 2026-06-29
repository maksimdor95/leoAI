'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { isAuthenticated } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { setPendingAuthRedirect } from '@/lib/pendingAuthRedirect';
import {
  getLandingPreviewScenarios,
  landingUi,
  type LandingPreviewScenarioCopy,
  type LandingPreviewScenarioId,
} from '@/lib/landingUiCopy';
import { useHumeTheme } from '@/lib/useHumeTheme';
import { HumeHeroWaveCanvas } from '@/components/chat/HumeHeroWaveCanvas';
import {
  BulbOutlined,
  FileTextOutlined,
  RocketOutlined,
  SearchOutlined,
} from '@ant-design/icons';

const SCENARIO_ICONS: Record<LandingPreviewScenarioId, ReactNode> = {
  'quick-start': <RocketOutlined />,
  jobs: <SearchOutlined />,
  'interview-prep': <BulbOutlined />,
  'pm-interview': <FileTextOutlined />,
};

export function HeroSection() {
  const { openAuthModal } = useAuth();
  const { settings } = useAppSettings();
  const isHume = useHumeTheme();
  const router = useRouter();
  const copy = landingUi(settings.locale);
  const previewScenarios = useMemo(
    () => getLandingPreviewScenarios(settings.locale),
    [settings.locale]
  );
  const [activeScenarioId, setActiveScenarioId] = useState<LandingPreviewScenarioId>('quick-start');

  const activeScenario =
    previewScenarios.find((scenario) => scenario.id === activeScenarioId) ?? previewScenarios[0];

  useEffect(() => {
    captureEvent('landing_viewed', {
      locale: settings.locale,
      theme: settings.theme,
    });
  }, [settings.locale, settings.theme]);

  const buildScenarioHref = (scenario: LandingPreviewScenarioCopy) =>
    scenario.starter
      ? `${scenario.href}&starter=${encodeURIComponent(scenario.starter)}`
      : scenario.href;

  const handleStart = (
    scenario: LandingPreviewScenarioCopy = activeScenario,
    source: 'hero_cta' | 'preview_start' = 'preview_start'
  ) => {
    const href = buildScenarioHref(scenario);
    const authenticated = isAuthenticated();

    captureEvent('landing_cta_clicked', {
      scenario_id: scenario.id,
      is_authenticated: authenticated,
      source,
    });

    if (!authenticated) {
      setPendingAuthRedirect({ href, scenarioId: scenario.id });
      openAuthModal('register', { source });
      return;
    }

    router.push(href);
  };

  const handleScenarioTabClick = (scenarioId: LandingPreviewScenarioId) => {
    setActiveScenarioId(scenarioId);
    captureEvent('landing_scenario_tab_clicked', { scenario_id: scenarioId });
  };

  const accentClass = (scenario: LandingPreviewScenarioCopy) =>
    isHume ? scenario.accentClassHume : scenario.accentClassLeo;

  const tabSelectedClass = isHume
    ? 'border-[rgba(34,34,34,0.18)] bg-[var(--color-paper)] text-[var(--color-ink)] shadow-[0_0_0_1px_rgba(34,34,34,0.08)]'
    : 'border-green-400/40 bg-white/[0.09] text-green-50 shadow-[0_0_0_1px_rgba(74,222,128,0.22),inset_0_1px_0_0_rgba(255,255,255,0.06)]';

  const tabIdleClass = isHume
    ? 'border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] text-[var(--color-smoke)] hover:border-[rgba(34,34,34,0.18)] hover:text-[var(--color-ink)]'
    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/18 hover:bg-white/[0.07] hover:text-white';

  const userBubbleClass = isHume
    ? 'bg-[var(--color-ink)] text-[var(--color-paper)] shadow-md'
    : 'bg-green-500 text-white shadow-lg shadow-green-950/20';

  const leoBubbleClass = isHume
    ? 'border border-[rgba(34,34,34,0.08)] bg-[var(--color-meringue)] text-[var(--color-ink)]'
    : 'border border-white/10 bg-white/[0.05] text-slate-100';

  return (
    <section
      className={`relative min-h-screen overflow-x-hidden ${
        isHume ? 'bg-[var(--color-bone)] text-[var(--color-ink)]' : 'bg-[#050913] text-white'
      }`}
    >
      {isHume ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[11rem] overflow-hidden opacity-95 sm:h-[13rem] lg:h-[14rem]">
          <HumeHeroWaveCanvas heroScale={2.65} />
        </div>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#050913] via-[#0a1a2e] to-[#050913] opacity-90" />
          <div className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-green-500/10 blur-3xl" />
        </>
      )}

      {!isHume ? (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }, (_, i) => {
            const positions = [
              { left: '10%', top: '20%', delay: '0s', duration: '3s' },
              { left: '80%', top: '10%', delay: '0.5s', duration: '4s' },
              { left: '30%', top: '60%', delay: '1s', duration: '3.5s' },
              { left: '70%', top: '50%', delay: '1.5s', duration: '4.5s' },
              { left: '20%', top: '80%', delay: '0.3s', duration: '3.8s' },
            ];
            const pos = positions[i % positions.length];
            return (
              <div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-green-500/20 animate-float"
                style={{
                  left: pos.left,
                  top: pos.top,
                  animationDelay: pos.delay,
                  animationDuration: pos.duration,
                }}
              />
            );
          })}
        </div>
      ) : null}

      <div
        className={`relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-start px-6 pb-16 animate-fadeIn ${
          isHume ? 'pt-6 sm:pt-8 lg:pt-24' : 'pt-8 sm:pt-10'
        }`}
      >
        <div className="grid items-start gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12">
          <div className={`text-center lg:text-left ${isHume ? 'pt-10 sm:pt-14 lg:pt-8' : ''}`}>
            <div
              className={`mb-5 inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2.5 text-left text-[11px] font-semibold leading-snug tracking-wide backdrop-blur sm:text-xs sm:leading-normal ${
                isHume
                  ? 'border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] text-[var(--color-smoke)]'
                  : 'border border-white/10 bg-white/[0.04] text-green-200/95'
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isHume
                    ? 'bg-[var(--color-iris)]'
                    : 'bg-green-400 shadow-[0_0_18px_rgba(34,197,94,0.8)]'
                }`}
              />
              {copy.heroBadge}
            </div>
            <h1
              className={`mb-6 text-6xl md:text-8xl lg:text-9xl ${
                isHume ? 'landing-hero-brand' : 'landing-hero-brand-leo'
              }`}
            >
              LEO AI
            </h1>

            <p
              className={`mx-auto mb-6 max-w-3xl text-xl leading-relaxed md:text-2xl lg:mx-0 ${
                isHume ? 'hume-body text-[var(--color-smoke)]' : 'text-slate-300'
              }`}
            >
              {copy.heroSubtitle}
            </p>

            <div className="flex flex-col items-center lg:items-start">
              <button
                type="button"
                onClick={() => handleStart(activeScenario, 'hero_cta')}
                className={
                  isHume
                    ? 'hume-btn-pill px-6 py-3 text-sm font-semibold sm:text-base'
                    : 'rounded-full bg-green-500 px-6 py-3 text-sm font-semibold leading-tight text-white shadow-lg shadow-green-950/30 transition-all hover:scale-[1.03] hover:bg-green-400 active:scale-95 sm:text-base'
                }
              >
                {copy.heroCta}
              </button>
            </div>
          </div>

          <div
            className={`flex w-full overflow-hidden rounded-[2rem] p-3 shadow-2xl sm:p-4 lg:h-[640px] lg:min-h-[640px] lg:max-h-[640px] lg:shrink-0 ${
              isHume
                ? 'relative z-20 lg:-mt-12 border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] shadow-[rgba(34,34,34,0.08)]'
                : 'border border-white/10 bg-[#07101d]/80 shadow-black/30 backdrop-blur-xl'
            }`}
          >
            <div
              className={`flex min-h-0 w-full flex-1 flex-col rounded-[1.5rem] p-4 sm:p-5 ${
                isHume
                  ? 'border border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)]'
                  : 'border border-white/10 bg-white/[0.04]'
              }`}
            >
              <div className="mb-4 flex shrink-0 flex-col gap-4 lg:mb-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 pr-1">
                  <div
                    className={`mb-2 text-xs font-semibold uppercase tracking-[0.36em] ${
                      isHume ? 'text-[var(--color-smoke)]' : 'text-green-300/70'
                    }`}
                  >
                    {copy.previewEyebrow}
                  </div>
                  <h2
                    className={`text-balance text-xl font-bold leading-snug sm:text-2xl lg:text-3xl ${
                      isHume ? 'hume-heading !text-2xl lg:!text-3xl' : 'text-white'
                    }`}
                  >
                    {copy.previewTitle}
                  </h2>
                </div>
                <div
                  className={`flex w-fit shrink-0 items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isHume
                      ? 'border border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)] text-[var(--color-iris)]'
                      : 'border border-green-400/20 bg-green-400/10 text-green-200'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isHume ? 'bg-[var(--color-iris)]' : 'bg-green-400'
                    }`}
                  />
                  {copy.previewLiveBadge}
                </div>
              </div>

              <div
                role="tablist"
                aria-label={copy.previewScenariosAria}
                className="mb-4 flex shrink-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mb-5"
              >
                {previewScenarios.map((scenario) => {
                  const selected = scenario.id === activeScenario.id;
                  return (
                    <button
                      key={scenario.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => handleScenarioTabClick(scenario.id)}
                      className={`inline-flex min-h-[2.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold leading-normal transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:ring-2 active:scale-[0.98] ${
                        selected ? tabSelectedClass : tabIdleClass
                      } ${isHume ? 'focus-visible:ring-[var(--color-iris)]/30' : 'focus-visible:ring-green-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a121c]'}`}
                    >
                      {scenario.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[0.86fr_1.14fr] lg:items-stretch">
                <div
                  className={`flex h-full min-h-0 min-w-0 flex-col overflow-y-auto rounded-3xl border p-5 ${
                    isHume
                      ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-paper)]'
                      : 'border-white/10 bg-[#050913]/70'
                  }`}
                >
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${accentClass(activeScenario)}`}
                  >
                    {SCENARIO_ICONS[activeScenario.id]}
                  </div>
                  <h3 className={`text-xl font-bold ${isHume ? 'hume-heading !text-lg' : 'text-white'}`}>
                    {activeScenario.title}
                  </h3>
                  <p
                    className={`mt-3 text-sm leading-relaxed ${
                      isHume ? 'hume-body-sm' : 'text-slate-300'
                    }`}
                  >
                    {activeScenario.description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {activeScenario.metrics.map((metric) => (
                      <span
                        key={metric}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          isHume
                            ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-meringue)] text-[var(--color-smoke)]'
                            : 'border-white/10 bg-white/[0.04] text-slate-300'
                        }`}
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className={`flex h-full min-h-[240px] min-w-0 flex-col gap-4 rounded-3xl border p-4 sm:min-h-[280px] lg:min-h-0 ${
                    isHume
                      ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-paper)]'
                      : 'border-white/10 bg-[#030712]/80'
                  }`}
                >
                  <div
                    className={`flex shrink-0 items-center justify-between border-b pb-3 ${
                      isHume ? 'border-[rgba(34,34,34,0.08)]' : 'border-white/10'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className={`text-sm font-semibold ${isHume ? 'text-[var(--color-ink)]' : 'text-white'}`}>
                        {copy.previewChatTitle}
                      </div>
                      <div
                        className={`truncate text-xs ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}
                      >
                        {activeScenario.title}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isHume ? 'bg-[var(--color-iris)]' : 'bg-green-400/80'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-1">
                    <div className="mt-auto flex flex-col gap-3.5">
                      {activeScenario.messages.map((message, index) => (
                        <div
                          key={`${activeScenario.id}-${index}`}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${
                              message.role === 'user' ? userBubbleClass : leoBubbleClass
                            }`}
                          >
                            {message.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-3 ${
                      isHume
                        ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)]'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <div
                      className={`flex-1 text-sm ${isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'}`}
                    >
                      {copy.previewInputPlaceholder}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStart(activeScenario)}
                      className={
                        isHume
                          ? 'hume-btn-pill !px-4 !py-2 !text-xs'
                          : 'rounded-full bg-green-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-400'
                      }
                    >
                      {copy.previewStart}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="features" className="mt-20">
          <div className="mb-12 text-center">
            <div
              className={`mb-3 text-xs font-semibold uppercase tracking-[0.36em] ${
                isHume ? 'text-[var(--color-smoke)]' : 'text-green-300/70'
              }`}
            >
              {copy.featuresEyebrow}
            </div>
            <h2
              className={`mb-4 text-4xl font-bold md:text-5xl ${
                isHume ? 'hume-heading' : 'text-white'
              }`}
            >
              {copy.featuresTitle}
            </h2>
            <p
              className={`mx-auto max-w-3xl text-lg ${
                isHume ? 'hume-body text-[var(--color-smoke)]' : 'text-slate-300'
              }`}
            >
              {copy.featuresBody}
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {previewScenarios.map((scenario, index) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => handleScenarioTabClick(scenario.id)}
                className={`group relative overflow-hidden rounded-3xl border p-6 text-left backdrop-blur transition-all hover:-translate-y-1 focus:outline-none focus:ring-2 animate-fadeIn ${
                  isHume
                    ? 'border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] hover:border-[rgba(34,34,34,0.2)] hover:bg-[var(--color-bone)] focus:ring-[var(--color-iris)]/25'
                    : 'border-white/10 bg-white/[0.04] hover:border-green-400/25 hover:bg-white/[0.07] focus:ring-green-400/40'
                }`}
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {!isHume ? (
                  <>
                    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-green-500/10 blur-2xl transition-opacity group-hover:opacity-100" />
                    <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-green-500/[0.08] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </>
                ) : null}
                <div className="relative">
                  <div
                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${accentClass(scenario)}`}
                  >
                    {SCENARIO_ICONS[scenario.id]}
                  </div>
                  <h3
                    className={`text-lg font-semibold leading-tight ${
                      isHume ? 'hume-heading !text-base' : 'text-white'
                    }`}
                  >
                    {scenario.title}
                  </h3>
                  <p
                    className={`mt-3 text-sm leading-relaxed ${
                      isHume ? 'hume-body-sm' : 'text-slate-300'
                    }`}
                  >
                    {scenario.description}
                  </p>
                  <p
                    className={`mt-4 text-xs leading-relaxed ${
                      isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'
                    }`}
                  >
                    {scenario.spotlight}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {scenario.metrics.map((metric) => (
                      <span
                        key={metric}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          isHume
                            ? 'border-[rgba(34,34,34,0.08)] bg-[var(--color-meringue)] text-[var(--color-smoke)]'
                            : 'border-white/10 bg-[#050913]/60 text-slate-300'
                        }`}
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
