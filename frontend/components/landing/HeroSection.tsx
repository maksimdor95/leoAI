'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAuthenticated } from '@/lib/auth';
import {
  BulbOutlined,
  FileTextOutlined,
  RocketOutlined,
  SearchOutlined,
} from '@ant-design/icons';

type PreviewScenario = {
  id: string;
  label: string;
  title: string;
  description: string;
  accentClass: string;
  icon: React.ReactNode;
  href: string;
  starter?: string;
  metrics: string[];
  spotlight: string;
  messages: {
    role: 'leo' | 'user';
    text: string;
  }[];
};

const previewScenarios: PreviewScenario[] = [
  {
    id: 'quick-start',
    label: 'Быстрый старт',
    title: 'Быстрый старт подбора',
    description: 'Пройдем мини-диагностику и сразу перейдем к первому shortlist вакансий',
    accentClass: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10',
    icon: <RocketOutlined />,
    href: '/chat?new=true&product=jack',
    starter: 'Быстрый подбор',
    metrics: ['3 вопроса', 'shortlist', 'профиль'],
    spotlight: 'Мини-диагностика без длинной анкеты: LEO быстро понимает цель и переводит разговор к первым вакансиям.',
    messages: [
      {
        role: 'leo',
        text: 'Привет! Быстро соберу контекст: роль, опыт и формат работы. Начнем с желаемой позиции?',
      },
      {
        role: 'user',
        text: 'Хочу Product Manager, удаленно или гибрид, middle+.',
      },
      {
        role: 'leo',
        text: 'Отлично. Уточню стек, зарплатную вилку и приоритеты, а затем покажу первые релевантные вакансии.',
      },
    ],
  },
  {
    id: 'jobs',
    label: 'Вакансии',
    title: 'Подбор вакансий',
    description: 'Соберу твой профиль и подберу идеальные вакансии под твой опыт',
    accentClass: 'text-green-300 border-green-400/30 bg-green-400/10',
    icon: <SearchOutlined />,
    href: '/chat?new=true&product=jack',
    metrics: ['10,000+ вакансий', 'match score', 'email'],
    spotlight: 'LEO собирает профиль из живого диалога, сравнивает вакансии с твоим опытом и объясняет, почему матч сильный.',
    messages: [
      {
        role: 'leo',
        text: 'Расскажи, какие роли тебе интересны и что точно не подходит. Я буду отсеивать шум.',
      },
      {
        role: 'user',
        text: 'Ищу продуктовую роль в B2B SaaS, важны рост и сильная команда.',
      },
      {
        role: 'leo',
        text: 'Зафиксировал. Подберу вакансии по релевантности, объясню причины совпадения и помогу выбрать приоритет.',
      },
    ],
  },
  {
    id: 'interview-prep',
    label: 'Тренажёр',
    title: 'Тренажёр интервью',
    description: 'Разберу вакансию, составлю план и проведу кейсы, теорию или мок-интервью',
    accentClass: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    icon: <BulbOutlined />,
    href: '/chat?new=true&product=interview-prep',
    metrics: ['план', 'кейсы', 'мок'],
    spotlight: 'Можно принести конкретную вакансию: LEO разберёт требования, подсветит пробелы и проведёт тренировку.',
    messages: [
      {
        role: 'leo',
        text: 'Пришли вакансию или требования к роли. Я соберу план подготовки и зоны риска.',
      },
      {
        role: 'user',
        text: 'Нужно подготовиться к Product Manager в финтехе.',
      },
      {
        role: 'leo',
        text: 'Сделаю карту тем: продуктовые метрики, discovery, prioritization и кейс-интервью. Потом можем потренироваться.',
      },
    ],
  },
  {
    id: 'pm-interview',
    label: 'Интервью',
    title: 'Подготовка к собеседованию',
    description: 'Проведу пробное интервью на Product Manager и дам персональный отчёт',
    accentClass: 'text-purple-300 border-purple-400/30 bg-purple-400/10',
    icon: <FileTextOutlined />,
    href: '/chat?new=true&product=wannanew',
    metrics: ['пробное интервью', 'отчёт', 'рекомендации'],
    spotlight: 'Формат как у реального интервью: вопросы, ответы, обратная связь и персональный отчёт после завершения.',
    messages: [
      {
        role: 'leo',
        text: 'Проведем интервью как с нанимающим менеджером. Я буду задавать вопросы и фиксировать сильные ответы.',
      },
      {
        role: 'user',
        text: 'Давай Product Manager mock interview.',
      },
      {
        role: 'leo',
        text: 'Начнем с продуктового опыта, затем перейдем к кейсу. В конце дам персональный отчёт и план улучшений.',
      },
    ],
  },
];

export function HeroSection() {
  const { openAuthModal } = useAuth();
  const router = useRouter();
  const [activeScenarioId, setActiveScenarioId] = useState(previewScenarios[0].id);
  const activeScenario =
    previewScenarios.find((scenario) => scenario.id === activeScenarioId) ?? previewScenarios[0];

  const handleStart = (scenario: PreviewScenario = activeScenario) => {
    if (!isAuthenticated()) {
      openAuthModal('register');
      return;
    }

    const href = scenario.starter
      ? `${scenario.href}&starter=${encodeURIComponent(scenario.starter)}`
      : scenario.href;
    router.push(href);
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#050913] text-white">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#050913] via-[#0a1a2e] to-[#050913] opacity-90" />
      <div className="absolute left-1/2 top-0 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-green-500/10 blur-3xl" />

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }, (_, i) => {
          const positions = [
            { left: '10%', top: '20%', delay: '0s', duration: '3s' },
            { left: '80%', top: '10%', delay: '0.5s', duration: '4s' },
            { left: '30%', top: '60%', delay: '1s', duration: '3.5s' },
            { left: '70%', top: '50%', delay: '1.5s', duration: '4.5s' },
            { left: '20%', top: '80%', delay: '0.3s', duration: '3.8s' },
            { left: '90%', top: '70%', delay: '0.8s', duration: '4.2s' },
            { left: '50%', top: '30%', delay: '0.2s', duration: '3.2s' },
            { left: '40%', top: '90%', delay: '1.2s', duration: '4s' },
            { left: '60%', top: '15%', delay: '0.7s', duration: '3.7s' },
            { left: '15%', top: '40%', delay: '1.3s', duration: '4.3s' },
            { left: '85%', top: '45%', delay: '0.4s', duration: '3.4s' },
            { left: '25%', top: '5%', delay: '0.9s', duration: '4.1s' },
            { left: '75%', top: '85%', delay: '0.6s', duration: '3.6s' },
            { left: '5%', top: '55%', delay: '1.1s', duration: '4.4s' },
            { left: '95%', top: '35%', delay: '0.1s', duration: '3.3s' },
            { left: '45%', top: '75%', delay: '1.4s', duration: '4.6s' },
            { left: '55%', top: '25%', delay: '0.5s', duration: '3.9s' },
            { left: '35%', top: '95%', delay: '0.8s', duration: '4.2s' },
            { left: '65%', top: '65%', delay: '1.0s', duration: '3.5s' },
            { left: '12%', top: '12%', delay: '0.3s', duration: '4s' },
          ];
          const pos = positions[i] || { left: '50%', top: '50%', delay: '0s', duration: '3s' };
          return (
            <div
              key={i}
              className="absolute w-1 h-1 bg-green-500/20 rounded-full animate-float"
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

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col justify-start px-6 py-24 animate-fadeIn">
        <div className="grid items-start gap-10 lg:items-center lg:grid-cols-[0.88fr_1.12fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-[11px] font-semibold leading-snug tracking-wide text-green-200/95 backdrop-blur sm:text-xs sm:leading-normal">
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-400 shadow-[0_0_18px_rgba(34,197,94,0.8)]" />
              Ваш персональный AI-ассистент
            </div>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-6 leading-tight animate-gradient-text">
              LEO AI
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto lg:mx-0 leading-relaxed">
              Находим идеальные вакансии, которые подходят именно вам, и помогаем с подготовкой.
            </p>

            <div className="flex flex-col items-center lg:items-start">
              <button
                onClick={() => openAuthModal('register')}
                className="rounded-full bg-green-500 px-6 py-3 text-sm font-semibold leading-tight text-white shadow-lg shadow-green-950/30 transition-all hover:bg-green-400 hover:scale-[1.03] active:scale-95 sm:text-base"
              >
                Начать поиск
              </button>
            </div>
          </div>

          <div className="flex w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#07101d]/80 p-3 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-4 lg:h-[640px] lg:min-h-[640px] lg:max-h-[640px] lg:shrink-0">
            <div className="flex min-h-0 w-full flex-1 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <div className="mb-4 flex shrink-0 flex-col gap-4 lg:mb-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 pr-1">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.36em] text-green-300/70">
                    Превью диалога
                  </div>
                  <h2 className="text-balance text-xl font-bold leading-snug text-white sm:text-2xl lg:text-3xl">
                    Выбери сценарий и посмотри, как LEO ведёт чат
                  </h2>
                </div>
                <div className="flex w-fit shrink-0 items-center gap-2 self-start rounded-full border border-green-400/20 bg-green-400/10 px-3 py-1.5 text-xs font-semibold text-green-200">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  живой сценарий
                </div>
              </div>

              <div
                role="tablist"
                aria-label="Сценарии LEO AI"
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
                      onClick={() => setActiveScenarioId(scenario.id)}
                      className={`inline-flex min-h-[2.75rem] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold leading-normal transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-green-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a121c] active:scale-[0.98] ${
                        selected
                          ? 'border-green-400/40 bg-white/[0.09] text-green-50 shadow-[0_0_0_1px_rgba(74,222,128,0.22),inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/18 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {scenario.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[0.86fr_1.14fr] lg:items-stretch">
                <div className="flex min-h-0 h-full min-w-0 flex-col overflow-y-auto rounded-3xl border border-white/10 bg-[#050913]/70 p-5">
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${activeScenario.accentClass}`}
                  >
                    {activeScenario.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white">{activeScenario.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {activeScenario.description}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {activeScenario.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex h-full min-h-[240px] min-w-0 flex-col gap-4 rounded-3xl border border-white/10 bg-[#030712]/80 p-4 sm:min-h-[280px] lg:min-h-0">
                  <div className="flex shrink-0 items-center justify-between border-b border-white/10 pb-3">
                    <div className="min-w-0 pr-2">
                      <div className="text-sm font-semibold text-white">Чат с LEO</div>
                      <div className="truncate text-xs text-slate-500">{activeScenario.title}</div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
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
                              message.role === 'user'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-950/20'
                                : 'border border-white/10 bg-white/[0.05] text-slate-100'
                            }`}
                          >
                            {message.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                    <div className="flex-1 text-sm text-slate-500">Введите ответ…</div>
                    <button
                      type="button"
                      onClick={() => handleStart(activeScenario)}
                      className="rounded-full bg-green-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-400"
                    >
                      Старт
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="mt-20">
          <div className="text-center mb-12">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.36em] text-green-300/70">
              5 сценариев в одном ассистенте
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Почему выбирают?</h2>
            <p className="text-slate-300 text-lg max-w-3xl mx-auto">
              LEO не просто отвечает в чате: он ведёт пользователя от первого карьерного запроса
              до подбора вакансий, тренировки интервью и персонального плана роста.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {previewScenarios.map((scenario, index) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setActiveScenarioId(scenario.id)}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left backdrop-blur transition-all hover:-translate-y-1 hover:border-green-400/25 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-green-400/40 animate-fadeIn"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-green-500/10 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-green-500/[0.08] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div
                    className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl ${scenario.accentClass}`}
                  >
                    {scenario.icon}
                  </div>
                  <h3 className="text-lg font-semibold leading-tight text-white">{scenario.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{scenario.description}</p>
                  <p className="mt-4 text-xs leading-relaxed text-slate-400">{scenario.spotlight}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {scenario.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="rounded-full border border-white/10 bg-[#050913]/60 px-2.5 py-1 text-[11px] font-medium text-slate-300"
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
