import { ChatScenario } from '@/types/chat';

export const CHAT_SCENARIOS: ChatScenario[] = [
  {
    id: 'find-jobs',
    title: '1. Найти подходящие вакансии',
    description: 'Соберу релевантные вакансии и отфильтрую шум по профилю.',
    starterMessage:
      'Нашел вакансии по вашим критериям. Отсортировал по релевантности и зарплате. Показать топ-10?',
    followUpMessage:
      'Подготовил короткий список приоритетных вакансий. Начнем с самых сильных совпадений?',
    ctas: [
      { id: 'show-top-10', label: 'Показать топ-10', action: 'show_top_10' },
      { id: 'refine-filter', label: 'Уточнить фильтр', action: 'refine_filter' },
      { id: 'hide-irrelevant', label: 'Убрать нерелевант', action: 'hide_irrelevant' },
    ],
  },
  {
    id: 'fit-priority',
    title: '2. Оценить Fit и приоритет',
    description: 'Покажу, стоит ли откликаться сейчас, позже или пропустить.',
    starterMessage:
      'Оценил вакансию: Fit 78/100. Сильные стороны: React, TypeScript, продуктовый опыт. Риск: мало опыта с GraphQL.',
    followUpMessage:
      'Отмечу 3 вакансии с лучшим шансом интервью на этой неделе. Продолжить?',
    ctas: [
      { id: 'apply-now', label: 'Откликаться', action: 'apply_now' },
      { id: 'improve-cv-first', label: 'Сначала доработать CV', action: 'improve_cv_first' },
      { id: 'skip-job', label: 'Пропустить', action: 'skip_job' },
    ],
  },
  {
    id: 'tailor-application',
    title: '3. Адаптировать отклик',
    description: 'Подготовлю персонализированный отклик под конкретную вакансию.',
    starterMessage:
      'Собрал tailored-отклик: headline, ключевые bullets и короткое сопроводительное. Проверим тон и финализируем?',
    followUpMessage: 'Сделаю 2 версии: более формальную и более живую. Какую показать первой?',
    ctas: [
      { id: 'tone-formal', label: 'Сделать более формально', action: 'set_tone_formal' },
      { id: 'make-shorter', label: 'Сделать короче', action: 'shorten_application' },
      { id: 'ready-to-send', label: 'Готово к отправке', action: 'mark_ready_to_send' },
    ],
  },
  {
    id: 'follow-through',
    title: '4. Дожать до ответа',
    description: 'Напомню про следующий шаг и помогу с follow-up.',
    starterMessage:
      'По заявке в компанию пора сделать follow-up. Сгенерировать письмо в нейтральном тоне?',
    followUpMessage:
      'Есть заявки без действий 5+ дней. Пройдемся по ним за 3 минуты и решим: дожать или закрыть?',
    ctas: [
      { id: 'generate-follow-up', label: 'Сгенерировать follow-up', action: 'generate_follow_up' },
      { id: 'set-reminder', label: 'Поставить напоминание', action: 'set_follow_up_reminder' },
      { id: 'close-job', label: 'Закрыть вакансию', action: 'close_job' },
    ],
  },
];

