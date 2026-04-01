# Email Notification Service

Сервис для отправки персонализированных email с вакансиями.

## Функции:

- Отправка подобранных вакансий на email
- Персонализированные объяснения, почему вакансия подходит
- Welcome email для новых пользователей

## Технологии:

- Node.js (TypeScript) с Express
- Nodemailer для отправки email через SMTP (Яндекс почта)
- SendGrid для отправки email (альтернатива, fallback)
- Handlebars для шаблонов email

## Структура:

```
src/
├── controllers/     # HTTP контроллеры
├── middleware/      # Middleware (auth)
├── routes/          # API маршруты
├── services/        # Бизнес-логика (email, templates, clients)
├── templates/       # HTML шаблоны email
└── utils/           # Утилиты (logger, jwt)
```

## API Endpoints:

- `POST /api/email/send-welcome` - отправить приветственное письмо
- `POST /api/email/send-jobs` - отправить подборку вакансий

## Запуск:

```bash
# Установка зависимостей
npm install

# Разработка
npm run dev

# Production
npm run build
npm start
```

## Переменные окружения:

**SMTP (Яндекс почта) - РЕКОМЕНДУЕТСЯ:**

- `SMTP_HOST` - SMTP сервер (по умолчанию: smtp.yandex.ru)
- `SMTP_PORT` - порт SMTP (465 для SSL или 587 для STARTTLS)
- `SMTP_SECURE` - использовать SSL/TLS (true для порта 465, false для 587)
- `SMTP_USER` - email адрес для авторизации (обязательно)
- `SMTP_PASSWORD` - пароль приложения от Яндекс (обязательно)
- `FROM_EMAIL` - email отправителя
- `FROM_NAME` - имя отправителя (по умолчанию: Jack AI)

**SendGrid (альтернатива, fallback):**

- `SENDGRID_API_KEY` - API ключ SendGrid (опционально)

**Общие настройки:**

- `PORT` - порт сервиса (по умолчанию: 3005)
- `BASE_URL` - базовый URL для ссылок в email (по умолчанию: http://localhost:3000)
- `USER_PROFILE_SERVICE_URL` - URL сервиса профилей (по умолчанию: http://localhost:3001)
- `JOB_MATCHING_SERVICE_URL` - URL сервиса матчинга (по умолчанию: http://localhost:3004)
- `JWT_SECRET` - секретный ключ для JWT
- `CORS_ORIGIN` - разрешенный origin для CORS (по умолчанию: http://localhost:3000)

**Примечание:** Приоритет отправки: SMTP > SendGrid. Если настроен SMTP, он будет использоваться в первую очередь.

## Email Templates:

- `welcome-email.html` - приветственное письмо для новых пользователей
- `jobs-digest.html` - подборка вакансий с персонализацией

Шаблоны используют Handlebars для подстановки данных.
