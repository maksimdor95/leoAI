import { ScenarioDefinition } from '../types/scenario';

/**
 * wannanew — AI-агент для подготовки Product Manager к собеседованиям
 * 
 * Флоу:
 * 1. Приветствие
 * 2. Резюме (текст или загрузка файла)
 * 3. Целевая роль PM (Junior/Middle/Senior/Lead/VP)
 * 4. Тип продукта (B2C/B2B/SaaS/Marketplace и др.)
 * 5. Продуктовый опыт
 * 6. Начало интервью (info_card)
 * 7. Интервью вопросы (3 шт.)
 * 8. Завершение и плейсхолдер отчёта
 */
export const WANNANEW_SCENARIO: ScenarioDefinition = {
  id: 'wannanew-pm-v1',
  version: '2025-01-24',
  name: 'wannanew — подготовка PM к собеседованиям',
  description:
    'AI-агент для подготовки Product Manager к собеседованиям: анализ опыта, пробное интервью, отчёт.',
  entryStepId: 'greeting',
  steps: [
    // ============================================
    // БЛОК 0: Приветствие
    // ============================================
    {
      id: 'greeting',
      type: 'question',
      label: 'Приветствие и готовность',
      instruction:
        'Поздоровайся с кандидатом. Объясни, что wannanew поможет подготовиться к собеседованиям на позицию Product Manager: проанализирует опыт и проведёт голосовое пробное интервью. Уточни, готов ли начать.',
      fallbackText:
        'Привет! Я wannanew — AI-агент для подготовки к собеседованиям на Product Manager. За 10-15 минут проанализирую твой опыт и проведу голосовое пробное интервью. Готов начать?',
      placeholder: 'Напиши «да», если готов продолжить.',
      collectKey: 'readyToStart',
      commands: [{ id: 'pause', label: 'Пауза', action: 'pause' }],
      next: {
        default: 'resume_or_intro',
        when: [
          { condition: "readyToStart === 'нет'", to: 'pause_reminder' },
          { condition: "readyToStart === 'не готов'", to: 'pause_reminder' },
          { condition: "readyToStart === 'позже'", to: 'pause_reminder' },
        ],
      },
    },
    {
      id: 'pause_reminder',
      type: 'question',
      label: 'Напоминание о паузе',
      instruction: 'Сообщи, что сохранишь прогресс. Спроси, вернуться сейчас или позже.',
      fallbackText: 'Понял, сохраню прогресс. Вернуться сейчас или позже?',
      placeholder: 'Напиши «сейчас» или «позже».',
      collectKey: 'pauseChoice',
      commands: [
        { id: 'pause', label: 'Поставить на паузу', action: 'pause' },
        { id: 'continue', label: 'Продолжить сейчас', action: 'continue' },
      ],
      next: {
        default: 'resume_or_intro',
        when: [{ condition: "pauseChoice === 'сейчас'", to: 'resume_or_intro' }],
      },
    },
    {
      id: 'clarify',
      type: 'question',
      label: 'Уточнение ответа',
      instruction: 'Попроси уточнить предыдущий ответ. Дай примеры ожидаемого формата.',
      fallbackText: 'Не совсем понял. Можешь уточнить?',
      placeholder: 'Пожалуйста, дай более подробный ответ.',
      collectKey: 'clarifiedAnswer',
      next: null,
    },

    // ============================================
    // БЛОК 1: Сбор информации о кандидате
    // ============================================
    {
      id: 'resume_or_intro',
      type: 'question',
      label: 'Резюме или описание опыта',
      instruction:
        'Попроси кандидата загрузить резюме (PDF/DOCX) через скрепку в строке ввода или кратко описать опыт текстом.',
      fallbackText:
        'Расскажи кратко о своём опыте в продуктовом менеджменте. Можешь скопировать текст резюме или описать своими словами: роли, компании, ключевые достижения.',
      placeholder: 'Например: 5 лет в продукте, последний год — Senior PM в SaaS B2B...',
      collectKey: 'resumeOrIntro',
      next: 'target_role',
    },
    {
      id: 'target_role',
      type: 'question',
      label: 'Целевая роль PM',
      instruction:
        'Уточни, на какую позицию Product Manager готовится кандидат: Junior, Middle, Senior, Lead или VP.',
      fallbackText:
        'Какой уровень PM-позиции тебя интересует? Junior, Middle, Senior, Lead или VP?',
      placeholder: 'Например: Senior PM',
      collectKey: 'targetRole',
      next: 'product_type',
    },
    {
      id: 'product_type',
      type: 'question',
      label: 'Тип продукта',
      instruction:
        'Спроси, какой тип продукта ближе кандидату: B2C, B2B, SaaS, Marketplace, Hardware, Internal tools или другое.',
      fallbackText:
        'Какой тип продукта тебе ближе? B2C, B2B, SaaS, Marketplace, Hardware, Internal tools — или опиши свой вариант.',
      placeholder: 'Например: B2B SaaS',
      collectKey: 'targetProductType',
      next: 'pm_experience',
    },
    {
      id: 'pm_experience',
      type: 'question',
      label: 'Ключевой продуктовый кейс',
      instruction:
        'Попроси описать один ключевой продуктовый кейс: что делал, какие метрики отслеживал, какой результат получил.',
      fallbackText:
        'Опиши свой самый сильный продуктовый кейс: что делал, какие метрики отслеживал, какой результат получил? Это поможет мне подготовить релевантные вопросы для интервью.',
      placeholder: 'Например: Запустил фичу X, которая увеличила retention на 15%...',
      collectKey: 'pmCase',
      next: 'interview_start',
    },

    // ============================================
    // БЛОК 2: Голосовое интервью
    // ============================================
    {
      id: 'interview_start',
      type: 'info_card',
      label: 'Начало интервью',
      title: 'Пробное интервью',
      description:
        'Сейчас начнётся голосовое пробное интервью. Рекомендую включить микрофон и отвечать развёрнуто, как на реальном собеседовании. Я задам 3 типовых PM-вопроса.',
      cards: [
        {
          title: '🎙️ Голосовой режим',
          content: 'Включи микрофон для голосового ответа или отвечай текстом.',
          icon: '🎙️',
        },
        {
          title: '⏱️ Формат',
          content: '3 вопроса, отвечай развёрнуто (1-2 минуты на каждый).',
          icon: '⏱️',
        },
        {
          title: '💡 Совет',
          content: 'Используй структуру STAR: Situation, Task, Action, Result.',
          icon: '💡',
        },
      ],
      next: 'interview_q1',
    },
    {
      id: 'interview_q1',
      type: 'question',
      label: 'Интервью: приоритизация',
      instruction:
        'Задай вопрос о приоритизации задач/фич. Не подсказывай ответ. Веди себя как интервьюер.',
      fallbackText:
        'Расскажи, как ты приоритизируешь задачи и фичи в бэклоге? Какие фреймворки используешь и почему?',
      placeholder: 'Отвечай развёрнуто, как на реальном собеседовании...',
      collectKey: 'interviewAnswer1',
      next: 'interview_q2',
    },
    {
      id: 'interview_q2',
      type: 'question',
      label: 'Интервью: метрики',
      instruction:
        'Задай вопрос о продуктовых метриках. Как определяет успех продукта, какие KPI отслеживает.',
      fallbackText:
        'Как ты определяешь, что продукт успешен? Какие метрики отслеживаешь и как принимаешь решения на их основе?',
      placeholder: 'Отвечай развёрнуто...',
      collectKey: 'interviewAnswer2',
      next: 'interview_q3',
    },
    {
      id: 'interview_q3',
      type: 'question',
      label: 'Интервью: стейкхолдеры',
      instruction:
        'Задай вопрос о работе со стейкхолдерами. Как управляет ожиданиями, разрешает конфликты.',
      fallbackText:
        'Расскажи о сложной ситуации со стейкхолдерами: конфликт интересов, несогласие по приоритетам. Как ты это разрешил?',
      placeholder: 'Отвечай развёрнуто...',
      collectKey: 'interviewAnswer3',
      next: 'report_ready',
    },

    // ============================================
    // БЛОК 3: Завершение и отчёт
    // ============================================
    {
      id: 'report_ready',
      type: 'info_card',
      label: 'Отчёт готов',
      title: 'Интервью завершено!',
      description:
        'Спасибо за участие в пробном интервью! Твой персональный отчёт с оценкой, рекомендациями и списком типовых вопросов готов к скачиванию.',
      cards: [
        {
          title: 'Оценка',
          content: 'Разбор ответов и итоговый балл по блокам интервью.',
          icon: '📊',
        },
        {
          title: 'Рекомендации',
          content: 'Что усилить перед следующими собеседованиями.',
          icon: '📝',
        },
        {
          title: 'Вопросы',
          content: 'Типовые вопросы под твой целевой уровень PM.',
          icon: '❓',
        },
        {
          title: 'PDF-отчёт',
          content: 'Полный отчёт в одном файле — скачай или начни интервью заново.',
          icon: '📄',
        },
      ],
      next: null,
    },
  ],
};
