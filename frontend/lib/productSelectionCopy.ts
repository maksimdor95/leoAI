import type { AppLocale } from '@/types/appSettings';

export type ProductSelectionProduct = 'jack' | 'wannanew' | 'interview-prep';

export type ProductScenarioCopy = {
  product: ProductSelectionProduct;
  title: string;
  description: string;
  metrics: string[];
  spotlight: string;
  messages: { role: 'leo' | 'user'; text: string }[];
};

type ProductSelectionStrings = {
  badge: string;
  greeting: string;
  subtitleHoverMobile: string;
  subtitleHoverDesktop: string;
  subtitleTouch: string;
  previewTitle: string;
  previewBadge: string;
  startAria: (title: string) => string;
};

const copy: Record<AppLocale, ProductSelectionStrings> = {
  ru: {
    badge: 'Ваш персональный AI-ассистент',
    greeting: 'Привет! Я LEO, AI-помощник.',
    subtitleHoverMobile: 'Выбери сценарий — ниже покажу превью',
    subtitleHoverDesktop:
      'Выбери сценарий слева — справа покажу превью. Стрелка на карточке запускает чат',
    subtitleTouch: 'Нажми на карточку — ниже покажу превью. Стрелка справа запустит чат',
    previewTitle: 'Превью диалога',
    previewBadge: 'живой сценарий',
    startAria: (title) => `Начать: ${title}`,
  },
  en: {
    badge: 'Your personal AI assistant',
    greeting: "Hi! I'm LEO, your AI assistant.",
    subtitleHoverMobile: 'Pick a scenario — preview below',
    subtitleHoverDesktop:
      'Pick a scenario on the left — preview on the right. The arrow on a card starts the chat',
    subtitleTouch: 'Tap a card for preview below. The arrow starts the chat',
    previewTitle: 'Dialogue preview',
    previewBadge: 'live scenario',
    startAria: (title) => `Start: ${title}`,
  },
};

const scenarios: Record<AppLocale, ProductScenarioCopy[]> = {
  ru: [
    {
      product: 'jack',
      title: 'Подбор вакансий',
      description: 'Соберу профиль и подберу вакансии под ваш опыт',
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
  ],
  en: [
    {
      product: 'jack',
      title: 'Job matching',
      description: 'I’ll build your profile and match jobs to your experience',
      metrics: ['5–7 min', 'shortlist', 'match score'],
      spotlight:
        'LEO collects your profile in a live dialogue, compares jobs to your experience, and explains why each match is strong.',
      messages: [
        {
          role: 'leo',
          text: 'Hello! I’ll build your profile and match jobs. Choose: quick match, detailed analysis, or analyze an existing resume.',
        },
        { role: 'user', text: 'Quick match' },
        {
          role: 'leo',
          text: 'Great. I’ll clarify role, experience, and format — then show the first relevant jobs with match score explanations.',
        },
      ],
    },
    {
      product: 'interview-prep',
      title: 'Interview prep',
      description: 'Vacancy trainer or mock interview with a personal report',
      metrics: ['PDF report', 'any role', 'mock interview'],
      spotlight:
        'Analyze a specific job posting or run a mock interview for any role — from plumber to pilot.',
      messages: [
        {
          role: 'leo',
          text: 'I’ll help you prepare for interviews. Choose: mock interview or vacancy breakdown?',
        },
        { role: 'user', text: 'Mock interview' },
        {
          role: 'leo',
          text: 'I’ll interview you as the hiring company. At the end — a personal report with recommendations.',
        },
      ],
    },
  ],
};

export function productSelectionUi(locale: AppLocale): ProductSelectionStrings {
  return copy[locale];
}

export function getProductScenarios(locale: AppLocale): ProductScenarioCopy[] {
  return scenarios[locale];
}
