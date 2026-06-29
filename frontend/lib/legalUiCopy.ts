import type { AppLocale } from '@/types/appSettings';

export type LegalSection = {
  title: string;
  text: string[];
};

export type LegalDocument = {
  pageTitle: string;
  intro: string;
  sections: LegalSection[];
  contactTitle: string;
  contactBody: string;
  backHome: string;
};

const privacy: Record<AppLocale, LegalDocument> = {
  ru: {
    backHome: '← На главную',
    pageTitle: 'Политика конфиденциальности',
    intro:
      'Редакция от 11 мая 2026 года. Эта политика описывает, как LEO AI обрабатывает данные пользователей сайта, продукта и Telegram-поддержки.',
    sections: [
      {
        title: '1. Какие данные мы обрабатываем',
        text: [
          'Мы можем получать имя, email, данные авторизации, сведения из профиля, резюме, вакансий, переписки с LEO AI, а также технические данные: IP-адрес, тип устройства, браузер, cookies и события использования сервиса.',
          'Если пользователь обращается в поддержку через Telegram-бота, мы можем обрабатывать Telegram ID, username, имя профиля и текст обращения, чтобы ответить на запрос.',
        ],
      },
      {
        title: '2. Зачем нам эти данные',
        text: [
          'Данные нужны для регистрации, входа в аккаунт, подбора вакансий, подготовки к интервью, сохранения истории диалогов, отправки уведомлений, поддержки пользователей, аналитики качества сервиса и защиты от злоупотреблений.',
        ],
      },
      {
        title: '3. Использование ИИ-сервисов',
        text: [
          'LEO AI использует алгоритмы искусственного интеллекта для анализа запросов, резюме, вакансий и ответов пользователя. Не передавайте в чат и поддержку пароли, токены, платежные данные, паспортные данные и иную информацию, которая не нужна для карьерной задачи.',
        ],
      },
      {
        title: '4. Передача данных',
        text: [
          'Мы не продаем персональные данные. Данные могут передаваться техническим поставщикам, которые помогают обеспечивать работу сервиса: хостинг, аналитика, email, Telegram, сервисы авторизации и ИИ-инфраструктура.',
          'Также данные могут быть раскрыты, если это требуется по закону или для защиты прав и безопасности LEO AI, пользователей и третьих лиц.',
        ],
      },
      {
        title: '5. Хранение и безопасность',
        text: [
          'Мы храним данные столько, сколько это необходимо для работы сервиса, поддержки пользователя, выполнения юридических обязанностей и защиты от споров.',
          'Мы применяем разумные технические и организационные меры защиты, но ни один способ передачи или хранения данных не является абсолютно безопасным.',
        ],
      },
      {
        title: '6. Права пользователя',
        text: [
          'Вы можете запросить доступ к своим данным, исправление, удаление, ограничение обработки или отзыв согласия, если это применимо. Для этого напишите в поддержку через Telegram-бота или на email, указанный в футере сайта.',
        ],
      },
      {
        title: '7. Cookies и аналитика',
        text: [
          'Сайт может использовать cookies и похожие технологии для авторизации, стабильной работы интерфейса, аналитики и улучшения продукта. Вы можете ограничить cookies в настройках браузера, но часть функций может работать некорректно.',
        ],
      },
      {
        title: '8. Изменения политики',
        text: [
          'Мы можем обновлять эту политику при изменении сервиса, законодательства или процессов обработки данных. Актуальная версия публикуется на этой странице.',
        ],
      },
    ],
    contactTitle: 'Контакты по вопросам данных',
    contactBody: 'privacy',
  },
  en: {
    backHome: '← Back to home',
    pageTitle: 'Privacy policy',
    intro:
      'Effective May 11, 2026. This policy describes how LEO AI processes data for the website, product, and Telegram support.',
    sections: [
      {
        title: '1. What data we process',
        text: [
          'We may receive name, email, authorization data, profile details, resumes, job postings, conversations with LEO AI, and technical data: IP address, device type, browser, cookies, and product usage events.',
          'If you contact support via our Telegram bot, we may process Telegram ID, username, profile name, and message text to respond to your request.',
        ],
      },
      {
        title: '2. Why we need this data',
        text: [
          'Data is used for registration, sign-in, job matching, interview prep, saving chat history, notifications, user support, product analytics, and abuse prevention.',
        ],
      },
      {
        title: '3. Use of AI services',
        text: [
          'LEO AI uses artificial intelligence to analyze requests, resumes, jobs, and user answers. Do not share passwords, tokens, payment details, passport data, or other information not needed for your career task in chat or support.',
        ],
      },
      {
        title: '4. Data sharing',
        text: [
          'We do not sell personal data. Data may be shared with technical providers that help run the service: hosting, analytics, email, Telegram, auth services, and AI infrastructure.',
          'Data may also be disclosed when required by law or to protect the rights and safety of LEO AI, users, and third parties.',
        ],
      },
      {
        title: '5. Retention and security',
        text: [
          'We retain data as long as needed to operate the service, support users, meet legal obligations, and protect against disputes.',
          'We apply reasonable technical and organizational safeguards, but no method of transmission or storage is completely secure.',
        ],
      },
      {
        title: '6. Your rights',
        text: [
          'You may request access, correction, deletion, restriction of processing, or withdrawal of consent where applicable. Contact support via the Telegram bot or the email listed in the site footer.',
        ],
      },
      {
        title: '7. Cookies and analytics',
        text: [
          'The site may use cookies and similar technologies for authorization, stable UI operation, analytics, and product improvement. You can limit cookies in your browser, but some features may not work correctly.',
        ],
      },
      {
        title: '8. Policy changes',
        text: [
          'We may update this policy when the service, legislation, or data processes change. The current version is published on this page.',
        ],
      },
    ],
    contactTitle: 'Data privacy contacts',
    contactBody: 'privacy',
  },
};

const terms: Record<AppLocale, LegalDocument> = {
  ru: {
    backHome: '← На главную',
    pageTitle: 'Условия использования',
    intro:
      'Редакция от 11 мая 2026 года. Эти условия описывают правила использования сайта, продукта LEO AI и Telegram-поддержки.',
    sections: [
      {
        title: '1. Общие положения',
        text: [
          'LEO AI помогает искать вакансии, готовиться к интервью, анализировать карьерные цели и получать рекомендации с использованием искусственного интеллекта.',
          'Используя сайт, продукт или Telegram-поддержку, вы соглашаетесь с этими условиями и политикой конфиденциальности.',
        ],
      },
      {
        title: '2. Аккаунт и безопасность',
        text: [
          'Пользователь отвечает за достоверность данных, сохранность доступа к аккаунту и все действия, совершенные через его учетную запись.',
          'Запрещено передавать в сервис пароли, секретные токены, платежные данные и другую информацию, которая не нужна для карьерных задач.',
        ],
      },
      {
        title: '3. Рекомендации LEO AI',
        text: [
          'Рекомендации, ответы и отчеты LEO AI носят информационный характер. Они не гарантируют трудоустройство, приглашение на интервью, повышение дохода или конкретный результат.',
          'Пользователь самостоятельно принимает решения о вакансиях, откликах, собеседованиях и передаче информации работодателям.',
        ],
      },
      {
        title: '4. Допустимое использование',
        text: [
          'Нельзя использовать сервис для незаконных действий, спама, обхода ограничений, атак на инфраструктуру, нарушения прав третьих лиц или загрузки вредоносного контента.',
          'Мы можем ограничить доступ к сервису, если видим злоупотребления, попытки нарушить безопасность или действия, мешающие другим пользователям.',
        ],
      },
      {
        title: '5. Telegram-поддержка',
        text: [
          'Обращения через Telegram-бота используются для ответа на вопросы о продукте, аккаунте, оплате, ошибках и обработке данных.',
          'Оператор поддержки может попросить уточнить email аккаунта, описание проблемы, скриншот ошибки или технические детали. Не отправляйте в поддержку пароли, одноразовые коды, токены и банковские данные.',
        ],
      },
      {
        title: '6. Интеллектуальная собственность',
        text: [
          'Интерфейс, тексты, логика продукта, дизайн, бренд и программный код LEO AI защищены законом. Пользователь получает право использовать сервис только в рамках этих условий.',
          'Материалы, которые пользователь загружает или вводит в сервис, остаются за пользователем, но он дает LEO AI право обрабатывать их для предоставления функций продукта.',
        ],
      },
      {
        title: '7. Доступность сервиса',
        text: [
          'Мы стремимся поддерживать стабильную работу сервиса, но не гарантируем отсутствие ошибок, перерывов, задержек, потери соединения или временной недоступности отдельных функций.',
        ],
      },
      {
        title: '8. Изменение условий',
        text: [
          'Мы можем обновлять условия при изменении продукта, процессов или требований закона. Актуальная версия публикуется на этой странице.',
        ],
      },
    ],
    contactTitle: 'Обратная связь',
    contactBody: 'terms',
  },
  en: {
    backHome: '← Back to home',
    pageTitle: 'Terms of use',
    intro:
      'Effective May 11, 2026. These terms describe the rules for using the LEO AI website, product, and Telegram support.',
    sections: [
      {
        title: '1. General',
        text: [
          'LEO AI helps you search for jobs, prepare for interviews, analyze career goals, and get recommendations using artificial intelligence.',
          'By using the website, product, or Telegram support, you agree to these terms and the privacy policy.',
        ],
      },
      {
        title: '2. Account and security',
        text: [
          'You are responsible for accurate data, keeping account access secure, and all actions performed through your account.',
          'Do not share passwords, secret tokens, payment details, or other information not needed for career tasks in the service.',
        ],
      },
      {
        title: '3. LEO AI recommendations',
        text: [
          'Recommendations, answers, and reports from LEO AI are informational. They do not guarantee employment, interview invitations, income increases, or specific outcomes.',
          'You make your own decisions about jobs, applications, interviews, and information shared with employers.',
        ],
      },
      {
        title: '4. Acceptable use',
        text: [
          'You may not use the service for illegal activity, spam, bypassing restrictions, infrastructure attacks, violating third-party rights, or uploading malicious content.',
          'We may restrict access if we detect abuse, security violations, or behavior that harms other users.',
        ],
      },
      {
        title: '5. Telegram support',
        text: [
          'Telegram bot inquiries are used to answer questions about the product, account, billing, errors, and data processing.',
          'Support may ask for account email, problem description, error screenshots, or technical details. Do not send passwords, one-time codes, tokens, or banking details to support.',
        ],
      },
      {
        title: '6. Intellectual property',
        text: [
          'The interface, texts, product logic, design, brand, and code of LEO AI are protected by law. You may use the service only within these terms.',
          'Materials you upload or enter remain yours, but you grant LEO AI the right to process them to provide product features.',
        ],
      },
      {
        title: '7. Service availability',
        text: [
          'We aim to keep the service stable but do not guarantee the absence of errors, outages, delays, connection loss, or temporary unavailability of individual features.',
        ],
      },
      {
        title: '8. Changes to terms',
        text: [
          'We may update these terms when the product, processes, or legal requirements change. The current version is published on this page.',
        ],
      },
    ],
    contactTitle: 'Feedback',
    contactBody: 'terms',
  },
};

export function getLegalDocument(kind: 'privacy' | 'terms', locale: AppLocale): LegalDocument {
  return kind === 'privacy' ? privacy[locale] : terms[locale];
}

export function legalContactParagraph(
  locale: AppLocale,
  kind: 'privacy' | 'terms'
): { beforeEmail: string; beforeTelegram: string; afterTelegram: string } {
  if (locale === 'en') {
    return kind === 'privacy'
      ? {
          beforeEmail: 'For privacy and data deletion questions, email ',
          beforeTelegram: ' or Telegram support ',
          afterTelegram: '.',
        }
      : {
          beforeEmail: 'Questions about terms or the service? Email ',
          beforeTelegram: ' or Telegram support ',
          afterTelegram: '.',
        };
  }
  return kind === 'privacy'
    ? {
        beforeEmail: 'По вопросам конфиденциальности и удаления данных напишите на ',
        beforeTelegram: ' или в Telegram-поддержку ',
        afterTelegram: '.',
      }
    : {
        beforeEmail: 'Если у вас есть вопрос по условиям или работе сервиса, напишите на ',
        beforeTelegram: ' или в Telegram-поддержку ',
        afterTelegram: '.',
      };
}
