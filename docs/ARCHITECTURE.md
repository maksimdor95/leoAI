# Техническая архитектура LEO AI

## Обзор

LEO AI — единый AI-продукт для карьерного развития. Внутри продукта реализованы разные пользовательские сценарии:

| Сценарий | Назначение |
|---------|------------|
| **Поиск вакансий** (`jack-profile-v2`) | AI-ассистент для поиска работы. Проводит структурированный диалог с кандидатом, собирает профиль, подбирает вакансии через HH.ru и отправляет персонализированную подборку на email. |
| **PM-интервью** (`wannanew-pm-v1`) | AI-агент для подготовки Product Manager к собеседованиям. Анализирует опыт, проводит пробное интервью, формирует PDF-отчёт с оценкой и рекомендациями. |

Все сценарии используют общую инфраструктуру: единый Conversation Service с регистром сценариев, общую авторизацию (User Profile Service), общий AI/NLP Service (YandexGPT) и единый фронтенд с переключением между сценариями.

Различия реализуются через:
- Разные сценарии диалога (`jack-profile-v2` vs `wannanew-pm-v1`)
- Разные интеграции при завершении (Job Matching + Email для сценария поиска вакансий; Report Generation для сценария PM-интервью)
- Разный брендинг в UI по сценариям

---

## Стек технологий

| Слой | Технологии |
|------|-----------|
| Frontend | Next.js 14 (App Router, Static Export), TypeScript, React 18, Ant Design 5, Tailwind CSS, REST API клиент + Socket.IO (локальная разработка) |
| Backend | Node.js + Express + TypeScript (все сервисы) |
| AI | YandexGPT через Yandex Cloud API |
| База данных | PostgreSQL 15, Redis 7 |
| Очереди | BullMQ (на базе Redis) |
| PDF | Puppeteer + Handlebars |
| Хранилище файлов | Yandex Object Storage (S3-совместимый, AWS SDK) |
| Email | Nodemailer (SMTP/Yandex) + SendGrid fallback |
| Аутентификация | JWT |
| Инфраструктура | Docker Compose (локально), Yandex Cloud Serverless Containers (production) |

---

## Сервисы

| Сервис | Порт | Назначение | Хранилище |
|--------|------|-----------|-----------|
| **Frontend** | 3000 | Next.js SPA (Static Export), REST API клиент, Socket.IO для dev | -- |
| **User Profile** | 3001 | Регистрация, авторизация (JWT), профили пользователей, карьерные профили | PostgreSQL |
| **Conversation** | 3002 | Управление сессиями, движок диалога, регистр сценариев, REST + WebSocket | Redis |
| **AI/NLP** | 3003 | Клиент YandexGPT, мультиагентная система (Validator, Profile Analyst, Context Manager) | Redis |
| **Job Matching** | 3004 | Скрейпер HH.ru, фоновые задачи BullMQ, rule-based скоринг вакансий | PostgreSQL, Redis |
| **Email** | 3005 | Отправка email через SMTP/SendGrid, шаблоны Handlebars | -- |
| **Report** | 3007 | Генерация PDF-отчётов (Puppeteer), загрузка в S3 | Redis, S3 |

---

## Архитектурная диаграмма

**Runtime-модель MVP 0:** фронтенд работает как Next.js Static Export (SPA), production-контур основан на REST + polling. WebSocket используется в локальной разработке.

```mermaid
flowchart TB
    Client["Browser\n(Next.js Static Export SPA)\nport 3000"]

    subgraph Gateway["API Gateway (nginx/OpenResty) — port 8080"]
        direction LR
        GW_Health["GET /health"]
        GW_Route["Path-based routing"]
    end

    subgraph UserProfile["User Profile Service — port 3001"]
        UP_Auth["POST /api/users/register\nPOST /api/users/login"]
        UP_Profile["GET/PUT /api/users/profile"]
        UP_Career["POST /api/career/profile\nGET /api/career/ai-readiness"]
        UP_DB[("PostgreSQL\njack.users\njack.career_profiles\njack.resumes\njack.skills\njack.user_skills\njack.learning_plans")]
    end

    subgraph Conversation["Conversation Service — port 3002"]
        CONV_HTTP["REST API:\nPOST /api/chat/session\nPOST .../message\nPOST .../command\nPOST .../merge-collected\nPOST .../report\nGET .../report-preview\nGET /api/conversations\nDELETE /api/conversations/:id"]
        CONV_WS["Socket.IO:\nsession:joined\nsession:history\nmessage:received\nmessage:send\ncommand:select"]
        CONV_Session["SessionService"]
        CONV_Dialogue["DialogueEngine\n+ scenario scripts"]
        CONV_Integration["IntegrationService\n(completion triggers)"]
        CONV_Redis[("Redis\nsession:*\nuser:*:sessions\nTTL 24h")]
    end

    subgraph AINLP["AI/NLP Service — port 3003"]
        AI_API["POST /api/ai/process-message\nPOST /api/ai/generate-step\nPOST /api/ai/validate-answer\nPOST /api/ai/analyze-profile\nPOST /api/ai/extract-profile-from-resume\nPOST /api/ai/check-context\nPOST /api/ai/free-chat\nPOST /api/ai/generate-summary\nPOST /api/ai/generate-resume"]
        AI_Context["ContextService"]
        AI_Yandex["YandexGPT Client\n(Cloud API)"]
        AI_Redis[("Redis\nai:nlp:history:*\nai:nlp:facts:*\nTTL 24h / 7d")]
    end

    subgraph JobMatching["Job Matching Service — port 3004"]
        JM_API["GET /api/jobs/match/:userId\nGET /api/jobs/catalog\nGET /api/jobs/hh/salary-evaluation/:areaId\nGET /api/jobs/:jobId\nPOST /api/jobs/refresh"]
        JM_Scraper["Scraper\n(HH.ru API / mock)"]
        JM_Queue["BullMQ Queue\n(job-scraping)\nhourly cron"]
        JM_Matcher["Matcher\n(scoring engine)"]
        JM_DB[("PostgreSQL\npublic.jobs")]
        JM_Redis[("Redis\nBullMQ queues\n+ session reads")]
    end

    subgraph Email["Email Service — port 3005"]
        EM_API["POST /api/email/send-jobs\nPOST /api/email/send-welcome"]
        EM_Template["TemplateService\n(Handlebars)"]
        EM_Send["EmailService\n(SMTP / SendGrid)"]
    end

    subgraph Report["Report Service — port 3007"]
        REP_API["POST /api/report/generate\nGET /api/report/:id/status\nGET /api/report/:id/download"]
        REP_Gen["ReportGenerator\n+ PDF (Puppeteer)"]
        REP_Storage["StorageService\n(S3-compatible)"]
        REP_Redis[("Redis\nreport:*\nTTL 7d")]
    end

    subgraph Infra["Infrastructure"]
        PG[("PostgreSQL 15\nport 5432")]
        RD[("Redis 7\nport 6379")]
        S3[("S3-compatible\nObject Storage")]
        YC_API["Yandex Cloud\nGPT API"]
        SMTP_EXT["SMTP / SendGrid"]
    end

    Client -->|"HTTP / REST"| Gateway
    Client -->|"WebSocket\n(Socket.IO)"| Conversation

    Gateway -->|"/api/users/*\n/api/career/*"| UserProfile
    Gateway -->|"/api/chat/*\n/api/conversations/*\n/socket.io"| Conversation
    Gateway -->|"/api/ai/*"| AINLP
    Gateway -->|"/api/jobs/*"| JobMatching
    Gateway -->|"/api/email/*"| Email

    UP_Auth --> UP_DB
    UP_Profile --> UP_DB
    UP_Career --> UP_DB

    CONV_HTTP --> CONV_Session
    CONV_WS --> CONV_Session
    CONV_Session --> CONV_Redis
    CONV_HTTP --> CONV_Dialogue
    CONV_Dialogue --> CONV_Integration

    CONV_Dialogue -->|"axios POST\nprocess-message\ngenerate-step\nvalidate-answer\nanalyze-profile\ncheck-context\nfree-chat"| AI_API

    AI_API --> AI_Context
    AI_Context --> AI_Redis
    AI_API --> AI_Yandex
    AI_Yandex -->|"HTTPS"| YC_API

    CONV_Integration -->|"axios GET\n/api/jobs/match/:userId"| JM_API
    CONV_Integration -->|"axios POST\n/api/email/send-jobs\n{userId, jobIds}"| EM_API
    CONV_HTTP -->|"axios POST\n/api/report/generate\n{sessionId, userId}"| REP_API

    JM_API --> JM_Matcher
    JM_Matcher --> JM_DB
    JM_Queue --> JM_Scraper
    JM_Scraper --> JM_DB
    JM_API -->|"axios GET\n/api/users/profile"| UP_Profile
    JM_Queue --> JM_Redis
    JM_DB --> PG

    EM_API -->|"axios GET\n/api/users/profile"| UP_Profile
    EM_API -->|"axios GET\n/api/jobs/:jobId"| JM_API
    EM_API --> EM_Template
    EM_Template --> EM_Send
    EM_Send -->|"SMTP/API"| SMTP_EXT

    REP_API --> REP_Gen
    REP_Gen -->|"axios GET\n/api/chat/session/:id"| CONV_HTTP
    REP_Gen --> REP_Storage
    REP_Storage --> S3
    REP_API --> REP_Redis

    UP_DB --> PG
    CONV_Redis --> RD
    AI_Redis --> RD
    JM_Redis --> RD
    REP_Redis --> RD

```

---

## Межсервисные вызовы

| Источник | Назначение | Метод | Endpoint | Когда |
|----------|-----------|-------|----------|-------|
| Conversation | AI/NLP | POST | `/api/ai/generate-step` | Генерация текста вопроса для шага сценария |
| Conversation | AI/NLP | POST | `/api/ai/validate-answer` | Валидация ответа пользователя (Validator Agent) |
| Conversation | AI/NLP | POST | `/api/ai/analyze-profile` | Анализ полноты профиля при завершении диалога |
| Conversation | AI/NLP | POST | `/api/ai/check-context` | Проверка отклонения от темы (Context Manager) |
| Conversation | AI/NLP | POST | `/api/ai/process-message` | Обработка свободного сообщения пользователя |
| Conversation | AI/NLP | POST | `/api/ai/free-chat` | Свободный режим общения |
| Conversation | AI/NLP | POST | `/api/ai/generate-summary` | Генерация саммари сессии |
| Conversation | AI/NLP | POST | `/api/ai/generate-resume` | Генерация резюме на основе профиля |
| User Profile | AI/NLP | POST | `/api/ai/extract-profile-from-resume` | Извлечение структурированных полей из загруженного PDF/DOCX резюме |
| Conversation | Job Matching | GET | `/api/jobs/match/:userId` | При завершении сценария поиска вакансий (IntegrationService) |
| Frontend Admin | Job Matching | GET | `/api/jobs/catalog` | Просмотр каталога вакансий в БД (debug/admin, токен `JOB_CATALOG_TOKEN`) |
| Frontend Admin | Job Matching | GET | `/api/jobs/hh/salary-evaluation/:areaId` | Проверка доступа и ответов HH Salary Bank (debug/admin) |
| Conversation | Email | POST | `/api/email/send-jobs` | Отправка вакансий после подбора (IntegrationService) |
| Conversation | Report | POST | `/api/report/generate` | При завершении сценария PM-интервью |
| Conversation | Report | POST | `/api/report/preview-compute` | Генерация preview-аналитики без PDF для экранных карточек |
| Job Matching | User Profile | GET | `/api/users/profile` | Получение профиля для скоринга вакансий |
| Email | User Profile | GET | `/api/users/profile` | Получение имени и email для персонализации |
| Email | Job Matching | GET | `/api/jobs/:jobId` | Получение деталей вакансий для шаблона письма |
| Report | Conversation | GET | `/api/chat/session/:id` | Получение collectedData сессии для отчёта |
| AI/NLP | Yandex Cloud | POST | YandexGPT API | Каждый запрос к LLM |
| Job Matching | HH.ru | GET | HH.ru API | Фоновый скрейпинг (BullMQ, раз в час) |
| Report | Yandex Object Storage | PUT | S3 API | Загрузка сгенерированного PDF |

---

## Хранение данных

### PostgreSQL

| Таблица | Сервис | Содержимое |
|---------|--------|-----------|
| `jack.users` | User Profile | Учётные записи: email, password_hash, имя, роль |
| `jack.career_profiles` | User Profile | Карьерные данные: желаемая должность, опыт, локация, режим работы |
| `jack.resumes` | User Profile | Загруженные и сгенерированные резюме |
| `jack.skills` | User Profile | Справочник навыков |
| `jack.user_skills` | User Profile | Связи пользователей с навыками |
| `jack.learning_plans` | User Profile | Планы обучения |
| `public.jobs` | Job Matching | Вакансии: название, компания, локация, зарплата, навыки, source_url (UNIQUE) |

### Redis

| Ключ | Сервис | Содержимое | TTL |
|------|--------|-----------|-----|
| `session:{sessionId}` | Conversation | Полное состояние сессии: шаги, collectedData, product, scenarioId | 24 часа |
| `user:{userId}:session` | Conversation | ID активной сессии пользователя | 24 часа |
| `user:{userId}:sessions` | Conversation | Set всех сессий пользователя | 24 часа |
| `ai:nlp:history:{sessionId}` | AI/NLP | История сообщений для контекста YandexGPT | 24 часа |
| `ai:nlp:facts:{sessionId}` | AI/NLP | Извлечённые факты из диалога | 7 дней |
| `report:{reportId}` | Report | Статус генерации PDF (pending/generating/done/error) | 7 дней |
| BullMQ queues | Job Matching | Очередь задач скрейпинга (job-scraping) | -- |

### S3 (Yandex Object Storage)

| Бакет | Сервис | Содержимое |
|-------|--------|-----------|
| `aiheroes-reports` | Report | PDF-отчёты сценария PM-интервью, доступ через signed URLs |

---

## Ключевые потоки данных

### Регистрация и авторизация

```mermaid
sequenceDiagram
    participant B as Browser
    participant UP as User Profile (3001)
    participant PG as PostgreSQL

    B->>UP: POST /api/users/register {email, password, name}
    UP->>PG: INSERT INTO jack.users
    PG-->>UP: user record
    UP-->>B: {token, user}

    B->>UP: POST /api/users/login {email, password}
    UP->>PG: SELECT FROM jack.users WHERE email = ?
    PG-->>UP: user record
    UP->>UP: bcrypt.compare + jwt.sign
    UP-->>B: {token, user}
```

### Сценарий "Поиск вакансий" (сбор профиля)

```mermaid
sequenceDiagram
    participant B as Browser
    participant CV as Conversation (3002)
    participant AI as AI/NLP (3003)
    participant RD as Redis
    participant YG as YandexGPT

    B->>CV: POST /api/chat/session {createNew: true, product: "jack"}
    CV->>RD: SET session:{id} {scenarioId: "jack-profile-v2"}
    CV-->>B: {sessionId, firstMessage}

    loop Каждый шаг сценария
        B->>CV: POST /api/chat/session/:id/message {text}
        CV->>AI: POST /api/ai/check-context {message, topic}
        AI->>YG: YandexGPT API
        YG-->>AI: {onTopic, deviation}
        AI-->>CV: context check result

        CV->>AI: POST /api/ai/validate-answer {answer, stepType}
        AI->>YG: YandexGPT API
        YG-->>AI: {quality, suggestion}
        AI-->>CV: validation result

        alt quality = "good"
            CV->>RD: UPDATE collectedData
            CV->>CV: resolveNextStep (ветвления)
            CV->>AI: POST /api/ai/generate-step {step, context}
            AI->>YG: YandexGPT API
            YG-->>AI: персонализированный текст
            AI-->>CV: generated question
        else quality != "good"
            CV-->>B: уточняющий вопрос (clarify)
        end

        CV-->>B: {message, step, options}
    end

    Note over CV: При завершении — Profile Analyst
    CV->>AI: POST /api/ai/analyze-profile {collectedData}
    AI-->>CV: {completeness, criticalGaps}
```

### Завершение сценария "Поиск вакансий": подбор вакансий и email

```mermaid
sequenceDiagram
    participant CV as Conversation (3002)
    participant JM as Job Matching (3004)
    participant UP as User Profile (3001)
    participant EM as Email (3005)
    participant PG as PostgreSQL
    participant SMTP as SMTP/SendGrid

    Note over CV: Сценарий "Поиск вакансий" завершён (IntegrationService)

    CV->>JM: GET /api/jobs/match/:userId
    JM->>UP: GET /api/users/profile
    UP-->>JM: {profile, preferences}
    JM->>PG: SELECT FROM jobs
    JM->>JM: rule-based scoring (0-100)
    Note over JM: location:25 + experience:20 + skills:30 + role:15 + workMode:10
    JM-->>CV: [{job, score, reasons}]

    CV->>EM: POST /api/email/send-jobs {userId, jobIds}
    EM->>UP: GET /api/users/profile
    UP-->>EM: {name, email}
    EM->>JM: GET /api/jobs/:jobId (для каждой вакансии)
    JM-->>EM: job details
    EM->>EM: Handlebars template rendering
    EM->>SMTP: send email
    SMTP-->>EM: delivery status
    EM-->>CV: {sent: true}
```

### Сценарий "PM-интервью": генерация PDF-отчёта

```mermaid
sequenceDiagram
    participant B as Browser
    participant CV as Conversation (3002)
    participant RP as Report (3007)
    participant RD as Redis
    participant S3 as Yandex Object Storage

    Note over CV: Сценарий "PM-интервью" завершён

    CV->>RP: POST /api/report/generate {sessionId, userId}
    RP->>RD: SET report:{id} status=generating
    RP-->>CV: {reportId, status: "pending"}
    CV-->>B: "Отчёт генерируется..."

    RP->>CV: GET /api/chat/session/:id
    CV-->>RP: {collectedData, messages}

    RP->>RP: Анализ ответов, оценка (1-10), рекомендации
    RP->>RP: Handlebars HTML template
    RP->>RP: Puppeteer: HTML -> PDF

    RP->>S3: PUT pdf file
    S3-->>RP: file URL
    RP->>RD: SET report:{id} status=done, url=signedUrl

    B->>RP: GET /api/report/:id/status
    RP->>RD: GET report:{id}
    RP-->>B: {status: "done", url}

    B->>RP: GET /api/report/:id/download
    RP-->>B: redirect to signed S3 URL
```

### Фоновый скрейпинг вакансий

```mermaid
sequenceDiagram
    participant BQ as BullMQ (cron: hourly)
    participant SC as Scraper Worker
    participant HH as HH.ru API
    participant PG as PostgreSQL

    BQ->>SC: job-scraping task
    SC->>HH: GET /vacancies (API запрос)
    HH-->>SC: список вакансий

    loop Для каждой вакансии
        SC->>PG: INSERT INTO jobs ON CONFLICT (source_url) DO NOTHING
    end

    Note over SC: Retry с экспоненциальной задержкой при ошибках
    Note over SC: Mock-данные через USE_MOCK_JOBS если API недоступен
```

---

## Мультиагентная система (AI/NLP Service)

AI/NLP Service реализует три специализированных агента, работающих через YandexGPT:

| Агент | Endpoint | Назначение | Результат |
|-------|----------|-----------|-----------|
| **Validator** | `/api/ai/validate-answer` | Оценка качества ответа пользователя | `{quality: "good"/"unclear"/"irrelevant", suggestion}` |
| **Profile Analyst** | `/api/ai/analyze-profile` | Анализ полноты собранного профиля | `{completeness, hasGaps, criticalGaps[]}` |
| **Context Manager** | `/api/ai/check-context` | Обнаружение отклонений от темы диалога | `{onTopic, deviation, shouldRedirect, importantInfo}` |

Агенты вызываются из DialogueEngine (Conversation Service) в определённые моменты:
- **Context Manager** — при каждом входящем сообщении
- **Validator** — после проверки контекста, перед сохранением ответа
- **Profile Analyst** — при достижении последнего шага сценария

---

## Сценарии диалога

Conversation Service содержит регистр сценариев с динамической загрузкой:

| Сценарий (UI) | Scenario ID | Шаги | Завершение |
|---------|-------------|------|-----------|
| Поиск вакансий (`product=jack`) | `jack-profile-v2` | Сбор профиля: должность, опыт, навыки, локация, режим работы, зарплата | Job Matching -> Email |
| PM-интервью (`product=wannanew`) | `wannanew-pm-v1` | PM-интервью: уровень, тип продукта, метрики, приоритизация, стейкхолдеры | Report Generation |

Каждый шаг сценария имеет тип: `question`, `info_card` или `command`. Поддерживаются условные ветвления на основе ответов пользователя (числовые, текстовые сравнения, подсчёт элементов).

---

## Деплой и инфраструктура

**Локальная разработка**: Docker Compose поднимает PostgreSQL 15, Redis 7 и опционально pgAdmin. Сервисы запускаются вручную через `npm run dev`. Gateway (nginx/OpenResty) запускается через профиль `--profile gateway`.

**Production**: Yandex Cloud Serverless Containers. Каждый сервис упакован в Docker-контейнер и деплоится как отдельный serverless container. Фронтенд собирается как Static Export и раздаётся из контейнера. WebSocket не поддерживается в serverless-окружении, поэтому production использует исключительно REST API с polling (каждые 3 секунды).

**Переменные окружения**: все сервисы валидируют обязательные переменные при старте. Ключевые группы:
- YandexGPT: `YC_FOLDER_ID`, `YC_API_KEY`, `YC_MODEL_ID`
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_HOST`, `REDIS_PORT`
- S3: `YC_STORAGE_BUCKET`, `YC_STORAGE_ACCESS_KEY`, `YC_STORAGE_SECRET_KEY`, `YC_STORAGE_ENDPOINT`
- Email: `SENDGRID_API_KEY` или SMTP-конфигурация
- Service URLs: `USER_PROFILE_SERVICE_URL`, `CONVERSATION_SERVICE_URL`, `AI_SERVICE_URL` и др.
