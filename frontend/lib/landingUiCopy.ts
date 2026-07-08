import type { AppLocale } from '@/types/appSettings';

export type LandingPreviewScenarioId = 'jobs' | 'interview-prep';

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

export type LandingHowItWorksStep = {
  title: string;
  body: string;
};

type LandingStrings = {
  heroBadge: string;
  heroSubtitle: string;
  heroCta: string;
  heroSignedInAs: string;
  settingsLanguageHint: string;
  previewEyebrow: string;
  previewTitle: string;
  previewLiveBadge: string;
  previewScenariosAria: string;
  previewChatTitle: string;
  previewInputPlaceholder: string;
  previewStart: string;
  howItWorksEyebrow: string;
  howItWorksTitle: string;
  howItWorksNote: string;
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
  footerSettings: string;
  settingsBackHome: string;
  settingsPageTitle: string;
  settingsPageIntro: string;
};

const strings: Record<AppLocale, LandingStrings> = {
  ru: {
    heroBadge: 'Карьерный AI-ассистент',
    heroSubtitle:
      'Подберём вакансии под ваш опыт, подготовим сопроводительное и проведём пробное собеседование — всё в диалоге с LEO.',
    heroCta: 'Начать с LEO',
    heroSignedInAs: 'Вы вошли как',
    settingsLanguageHint: 'Язык интерфейса и тема оформления',
    previewEyebrow: 'Превью диалога',
    previewTitle: 'Посмотрите, как LEO ведёт диалог',
    previewLiveBadge: 'живой сценарий',
    previewScenariosAria: 'Возможности LEO AI',
    previewChatTitle: 'Чат с LEO',
    previewInputPlaceholder: 'Введите ответ…',
    previewStart: 'Старт',
    howItWorksEyebrow: 'Как это работает',
    howItWorksTitle: 'От диалога до отклика — честно',
    howItWorksNote:
      'LEO не заменяет job-площадки: мы помогаем найти, понять совпадение и подготовиться. Отклик отправляется на сайте работодателя или агрегатора — для этого нужен аккаунт и резюме там.',
    featuresEyebrow: 'Два пути в одном ассистенте',
    featuresTitle: 'Что умеет LEO',
    featuresBody:
      'Подбор из крупных российских job-площадок с объяснением match score и подготовка к собеседованию с персональным отчётом.',
    headerFeatures: 'Возможности',
    headerLogin: 'Войти',
    headerStart: 'Начать',
    headerChat: 'Чат с LEO',
    footerTagline:
      'LEO — карьерный ассистент: подбор вакансий, сопроводительные и подготовка к интервью. Отклик — на сайте площадки.',
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
    footerSettings: 'Настройка',
    settingsBackHome: '← На главную',
    settingsPageTitle: 'Настройки',
    settingsPageIntro: 'Выберите язык интерфейса и тему оформления.',
  },
  en: {
    heroBadge: 'Career AI assistant',
    heroSubtitle:
      'We match jobs to your experience, draft cover letters, and run mock interviews — all in one dialogue with LEO.',
    heroCta: 'Start with LEO',
    heroSignedInAs: 'Signed in as',
    settingsLanguageHint: 'Interface language and appearance',
    previewEyebrow: 'Dialogue preview',
    previewTitle: 'See how LEO runs the conversation',
    previewLiveBadge: 'live scenario',
    previewScenariosAria: 'LEO AI capabilities',
    previewChatTitle: 'Chat with LEO',
    previewInputPlaceholder: 'Type your reply…',
    previewStart: 'Start',
    howItWorksEyebrow: 'How it works',
    howItWorksTitle: 'From chat to application — transparently',
    howItWorksNote:
      'LEO does not replace job boards: we help you find roles, understand fit, and prepare. You apply on the employer or aggregator site — you need an account and resume there.',
    featuresEyebrow: 'Two paths in one assistant',
    featuresTitle: 'What LEO does',
    featuresBody:
      'Job matching from major Russian job boards with match score explanations, plus interview prep with a personal report.',
    headerFeatures: 'Features',
    headerLogin: 'Log in',
    headerStart: 'Get started',
    headerChat: 'Chat with LEO',
    footerTagline:
      'LEO — career assistant: job matching, cover letters, and interview prep. You apply on the job board site.',
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
    footerSettings: 'Settings',
    settingsBackHome: '← Back to home',
    settingsPageTitle: 'Settings',
    settingsPageIntro: 'Choose interface language and appearance.',
  },
};

const howItWorksSteps: Record<AppLocale, LandingHowItWorksStep[]> = {
  ru: [
    {
      title: 'Рассказываете LEO о себе',
      body: 'Роль, опыт, формат работы — в чате или голосом. Без длинной анкеты.',
    },
    {
      title: 'LEO подбирает и объясняет',
      body: 'Shortlist из крупных российских job-площадок с match score и причинами совпадения.',
    },
    {
      title: 'Готовит сопроводительное',
      body: 'Письмо под конкретную вакансию по вашему профилю — можно отредактировать.',
    },
    {
      title: 'Вы откликаетесь на сайте',
      body: 'LEO откроет вакансию на площадке-источнике. Письмо скопировано — вставьте его в форму отклика.',
    },
  ],
  en: [
    {
      title: 'Tell LEO about yourself',
      body: 'Role, experience, work format — in chat or by voice. No long forms.',
    },
    {
      title: 'LEO matches and explains',
      body: 'A shortlist from major Russian job boards with match score and reasons.',
    },
    {
      title: 'Drafts your cover letter',
      body: 'Tailored to the job from your profile — editable before you apply.',
    },
    {
      title: 'You apply on the site',
      body: 'LEO opens the listing on the source site. Letter copied — paste it into the application form.',
    },
  ],
};

const scenarios: Record<AppLocale, LandingPreviewScenarioCopy[]> = {
  ru: [
    {
      id: 'jobs',
      label: 'Вакансии',
      title: 'Подбор вакансий',
      description:
        'Соберу профиль в диалоге и покажу вакансии с объяснением, почему они вам подходят',
      accentClassLeo: 'text-green-300 border-green-400/30 bg-green-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=jack',
      metrics: ['job-площадки', 'match score', 'сопроводительное'],
      spotlight:
        'LEO отсеивает шум, ранжирует по релевантности и готовит письмо для отклика. Отклик — на сайте площадки, где размещена вакансия.',
      messages: [
        {
          role: 'leo',
          text: 'Здравствуйте! Соберу профиль и подберу вакансии. Выберите: быстрый подбор, детальный анализ или разбор готового резюме.',
        },
        { role: 'user', text: 'Быстрый подбор' },
        {
          role: 'leo',
          text: 'Отлично. Уточню роль, опыт и формат — и покажу первые релевантные вакансии с объяснением match score.',
        },
      ],
    },
    {
      id: 'interview-prep',
      label: 'Интервью',
      title: 'Подготовка к собеседованию',
      description:
        'Разбор вакансии, тренировка или пробное интервью на любую роль — с персональным отчётом',
      accentClassLeo: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=interview-prep',
      metrics: ['любая роль', 'мок-интервью', 'PDF-отчёт'],
      spotlight:
        'Можно разобрать конкретную вакансию или пройти пробное собеседование как у работодателя. В конце — отчёт с рекомендациями.',
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
  ],
  en: [
    {
      id: 'jobs',
      label: 'Jobs',
      title: 'Job matching',
      description:
        "I'll build your profile in chat and show jobs with an explanation of why they fit",
      accentClassLeo: 'text-green-300 border-green-400/30 bg-green-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=jack',
      metrics: ['job boards', 'match score', 'cover letter'],
      spotlight:
        'LEO filters noise, ranks by relevance, and drafts your cover letter. You apply on the site where the job is listed.',
      messages: [
        {
          role: 'leo',
          text: "Hello! I'll build your profile and match jobs. Choose: quick match, detailed analysis, or review an existing resume.",
        },
        { role: 'user', text: 'Quick match' },
        {
          role: 'leo',
          text: "Great. I'll clarify role, experience, and format — then show the first relevant jobs with match score explanations.",
        },
      ],
    },
    {
      id: 'interview-prep',
      label: 'Interview',
      title: 'Interview prep',
      description: 'Vacancy breakdown, practice, or mock interview for any role — with a personal report',
      accentClassLeo: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
      accentClassHume: 'text-[var(--color-iris)] border-[rgba(34,34,34,0.12)] bg-[var(--color-meringue)]',
      href: '/chat?new=true&product=interview-prep',
      metrics: ['any role', 'mock interview', 'PDF report'],
      spotlight:
        'Analyze a specific job or run a mock interview like a real employer. You get a report with recommendations at the end.',
      messages: [
        {
          role: 'leo',
          text: "I'll help you prepare for interviews. Choose: mock interview or vacancy breakdown?",
        },
        { role: 'user', text: 'Mock interview' },
        {
          role: 'leo',
          text: "I'll interview you as the hiring company. At the end — a personal report with recommendations.",
        },
      ],
    },
  ],
};

export function landingUi(locale: AppLocale): LandingStrings {
  return strings[locale];
}

export function getLandingHowItWorksSteps(locale: AppLocale): LandingHowItWorksStep[] {
  return howItWorksSteps[locale];
}

export function getLandingPreviewScenarios(locale: AppLocale): LandingPreviewScenarioCopy[] {
  return scenarios[locale];
}

export function landingSettingsChipLabel(locale: AppLocale, isHume: boolean): string {
  const lang = locale === 'en' ? 'EN' : 'RU';
  const theme = isHume ? 'Hume' : 'LEO';
  return locale === 'en' ? `${lang} · ${theme} theme` : `${lang} · тема ${theme}`;
}
