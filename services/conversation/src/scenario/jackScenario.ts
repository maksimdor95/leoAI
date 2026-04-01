import { ScenarioDefinition } from '../types/scenario';

/**
 * LEO Voice Recruiter — Расширенный сценарий сбора профиля
 * 
 * Структура профиля на выходе:
 * 1. Саммари карьеры (автогенерация)
 * 2. Детальный опыт по каждой позиции (цикл)
 * 3. Образование (основное + дополнительное)
 * 4. Навыки (hard/soft/языки)
 * 5. Предпочтения по поиску
 */
export const JACK_SCENARIO: ScenarioDefinition = {
  id: 'jack-profile-v2',
  version: '2025-01-09',
  name: 'LEO Voice Recruiter — расширенный сбор профиля',
  description:
    'Сценарий для сбора полноценного резюме: саммари, опыт по позициям, образование, навыки, предпочтения.',
  entryStepId: 'greeting',
  steps: [
    // ============================================
    // БЛОК 0: Приветствие и служебные шаги
    // ============================================
    {
      id: 'greeting',
      type: 'question',
      label: 'Приветствие и готовность',
      instruction:
        'Поздоровайся с кандидатом. Объясни, что за 5-7 минут соберёшь полноценный профиль для подбора вакансий. Уточни, готов ли он начать.',
      fallbackText:
        'Здравствуйте! Я LEO, AI-помощник по подбору вакансий. За 5-7 минут соберу ваш профиль: опыт, достижения, навыки — чтобы подобрать идеальные позиции. Готовы начать?',
      placeholder: 'Напишите «да», если готовы продолжить.',
      collectKey: 'readyToStart',
      commands: [
        { id: 'pause', label: 'Пауза', action: 'pause' },
      ],
      next: {
        default: 'career_overview',
        when: [
          { condition: "readyToStart === 'нет'", to: 'pause_reminder' },
          { condition: "readyToStart === 'не готов'", to: 'pause_reminder' },
          { condition: "readyToStart === 'позже'", to: 'pause_reminder' },
          { condition: "readyToStart === 'приватность'", to: 'privacy_info' },
        ],
      },
    },
    {
      id: 'pause_reminder',
      type: 'question',
      label: 'Напоминание о паузе',
      instruction: 'Сообщи, что сохранишь прогресс. Спроси, вернуться сейчас или позже.',
      fallbackText: 'Понял, я сохраню прогресс. Вернуться сейчас или позже?',
      placeholder: 'Напишите «сейчас» или «позже».',
      collectKey: 'pauseChoice',
      commands: [
        { id: 'pause', label: 'Поставить на паузу', action: 'pause' },
        { id: 'continue', label: 'Продолжить сейчас', action: 'continue' },
      ],
      next: {
        default: 'career_overview',
        when: [{ condition: "pauseChoice === 'сейчас'", to: 'career_overview' }],
      },
    },
    {
      id: 'privacy_info',
      type: 'question',
      label: 'Информация о приватности',
      instruction: 'Объясни про безопасность данных и спроси, готов ли продолжить.',
      fallbackText:
        'Ваши данные хранятся в зашифрованном виде и используются только для подбора вакансий. Готовы продолжить?',
      placeholder: 'Напишите «да» или «продолжить».',
      collectKey: 'privacyConfirmed',
      next: 'greeting',
    },
    {
      id: 'clarify',
      type: 'question',
      label: 'Уточнение ответа',
      instruction: 'Попроси уточнить предыдущий ответ. Дай примеры ожидаемого формата.',
      fallbackText: 'Не совсем понял. Можете уточнить?',
      placeholder: 'Пожалуйста, дайте более подробный ответ.',
      collectKey: 'clarifiedAnswer',
      next: null,
    },

    // ============================================
    // БЛОК 1: Общий обзор карьеры
    // ============================================
    {
      id: 'career_overview',
      type: 'question',
      label: 'Обзор карьеры',
      instruction:
        'Попроси кратко описать карьерный путь: с чего начинали, куда пришли, в каких сферах работали. Это поможет понять общую траекторию.',
      fallbackText:
        'Расскажите кратко о вашем карьерном пути: с чего начинали и куда пришли? Например: «Начинал аналитиком, вырос до руководителя продукта в финтехе».',
      placeholder: 'Например: 7 лет в продакт-менеджменте, от аналитика до руководителя...',
      collectKey: 'careerSummary',
      next: 'total_experience',
    },
    {
      id: 'total_experience',
      type: 'question',
      label: 'Общий опыт',
      instruction: 'Уточни общий опыт работы в годах.',
      fallbackText: 'Сколько всего лет профессионального опыта?',
      placeholder: 'Например: 5 лет, 10+',
      collectKey: 'totalExperience',
      next: 'positions_count',
    },
    {
      id: 'positions_count',
      type: 'question',
      label: 'Количество позиций для описания',
      instruction:
        'Спроси, сколько последних мест работы хочет описать подробно (рекомендуем 2-4 последних).',
      fallbackText:
        'Сколько последних мест работы хотите описать подробно? Рекомендую 2-4 последних — они самые важные для работодателей.',
      placeholder: 'Например: 3',
      collectKey: 'positionsCount',
      next: 'position_intro',
    },

    // ============================================
    // БЛОК 2: Цикл по позициям (развёрнутый)
    // ============================================
    {
      id: 'position_intro',
      type: 'info_card',
      label: 'Введение в блок опыта',
      title: 'Детальный опыт работы',
      description: 'Сейчас пройдёмся по каждому месту работы. Для каждой позиции спрошу: компанию, роль, команду, достижения и проекты.',
      cards: [
        { title: '📋 Что будем собирать', content: 'Компания, период, должность, отрасль, команда, обязанности, достижения, проекты' },
      ],
      next: 'position_1_company',
    },

    // --- ПОЗИЦИЯ 1 ---
    {
      id: 'position_1_company',
      type: 'question',
      label: 'Позиция 1: Компания и период',
      instruction: 'Спроси название компании и период работы (годы).',
      fallbackText: 'Начнём с последнего места работы. Как называлась компания и когда вы там работали?',
      placeholder: 'Например: Яндекс, 2021-2024',
      collectKey: 'position_1_company',
      next: 'position_1_role',
    },
    {
      id: 'position_1_role',
      type: 'question',
      label: 'Позиция 1: Должность',
      instruction: 'Уточни должность на этом месте работы.',
      fallbackText: 'Какую должность вы занимали?',
      placeholder: 'Например: Senior Product Manager',
      collectKey: 'position_1_role',
      next: 'position_1_industry',
    },
    {
      id: 'position_1_industry',
      type: 'question',
      label: 'Позиция 1: Отрасль',
      instruction: 'Уточни отрасль/сферу деятельности компании.',
      fallbackText: 'В какой отрасли работала компания?',
      placeholder: 'Например: Финтех, E-commerce, HRtech',
      collectKey: 'position_1_industry',
      next: 'position_1_team',
    },
    {
      id: 'position_1_team',
      type: 'question',
      label: 'Позиция 1: Команда',
      instruction: 'Спроси про команду: размер и тип подчинения (прямое/матричное).',
      fallbackText: 'Расскажите про команду: сколько человек было в подчинении и какой тип (прямое или матричное)?',
      placeholder: 'Например: 5 человек в прямом подчинении + 3 в матричном',
      collectKey: 'position_1_team',
      next: 'position_1_responsibilities',
    },
    {
      id: 'position_1_responsibilities',
      type: 'question',
      label: 'Позиция 1: Обязанности',
      instruction: 'Попроси перечислить основные обязанности.',
      fallbackText: 'Какие были основные обязанности на этой позиции?',
      placeholder: 'Например: развитие продукта, управление бэклогом, работа с аналитикой',
      collectKey: 'position_1_responsibilities',
      next: 'position_1_achievements',
    },
    {
      id: 'position_1_achievements',
      type: 'question',
      label: 'Позиция 1: Достижения',
      instruction: 'Попроси назвать 2-3 главных достижения с цифрами/результатами.',
      fallbackText: 'Назовите 2-3 главных достижения на этой позиции. Желательно с цифрами!',
      placeholder: 'Например: увеличил конверсию на 40%, запустил 3 новых продукта',
      collectKey: 'position_1_achievements',
      next: 'position_1_projects',
    },
    {
      id: 'position_1_projects',
      type: 'question',
      label: 'Позиция 1: Ключевые проекты',
      instruction: 'Спроси про 1-2 ключевых проекта и их результаты.',
      fallbackText: 'Расскажите про 1-2 ключевых проекта, которыми гордитесь. Какие были результаты?',
      placeholder: 'Например: Запуск мобильного приложения — 1M скачиваний за 6 месяцев',
      collectKey: 'position_1_projects',
      next: {
        default: 'position_2_company',
        when: [
          { condition: 'positionsCount <= 1', to: 'education_main' },
        ],
      },
    },

    // --- ПОЗИЦИЯ 2 ---
    {
      id: 'position_2_company',
      type: 'question',
      label: 'Позиция 2: Компания и период',
      instruction: 'Спроси про следующее место работы.',
      fallbackText: 'Теперь расскажите о предыдущем месте работы. Компания и период?',
      placeholder: 'Например: Сбербанк, 2019-2021',
      collectKey: 'position_2_company',
      next: 'position_2_role',
    },
    {
      id: 'position_2_role',
      type: 'question',
      label: 'Позиция 2: Должность',
      instruction: 'Уточни должность.',
      fallbackText: 'Какую должность занимали?',
      placeholder: 'Например: Product Manager',
      collectKey: 'position_2_role',
      next: 'position_2_industry',
    },
    {
      id: 'position_2_industry',
      type: 'question',
      label: 'Позиция 2: Отрасль',
      instruction: 'Уточни отрасль.',
      fallbackText: 'В какой отрасли?',
      placeholder: 'Например: Банкинг',
      collectKey: 'position_2_industry',
      next: 'position_2_team',
    },
    {
      id: 'position_2_team',
      type: 'question',
      label: 'Позиция 2: Команда',
      instruction: 'Спроси про команду.',
      fallbackText: 'Какая была команда? Размер и тип подчинения?',
      placeholder: 'Например: 3 человека, прямое подчинение',
      collectKey: 'position_2_team',
      next: 'position_2_achievements',
    },
    {
      id: 'position_2_achievements',
      type: 'question',
      label: 'Позиция 2: Достижения',
      instruction: 'Попроси назвать главные достижения.',
      fallbackText: 'Какие главные достижения на этой позиции?',
      placeholder: 'Например: оптимизировал процессы, сократил time-to-market на 30%',
      collectKey: 'position_2_achievements',
      next: {
        default: 'position_3_company',
        when: [
          { condition: 'positionsCount <= 2', to: 'education_main' },
        ],
      },
    },

    // --- ПОЗИЦИЯ 3 ---
    {
      id: 'position_3_company',
      type: 'question',
      label: 'Позиция 3: Компания и период',
      instruction: 'Спроси про следующее место работы.',
      fallbackText: 'Расскажите о следующем месте работы. Компания и период?',
      placeholder: 'Например: Mail.ru, 2017-2019',
      collectKey: 'position_3_company',
      next: 'position_3_role',
    },
    {
      id: 'position_3_role',
      type: 'question',
      label: 'Позиция 3: Должность',
      instruction: 'Уточни должность.',
      fallbackText: 'Какую должность занимали?',
      placeholder: 'Например: Junior Product Manager',
      collectKey: 'position_3_role',
      next: 'position_3_achievements',
    },
    {
      id: 'position_3_achievements',
      type: 'question',
      label: 'Позиция 3: Достижения',
      instruction: 'Попроси назвать главные достижения.',
      fallbackText: 'Какие главные достижения?',
      placeholder: 'Например: провёл 50+ custdev интервью, запустил MVP',
      collectKey: 'position_3_achievements',
      next: {
        default: 'position_4_company',
        when: [
          { condition: 'positionsCount <= 3', to: 'education_main' },
        ],
      },
    },

    // --- ПОЗИЦИЯ 4 ---
    {
      id: 'position_4_company',
      type: 'question',
      label: 'Позиция 4: Компания и период',
      instruction: 'Спроси про следующее место работы.',
      fallbackText: 'Расскажите о следующем месте. Компания и период?',
      placeholder: 'Например: Стартап X, 2015-2017',
      collectKey: 'position_4_company',
      next: 'position_4_role',
    },
    {
      id: 'position_4_role',
      type: 'question',
      label: 'Позиция 4: Должность',
      instruction: 'Уточни должность.',
      fallbackText: 'Какую должность занимали?',
      placeholder: 'Например: Аналитик',
      collectKey: 'position_4_role',
      next: 'position_4_achievements',
    },
    {
      id: 'position_4_achievements',
      type: 'question',
      label: 'Позиция 4: Достижения',
      instruction: 'Попроси назвать главные достижения.',
      fallbackText: 'Какие главные достижения?',
      collectKey: 'position_4_achievements',
      next: {
        default: 'position_5_company',
        when: [
          { condition: 'positionsCount <= 4', to: 'education_main' },
        ],
      },
    },

    // --- ПОЗИЦИЯ 5 ---
    {
      id: 'position_5_company',
      type: 'question',
      label: 'Позиция 5: Компания и период',
      instruction: 'Спроси про последнее место работы в списке.',
      fallbackText: 'Последнее место работы. Компания и период?',
      collectKey: 'position_5_company',
      next: 'position_5_role',
    },
    {
      id: 'position_5_role',
      type: 'question',
      label: 'Позиция 5: Должность',
      instruction: 'Уточни должность.',
      fallbackText: 'Какую должность занимали?',
      collectKey: 'position_5_role',
      next: 'position_5_achievements',
    },
    {
      id: 'position_5_achievements',
      type: 'question',
      label: 'Позиция 5: Достижения',
      instruction: 'Попроси назвать главные достижения.',
      fallbackText: 'Какие главные достижения?',
      collectKey: 'position_5_achievements',
      next: 'education_main',
    },

    // ============================================
    // БЛОК 3: Образование
    // ============================================
    {
      id: 'education_main',
      type: 'question',
      label: 'Основное образование',
      instruction:
        'Спроси про основное образование: ВУЗ, факультет/специальность, годы обучения.',
      fallbackText:
        'Расскажите об основном образовании: ВУЗ, факультет или специальность, годы обучения.',
      placeholder: 'Например: МГУ, экономический факультет, 2010-2015',
      collectKey: 'education_main',
      next: 'education_additional',
    },
    {
      id: 'education_additional',
      type: 'question',
      label: 'Дополнительное образование',
      instruction:
        'Спроси про курсы, MBA, сертификации, которые релевантны для карьеры.',
      fallbackText:
        'Проходили ли курсы, MBA или получали сертификаты? Укажите наиболее значимые.',
      placeholder: 'Например: Product School, Certified Scrum Master, MBA Сколково',
      collectKey: 'education_additional',
      next: 'skills_hard',
    },

    // ============================================
    // БЛОК 4: Навыки
    // ============================================
    {
      id: 'skills_hard',
      type: 'question',
      label: 'Технические навыки',
      instruction:
        'Попроси перечислить технические навыки: инструменты, технологии, методологии.',
      fallbackText:
        'Какими техническими инструментами и технологиями владеете? Например: SQL, Python, Figma, Jira, Amplitude.',
      placeholder: 'Перечислите через запятую',
      collectKey: 'skills_hard',
      next: 'skills_soft',
    },
    {
      id: 'skills_soft',
      type: 'question',
      label: 'Управленческие навыки',
      instruction:
        'Спроси про управленческие и коммуникативные навыки.',
      fallbackText:
        'Какие управленческие и коммуникативные навыки можете выделить? Например: управление командой, переговоры, презентации.',
      placeholder: 'Например: управление командой, Agile, stakeholder management',
      collectKey: 'skills_soft',
      next: 'skills_languages',
    },
    {
      id: 'skills_languages',
      type: 'question',
      label: 'Владение языками',
      instruction:
        'Уточни уровень владения языками (английский и другие).',
      fallbackText:
        'Какими языками владеете и на каком уровне? Например: английский B2, немецкий A1.',
      placeholder: 'Например: английский — Upper-Intermediate, французский — базовый',
      collectKey: 'skills_languages',
      next: 'profile_snapshot',
    },

    // ============================================
    // БЛОК 5: Снимок профиля
    // ============================================
    {
      id: 'profile_snapshot',
      type: 'info_card',
      label: 'Снимок профиля',
      title: 'Ваш профиль',
      description: 'Вот что мы собрали. Можете продолжить к предпочтениям или вернуться к любому вопросу.',
      cards: [], // Заполняется динамически
      next: 'desired_role',
    },

    // ============================================
    // БЛОК 6: Предпочтения по поиску
    // ============================================
    {
      id: 'desired_role',
      type: 'question',
      label: 'Желаемая должность',
      instruction: 'Спроси, какую должность ищет сейчас.',
      fallbackText: 'Какую должность вы сейчас рассматриваете?',
      placeholder: 'Например: Head of Product, CPO, Senior PM',
      collectKey: 'desired_role',
      next: 'desired_location',
    },
    {
      id: 'desired_location',
      type: 'question',
      label: 'Локация и формат',
      instruction: 'Уточни предпочтения по локации и формату работы.',
      fallbackText: 'Где хотите работать и в каком формате? Удалённо, офис, гибрид?',
      placeholder: 'Например: Москва, гибрид 2 дня в офисе',
      collectKey: 'desired_location',
      next: 'desired_salary',
    },
    {
      id: 'desired_salary',
      type: 'question',
      label: 'Ожидания по зарплате',
      instruction: 'Спроси про ожидания по зарплате.',
      fallbackText: 'Какой уровень зарплаты ожидаете? Можно диапазон или «готов обсуждать».',
      placeholder: 'Например: от 400 000 рублей net',
      collectKey: 'desired_salary',
      next: 'desired_culture',
    },
    {
      id: 'desired_culture',
      type: 'question',
      label: 'Культура и ценности',
      instruction: 'Уточни, что важно в компании: культура, технологии, миссия.',
      fallbackText: 'Что для вас важно в компании? Например: культура, технологии, возможности роста.',
      placeholder: 'Например: сильная инженерная культура, продуктовый подход',
      collectKey: 'desired_culture',
      next: 'desired_start',
    },
    {
      id: 'desired_start',
      type: 'question',
      label: 'Готовность к выходу',
      instruction: 'Спроси, когда готов выйти на новую работу.',
      fallbackText: 'Когда готовы приступить к новой работе?',
      placeholder: 'Например: через 2 недели, после отработки',
      collectKey: 'desired_start',
      next: 'additional_info',
    },
    {
      id: 'additional_info',
      type: 'question',
      label: 'Дополнительная информация',
      instruction: 'Спроси, есть ли что-то ещё важное для подбора.',
      fallbackText: 'Есть ли ещё что-то важное, что стоит учесть при подборе?',
      placeholder: 'Например: ищу продуктовые компании, не рассматриваю банки',
      collectKey: 'additional_info',
      next: 'completion',
    },

    // ============================================
    // БЛОК 7: Завершение
    // ============================================
    {
      id: 'completion',
      type: 'info_card',
      label: 'Профиль собран',
      title: '✅ Профиль успешно собран!',
      description: 'Теперь LEO сгенерирует ваше профессиональное саммари и начнёт подбор вакансий.',
      cards: [
        { title: 'Что дальше?', content: 'Я проанализирую ваш профиль и подберу подходящие вакансии. Вы также можете попросить меня сгенерировать резюме.' },
      ],
      next: null,
    },

    // ============================================
    // Служебные шаги
    // ============================================
    {
      id: 'completion_gap',
      type: 'question',
      label: 'Заполнение пробелов',
      instruction:
        'Предложи заполнить критичные пробелы в профиле. Дай выбор: заполнить или продолжить.',
      fallbackText:
        'Я заметил, что мы не обсудили некоторые важные моменты. Хотите заполнить их сейчас?',
      placeholder: 'Напишите «заполнить» или «продолжить»',
      collectKey: 'completionChoice',
      next: null,
    },
  ],
};
