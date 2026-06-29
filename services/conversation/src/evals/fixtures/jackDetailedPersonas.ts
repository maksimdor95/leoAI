import {
  buildDetailedJackAnswers,
  JACK_DETAILED_MILESTONES,
  JACK_DETAILED_REQUIRED_KEYS,
  JackPersonaFixture,
} from './types';

const DETAILED_BASE: Pick<
  JackPersonaFixture,
  'product' | 'scenarioId' | 'expectedFinalStepId' | 'maxClarifyCount'
> = {
  product: 'jack',
  scenarioId: 'jack-profile-v2',
  expectedFinalStepId: 'completion',
  maxClarifyCount: 3,
};

/** Пользователь A — Senior PM (TEST_USERS_CHAT_ANSWERS.md) */
export const JACK_SENIOR_PM_PERSONA: JackPersonaFixture = {
  ...DETAILED_BASE,
  id: 'jack-senior-pm',
  description: 'Jack detailed path — Senior PM, 8 years, 2 positions',
  requiredCollectedKeys: [...JACK_DETAILED_REQUIRED_KEYS],
  expectedMilestones: [...JACK_DETAILED_MILESTONES],
  answers: buildDetailedJackAnswers({
    careerOverview:
      'Начинал бизнес-аналитиком, затем вырос до Senior Product Manager в B2B SaaS. Веду продуктовые команды и отвечаю за рост выручки и retention.',
    totalExperience: '8 лет',
    positionsCount: '2',
    position1: [
      'ТехСофт, 2021-2026',
      'Senior Product Manager',
      'B2B SaaS',
      '7 человек в прямом подчинении, плюс кросс-функциональная команда в матрице',
      'Формировал roadmap, управлял discovery и delivery, приоритизировал backlog, отвечал за PnL модуля',
      'Увеличил retention на 18%, сократил churn на 12%, запустил 2 платных тарифа с ростом MRR на 22%',
      'Запуск биллинга и self-service onboarding, результат: -35% time-to-value и +14% conversion trial-to-paid',
    ],
    position2: [
      'ФинБанк, 2018-2021',
      'Product Manager',
      'Финтех',
      '4 человека, прямое подчинение',
      'Запустил мобильный onboarding, снизил drop-off на 27%, ускорил выпуск релизов на 30%',
    ],
    education: [
      'ВШЭ, Прикладная экономика, 2010-2014',
      'ProductStar, Scrum.org PSM I, курс по юнит-экономике',
    ],
    skills: [
      'SQL, Python, Amplitude, GA4, Tableau, Jira, Figma, A/B testing',
      'Приоритизация, stakeholder management, фасилитация, управление командой, переговоры',
      'Английский C1, немецкий A2',
    ],
    preferences: [
      'Head of Product / Group Product Manager',
      'Москва, гибрид 2-3 дня в офисе',
      '450000-550000 net',
      'Сильная продуктовая культура, зрелая аналитика, быстрое принятие решений',
      'Через 2-4 недели',
      'Не рассматриваю чисто support-продукты, интересны B2B и AI-направления',
    ],
  }),
};

/** Пользователь B — Middle PM */
export const JACK_MIDDLE_PM_PERSONA: JackPersonaFixture = {
  ...DETAILED_BASE,
  id: 'jack-middle-pm',
  description: 'Jack detailed path — Middle PM, 5 years, 2 positions',
  requiredCollectedKeys: [...JACK_DETAILED_REQUIRED_KEYS],
  expectedMilestones: [...JACK_DETAILED_MILESTONES],
  answers: buildDetailedJackAnswers({
    careerOverview:
      'Начинал project coordinator, затем вырос до Product Manager в e-commerce, сейчас веду growth-направление.',
    totalExperience: '5 лет',
    positionsCount: '2',
    position1: [
      'MarketHub, 2022-2026',
      'Product Manager',
      'E-commerce',
      '3 человека в прямом подчинении и аналитик в матрице',
      'Приоритизация backlog, улучшение каталога и checkout, работа с аналитикой и маркетингом',
      '+11% conversion в checkout, +9% AOV, -15% bounce rate в карточке товара',
      'Проект one-click checkout, результат: -22% drop на шаге оплаты',
    ],
    position2: [
      'ShopLine, 2019-2022',
      'Junior Product Manager',
      'Retail tech',
      'Команда 6 человек, без прямого подчинения',
      'Запустил рекомендации в каталоге, +8% CTR и +5% выручки в категории',
    ],
    education: ['СПбГУ, Менеджмент, 2013-2017', 'Курс по продуктовой аналитике, SQL bootcamp'],
    skills: [
      'SQL, GA4, AppMetrica, Jira, Confluence, Figma',
      'Коммуникация, управление приоритетами, презентации, фасилитация',
      'Английский B2',
    ],
    preferences: [
      'Middle/Senior Product Manager',
      'Санкт-Петербург, удаленно или гибрид',
      '250000-320000 net',
      'Команда с сильной аналитикой, прозрачные процессы, быстрые эксперименты',
      'Через 2 недели',
      'Интересны компании с большим трафиком и зрелыми процессами экспериментов',
    ],
  }),
};

/** Пользователь C — Junior PM */
export const JACK_JUNIOR_PM_PERSONA: JackPersonaFixture = {
  ...DETAILED_BASE,
  id: 'jack-junior-pm',
  description: 'Jack detailed path — Junior PM, 2 years, 2 positions',
  requiredCollectedKeys: [...JACK_DETAILED_REQUIRED_KEYS],
  expectedMilestones: [...JACK_DETAILED_MILESTONES],
  answers: buildDetailedJackAnswers({
    careerOverview:
      'Перешел из аналитики в продукт, участвую в задачах по развитию веб-сервиса и мобильного приложения.',
    totalExperience: '2 года',
    positionsCount: '2',
    position1: [
      'StartApp, 2024-2026',
      'Junior Product Manager',
      'SaaS',
      'Без прямого подчинения, работал в команде 5 человек',
      'Сбор требований, постановка задач, анализ воронки, подготовка гипотез',
      'Запустил 6 A/B тестов, улучшил activation на 7%, сократил время онбординга на 12%',
      'Проект редизайна onboarding, результат: больше завершений регистрации',
    ],
    position2: [
      'DataLab, 2022-2024',
      'Product Analyst',
      'EdTech',
      'Команда 4 человека',
      'Настроил метрики и дашборд, ускорил отчетность для команды',
    ],
    education: ['РАНХиГС, Бизнес-информатика, 2018-2022', 'Курс Product Sense, SQL курс'],
    skills: [
      'SQL, Excel, Amplitude, Miro, Jira',
      'Структурное мышление, коммуникация, обучаемость, ответственность',
      'Английский B1',
    ],
    preferences: [
      'Junior/Middle Product Manager',
      'Удаленно, готов к релокации в Москву',
      '140000-190000 net',
      'Менторство, понятный процесс роста, сильная команда',
      'Через 2 недели',
      'Готов к тестовым заданиям и интенсивному обучению',
    ],
  }),
};
