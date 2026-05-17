import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | LEO AI',
  description: 'Как LEO AI обрабатывает персональные данные и обращения пользователей.',
};

const sections = [
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
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050913] text-white">
      <section className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <a href="/" className="text-sm text-green-300 hover:text-green-200 transition-colors">
          ← На главную
        </a>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-10">
          <p className="text-sm uppercase tracking-[0.24em] text-green-300/80">LEO AI</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
            Политика конфиденциальности
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            Редакция от 11 мая 2026 года. Эта политика описывает, как LEO AI обрабатывает данные
            пользователей сайта, продукта и Telegram-поддержки.
          </p>

          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.text.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-slate-300">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-green-400/20 bg-green-400/10 p-5">
            <h2 className="text-lg font-semibold text-green-100">Контакты по вопросам данных</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">
              По вопросам конфиденциальности и удаления данных напишите на{' '}
              <a href="mailto:hello@leoai.com" className="text-green-300 hover:text-green-200">
                hello@leoai.com
              </a>{' '}
              или в Telegram-поддержку{' '}
              <a
                href="https://t.me/leoaisupportbot?start=privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-300 hover:text-green-200"
              >
                @leoaisupportbot
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
