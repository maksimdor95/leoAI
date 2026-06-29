import type { AppLocale } from '@/types/appSettings';

export type LandingPreviewScenarioId =
  | 'quick-start'
  | 'jobs'
  | 'interview-prep'
  | 'pm-interview';

export type LandingPreviewScenarioCopy = {
  id: LandingPreviewScenarioId;
  label: string;
  title: string;
  description: string;
  metrics: string[];
  spotlight: string;
  messages: { role: 'leo' | 'user'; text: string }[];
  href: string;
  starter?: string;
  accentClassLeo: string;
  accentClassHume: string;
};

type LandingStrings = {
  heroBadge: string;
  heroSubtitle: string;
  heroCta: string;
  settingsLanguageHint: string;
  previewEyebrow: string;
  previewTitle: string;
  previewLiveBadge: string;
  previewScenariosAria: string;
  previewChatTitle: string;
  previewInputPlaceholder: string;
  previewStart: string;
  featuresEyebrow: string;
  featuresTitle: string;
  featuresBody: string;
  headerFeatures: string;
  headerLogin: string;
  headerStart: string;
  headerChat: string;
  footerTagline: string;
  footerNav: string;
  footerFeatures: string;
  footerRegister: string;
  footerPrivacy: string;
  footerTerms: string;
  footerContacts: string;
  footerTelegram: string;
  footerBoosty: string;
  footerSecurityNote: string;
  footerHelpTitle: string;
  footerHelpBody: string;
  footerHelpCta: string;
  footerCopyright: string;
  footerFeedback: string;
};

const strings: Record<AppLocale, LandingStrings> = {
  ru: {
    heroBadge: 'Ваш персональный AI-ассистент',
    heroSubtitle:
      'Находим идеальные вакансии, которые подходят именно вам, и помогаем с подготовкой.',
    heroCta: 'Начать поиск',
    settingsLanguageHint: 'Язык интерфейса и тема оформления',
    previewEyebrow: 'Превью диалога',
    previewTitle: 'Выбери сценарий и посмотри, как LEO ведёт чат',
    previewLiveBadge: 'живой сценарий',
    previewScenariosAria: 'Сценарии LEO AI',
    previewChatTitle: 'Чат с LEO',
    previewInputPlaceholder: 'Введите ответ…',
    previewStart: 'Старт',
    featuresEyebrow: '5 сценариев в одном ассистенте',
    featuresTitle: 'Почему выбирают?',
    featuresBody:
      'LEO не просто отвечает в чате: он ведёт пользователя от первого карьерного запроса до подбора вакансий, тренировки интервью и персонального плана роста.',
    headerFeatures: 'Возможности',
    headerLogin: 'Войти',
    headerStart: 'Начать',
    headerChat: 'Чат с LEO',
    footerTagline:
      'Находим идеальные вакансии, которые подходят именно вам, и помогаем с подготовкой.',
    footerNav: 'Навигация',
    footerFeatures: 'Возможности',
    footerRegister: 'Регистрация',
    footerPrivacy: 'Политика конфиденциальности',
    footerTerms: 'Условия использования',
    footerContacts: 'Контакты',
    footerTelegram: 'Обратная связь в Telegram',
    footerBoosty: 'Поддержать на Boosty',
    footerSecurityNote:
      'Для поддержки не передавайте пароли, токены и банковские данные.',
    footerHelpTitle: 'Нужна помощь?',
    footerHelpBody:
      'Напишите в Telegram-бота поддержки по вопросам аккаунта, подбора вакансий или подготовки к интервью. Команда LEO AI ответит в чате.',
    footerHelpCta: 'Написать в поддержку',
    footerCopyright: '© 2025 LEO AI. Все права защищены.',
    footerFeedback: 'Обратная связь',
  },
  en: {
    heroBadge: 'Your personal AI assistant',
    heroSubtitle:
      'We find jobs that fit you and help you prepare for interviews.',
    heroCta: 'Start search',
    settingsLanguageHint: 'Interface language and appearance',
    previewEyebrow: 'Dialogue preview',
    previewTitle: 'Pick a scenario and see how LEO runs the chat',
    previewLiveBadge: 'live scenario',
    previewScenariosAria: 'LEO AI scenarios',
    previewChatTitle: 'Chat with LEO',
    previewInputPlaceholder: 'Type your reply…',
    previewStart: 'Start',
    featuresEyebrow: '5 scenarios in one assistant',
    featuresTitle: 'Why LEO?',
    featuresBody:
      'LEO doesn’t just chat — it guides you from your first career question to job matching, interview practice, and a personal growth plan.',
    headerFeatures: 'Features',
    headerLogin: 'Log in',
    headerStart: 'Get started',
    headerChat: 'Chat with LEO',
    footerTagline: 'We find jobs that fit you and help you prepare for interviews.',
    footerNav: 'Navigation',
    footerFeatures: 'Features',
    footerRegister: 'Sign up',
    footerPrivacy: 'Privacy policy',
    footerTerms: 'Terms of use',
    footerContacts: 'Contact',
    footerTelegram: 'Telegram support',
    footerBoosty: 'Support on Boosty',
    footerSecurityNote: 'Do not share passwords, tokens, or banking details with support.',
    footerHelpTitle: 'Need help?',
    footerHelpBody:
      'Message our Telegram support bot about your account, job matching, or interview prep. The LEO AI team will reply in chat.',
    footerHelpCta: 'Contact support',
    footerCopyright: '© 2025 LEO AI. All rights reserved.',
    footerFeedback: 'Feedback',
  },
};

const scenarios: Record<AppLocale, LandingPreviewScenarioCopy[]> = {
  ru: [
    {
      id: 'quick-start',
      label: 'Быстрый старт',
      title: 'Быстрый старт подбора',
      description: 'Пройдем мини-диагностику и сразу перейдем к первому shortlist вакансий',
      accentClassLeo: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=jack',
      starter: 'Быстрый подбор',
      metrics: ['3 вопроса', 'shortlist', 'профиль'],
      spotlight:
        'Мини-диагностика без длинной анкеты: LEO быстро понимает цель и переводит разговор к первым вакансиям.',
      messages: [
        {
          role: 'leo',
          text: 'Привет! Быстро соберу контекст: роль, опыт и формат работы. Начнем с желаемой позиции?',
        },
        { role: 'user', text: 'Хочу Product Manager, удаленно или гибрид, middle+.' },
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
      accentClassLeo: 'text-green-300 border-green-400/30 bg-green-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=jack',
      metrics: ['каталог hh.ru', 'match score', 'прозрачно'],
      spotlight:
        'LEO собирает профиль из диалога, сопоставляет его со свежим каталогом вакансий и объясняет, почему совпадение сильное или слабое.',
      messages: [
        {
          role: 'leo',
          text: 'Расскажи, какие роли тебе интересны и что точно не подходит. Я буду отсеивать шум.',
        },
        { role: 'user', text: 'Ищу продуктовую роль в B2B SaaS, важны рост и сильная команда.' },
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
      accentClassLeo: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=interview-prep',
      metrics: ['план', 'кейсы', 'мок'],
      spotlight:
        'Можно принести конкретную вакансию: LEO разберёт требования, подсветит пробелы и проведёт тренировку.',
      messages: [
        {
          role: 'leo',
          text: 'Пришли вакансию или требования к роли. Я соберу план подготовки и зоны риска.',
        },
        { role: 'user', text: 'Нужно подготовиться к Product Manager в финтехе.' },
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
      accentClassLeo: 'text-purple-300 border-purple-400/30 bg-purple-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=wannanew',
      metrics: ['пробное интервью', 'отчёт', 'рекомендации'],
      spotlight:
        'Формат как у реального интервью: вопросы, ответы, обратная связь и персональный отчёт после завершения.',
      messages: [
        {
          role: 'leo',
          text: 'Проведем интервью как с нанимающим менеджером. Я буду задавать вопросы и фиксировать сильные ответы.',
        },
        { role: 'user', text: 'Давай Product Manager mock interview.' },
        {
          role: 'leo',
          text: 'Начнем с продуктового опыта, затем перейдем к кейсу. В конце дам персональный отчёт и план улучшений.',
        },
      ],
    },
  ],
  en: [
    {
      id: 'quick-start',
      label: 'Quick start',
      title: 'Quick job matching',
      description: 'A mini diagnostic, then your first job shortlist',
      accentClassLeo: 'text-cyan-300 border-cyan-400/30 bg-cyan-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=jack',
      starter: 'Quick match',
      metrics: ['3 questions', 'shortlist', 'profile'],
      spotlight:
        'No long form — LEO quickly understands your goal and moves the conversation to first job matches.',
      messages: [
        {
          role: 'leo',
          text: "Hi! I'll quickly gather context: role, experience, and work format. Shall we start with your target position?",
        },
        { role: 'user', text: 'Product Manager, remote or hybrid, mid-senior level.' },
        {
          role: 'leo',
          text: "Great. I'll clarify stack, salary range, and priorities, then show the first relevant jobs.",
        },
      ],
    },
    {
      id: 'jobs',
      label: 'Jobs',
      title: 'Job matching',
      description: "I'll build your profile and match jobs to your experience",
      accentClassLeo: 'text-green-300 border-green-400/30 bg-green-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=jack',
      metrics: ['hh.ru catalog', 'match score', 'transparent'],
      spotlight:
        'LEO builds your profile from chat, matches it to a fresh job catalog, and explains strong vs weak fits.',
      messages: [
        {
          role: 'leo',
          text: "Tell me which roles interest you and what definitely doesn't fit. I'll filter the noise.",
        },
        { role: 'user', text: 'Product role in B2B SaaS — growth and a strong team matter.' },
        {
          role: 'leo',
          text: "Got it. I'll match jobs by relevance, explain why each fits, and help you prioritize.",
        },
      ],
    },
    {
      id: 'interview-prep',
      label: 'Trainer',
      title: 'Interview trainer',
      description: 'Job breakdown, prep plan, cases, theory, or mock interview',
      accentClassLeo: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=interview-prep',
      metrics: ['plan', 'cases', 'mock'],
      spotlight:
        'Bring a specific job posting — LEO breaks down requirements, highlights gaps, and runs practice.',
      messages: [
        {
          role: 'leo',
          text: 'Send a job posting or role requirements. I’ll build a prep plan and risk areas.',
        },
        { role: 'user', text: 'Need to prep for a Product Manager role in fintech.' },
        {
          role: 'leo',
          text: "I'll map topics: product metrics, discovery, prioritization, and case interviews. Then we can practice.",
        },
      ],
    },
    {
      id: 'pm-interview',
      label: 'Interview',
      title: 'Interview prep',
      description: 'Mock Product Manager interview with a personal report',
      accentClassLeo: 'text-purple-300 border-purple-400/30 bg-purple-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=wannanew',
      metrics: ['mock interview', 'report', 'recommendations'],
      spotlight:
        'Real interview format: questions, answers, feedback, and a personal report when you finish.',
      messages: [
        {
          role: 'leo',
          text: "I'll interview you like a hiring manager — questions and strong-answer notes.",
        },
        { role: 'user', text: "Let's do a Product Manager mock interview." },
        {
          role: 'leo',
          text: "We'll start with product experience, then a case. At the end — a personal report and improvement plan.",
        },
      ],
    },
  ],
};

export function landingUi(locale: AppLocale): LandingStrings {
  return strings[locale];
}

export function getLandingPreviewScenarios(locale: AppLocale): LandingPreviewScenarioCopy[] {
  return scenarios[locale];
}

export function landingSettingsChipLabel(locale: AppLocale, isHume: boolean): string {
  const lang = locale === 'en' ? 'EN' : 'RU';
  const theme = isHume ? 'Hume' : 'LEO';
  return locale === 'en' ? `${lang} · ${theme} theme` : `${lang} · тема ${theme}`;
}
