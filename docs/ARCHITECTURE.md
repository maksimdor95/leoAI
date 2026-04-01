# Техническая архитектура платформы AIheroes

## Обзор

Платформа AIheroes — это мульти-продуктовая система AI-ассистентов для карьерного развития. 

### Продукты платформы

| Продукт | Описание | Статус |
|---------|----------|--------|
| **Jack (LEO)** | AI-ассистент для поиска работы. Проводит персональные беседы с кандидатами, понимает их предпочтения и отправляет подходящие вакансии. Интегрируется с Jill для прямых интро к менеджерам по найму. | ✅ Production |
| **wannanew** | AI-агент для подготовки Product Manager к собеседованиям. Анализирует опыт кандидата, проводит голосовое пробное интервью, формирует PDF-отчёт с оценкой и рекомендациями. | ✅ MVP + PDF |

### Архитектура мульти-продуктовой системы

Оба продукта используют **общую инфраструктуру**:
- Единый Conversation Service с регистром сценариев
- Общая авторизация (User Profile Service)
- Общий AI/NLP Service (YandexGPT)
- Общий фронтенд с динамическим переключением между продуктами

**Различия между продуктами:**
- Разные сценарии диалога (`jack-profile-v2` vs `wannanew-pm-v1`)
- Разные интеграции при завершении (Job Matching + Email для Jack; Report Generation для wannanew — в разработке)
- Разный брендинг в UI (зелёный для LEO, фиолетовый для wannanew)

## 1. Frontend Layer

### Компоненты

- **Landing Page** - красивый лендинг с регистрацией/входом
  - Hero Section с анимированным заголовком
  - Features Section с преимуществами
  - Auth Section с интегрированными формами
  - Header с навигацией
  - Footer с контактами
- **Chat Interface Component** - основной интерфейс общения с AI
  - Real-time REST API коммуникация (WebSocket для локальной разработки)
  - **Мульти-продуктовая поддержка** (Jack/LEO и wannanew) ✅
  - Динамический брендинг (заголовок, placeholder) в зависимости от продукта
  - Отображение вопросов, ответов, info_card, command
  - История диалога
  - Голосовые индикаторы (STT/TTS)
  - Поддержка команд (повторить вопрос, изменить ответ, пауза)
  - Навигация к списку чатов (кнопка "Мои чаты")
- **Chats List Component** - список всех чатов пользователя
  - Отображение всех чатов с превью
  - **Метки продукта** на каждом чате (LEO — зелёная, wannanew — фиолетовая) ✅
  - **Единая кнопка «Новый чат»** с выбором продукта внутри чата ✅
  - Открытие существующего чата для продолжения диалога
  - Удаление чатов с подтверждением
  - Информация о последнем сообщении и дате обновления
- **Product Selection Screen** - экран выбора продукта при создании нового чата ✅
  - Приветственное сообщение от LEO
  - Две кнопки выбора: «Подбор вакансий» и «Подготовка к собеседованию»
  - Плавные переходы и анимации
- **User Profile Management** - управление профилем кандидата
- **Job Listings View** - отображение подобранных вакансий (планируется)
- **Application Helper** - помощь с заявками и подготовкой к интервью (планируется)
- **Voice Input/Output** - голосовое взаимодействие (STT/TTS) ✅
  - Реализовано через Web Speech API (распознавание и синтез)
  - Поддержка русского языка (ru-RU)
  - Интеграция с кнопками управления (Mute/Pause)

### Технологии

- Next.js 14 (App Router) с Static Export для Serverless
- TypeScript
- React 18
- **REST API клиент** для чат-коммуникации (chatApi.ts) ✅
- Socket.io client для локальной разработки (chatSocket.ts)
- Ant Design 5 для UI компонентов
- Tailwind CSS для стилизации
- Цветовая палитра: темная тема (#050913) с зелеными акцентами (#22c55e)

**Особенности для Serverless**:

- Статический экспорт Next.js (`output: 'export'`)
- REST API вместо WebSocket для совместимости с Yandex Serverless Containers
- Автоматический polling для получения новых сообщений (каждые 3 секунды)

### Дизайн

- **Цветовая палитра**: Темная тема из чата
  - Фон: `#050913` (темно-синий)
  - Текст: белый и `slate-300`
  - Акценты: `green-500` для кнопок
  - Полупрозрачные элементы: `bg-white/[0.04]`, `border-white/10`
- **Сообщения в стиле Telegram**:
  - LEO (слева): серый фон (`bg-white/10`) с закругленным левым верхним углом
  - Пользователь (справа): голубой фон (`bg-blue-500/20`) без подписи "Я"
  - Компактные размеры (`max-w-[240px]`) с меньшим шрифтом
- **Анимации**: Плавные переходы, градиенты, плавающие частицы
- **Стиль**: Современный минималистичный дизайн в стиле wearestokt.com
- **Адаптивность**: Гибкая сетка (`grid-cols-[minmax(500px,1fr)_320px]`) для корректного отображения на разных экранах

## 2. API Gateway

### Функции

- Authentication/Authorization
- Rate Limiting
- Request Routing
- Load Balancing
- Request/Response трансформация

### Технологии

- Kong, Envoy, или AWS API Gateway

## 3. Backend Services (Microservices Architecture)

### 3.1. Conversation Service

**Назначение**: Управление сессиями диалогов и чат-коммуникацией

**Функции**:

- **REST API для чата** (основной метод для Serverless) ✅
- WebSocket Server для real-time коммуникации (Socket.io) - для локальной разработки
- Session Management (создание, поддержание, завершение, удаление сессий)
- **Мульти-продуктовая поддержка** (Jack/LEO и wannanew) ✅
- **Регистр сценариев** с динамической загрузкой ✅
- Dialogue Engine с сценарным движком
- Система ветвлений (conditional branching) на основе ответов пользователя
- Поддержка типов шагов: `question`, `info_card`, `command`
- Обработка команд (repeat_question, edit_last_answer, pause, resume)
- Мультиагентная система (интеграция с Validator, Profile Analyst, Context Manager)
- Conversation History Storage (сохранение истории диалогов)
- Chat Management (список чатов, удаление с подтверждением)
- **Условная логика интеграций** (Job Matching только для Jack) ✅

**Технологии**:

- Node.js (TypeScript) с Express
- Socket.io (для локальной разработки)
- Redis для session storage и состояния диалога
- TypeScript для типизации

**Хранение сессий**:

- Каждая сессия хранится в Redis с ключом `session:${sessionId}`
- Активная сессия пользователя хранится в `user:${userId}:session`
- Список всех сессий пользователя хранится в `user:${userId}:sessions` (Redis Set)
- TTL сессий: 24 часа

**Мульти-продуктовая архитектура** ✅:

Сессии содержат поле `product` (`jack` | `wannanew`) и `scenarioId`, определяющие поведение диалога:

| Product | Scenario ID | Описание |
|---------|-------------|----------|
| `jack` | `jack-profile-v2` | Сбор профиля для поиска работы |
| `wannanew` | `wannanew-pm-v1` | Подготовка PM к собеседованиям |

**Регистр сценариев** (`dialogueEngine.ts`):

```typescript
const SCENARIOS: Record<string, ScenarioDefinition> = {
  'jack-profile-v2': JACK_SCENARIO,
  'wannanew-pm-v1': WANNANEW_SCENARIO,
};
```

- `getScenario(scenarioId)` — получить сценарий по ID
- `getStep(scenarioId, stepId)` — получить шаг из конкретного сценария
- `getScenarioIdByProduct(product)` — маппинг продукта на сценарий

**Условная логика при завершении диалога**:

- **Jack**: вызывается Job Matching → Email Notification
- **wannanew**: вызывается Report Service для генерации PDF-отчёта ✅

**REST API Endpoints (для Serverless/Production)** ✅:

- `POST /api/chat/session` - создать или получить сессию
  - Body: `{ createNew?: boolean, sessionId?: string, product?: 'jack' | 'wannanew' }`
  - При `createNew: true` создаётся новая сессия с указанным `product` (по умолчанию `jack`)
- `GET /api/chat/session/:id` - получить сессию с историей сообщений
- `POST /api/chat/session/:id/message` - отправить сообщение в чат
- `POST /api/chat/session/:id/command` - выполнить команду в чате
- `GET /api/conversations` - получить список всех чатов пользователя
  - Response включает `product` и `scenarioId` для каждого чата
- `DELETE /api/conversations/:id` - удалить чат

**WebSocket Endpoints (для локальной разработки)**:

- `WS /socket.io` - Socket.io endpoint для real-time коммуникации

**Примечание**: В Yandex Serverless Containers WebSocket не поддерживается, поэтому используется REST API с polling на клиенте. Socket.io оставлен для локальной разработки.

**Типы шагов сценария**:

- `question` - вопрос для пользователя
- `info_card` - информационная карточка (profile_snapshot, skills_help)
- `command` - команды для пользователя (повторить вопрос, изменить ответ)

**Ветвления**:

- Условные переходы на основе ответов пользователя
- Поддержка числовых, текстовых сравнений и подсчета элементов
- Примеры: приветствие → pause_reminder, опыт → junior_intro/senior_deep_dive, локация → relocation/hybrid_details

**Мультиагентная система**:

- Интеграция с Validator Agent для валидации ответов
- Интеграция с Profile Analyst Agent для анализа полноты профиля
- Интеграция с Context Manager Agent для отслеживания отклонений от темы

---

### 3.2. AI/NLP Service

**Назначение**: Обработка естественного языка и генерация ответов от Jack

**Функции**:

- LLM Integration (YandexGPT)
- Генерация вопросов для шагов сценария
- Мультиагентная система:
  - **Validator Agent** - валидация качества ответов пользователя
  - **Profile Analyst Agent** - анализ полноты профиля
  - **Context Manager Agent** - отслеживание отклонений от темы
- Personality Engine (реализация характера Jack как карьерного коуча)
- Response Generation (генерация эмпатичных ответов)
- Preference Extraction (извлечение предпочтений кандидата)

**Технологии**:

- Node.js (TypeScript) с Express
- YandexGPT API (Yandex Cloud AI Studio)
- TypeScript для типизации

**API Endpoints**:

- `POST /api/ai/generate-step` - генерация текста вопроса для шага сценария
- `POST /api/ai/validate-answer` - валидация ответа пользователя (Validator Agent)
- `POST /api/ai/analyze-profile` - анализ полноты профиля (Profile Analyst Agent)
- `POST /api/ai/check-context` - проверка отклонений от темы (Context Manager Agent)

**Мультиагентная система**:

**Validator Agent**:

- Оценивает качество ответов: `good`, `unclear`, `irrelevant`
- Предоставляет конкретные подсказки для уточнения
- Предварительная валидация: пустые ответы, слишком короткие ответы
- Специальная логика для разных типов вопросов (опыт, отрасли, должности)

**Profile Analyst Agent**:

- Анализирует полноту собранного профиля
- Выявляет критические пробелы (desiredRole, totalExperience, location)
- Определяет готовность профиля для подбора вакансий
- Выявляет противоречия в данных

**Context Manager Agent**:

- Проверяет, на тему ли ответ пользователя
- Обнаруживает отклонения от текущей темы диалога
- Извлекает важную информацию из ответа
- Предоставляет подсказки для мягкого возврата к теме

**Особенности**:

- Поддержка длинного контекста (несколько раундов диалога)
- Извлечение структурированных данных из неструктурированного диалога
- Эмпатичный тон общения (как карьерный коуч, а не бот)
- Fallback механизмы при недоступности AI/NLP Service
- Robust JSON parsing для ответов YandexGPT

---

### 3.3. User Profile Service

**Назначение**: Управление профилями и данными кандидатов

**Функции**:

- User Registration/Authentication (JWT/OAuth)
- Profile Management (CRUD операции)
- Preference Extraction и хранение
- Skills & Experience Tracking
- Career Goals Storage
- Resume/CV Management

**Технологии**:

- Node.js/Python (FastAPI, Express)
- PostgreSQL для хранения профилей
- Redis для кеширования

**API Endpoints**:

- `POST /api/users/register` - регистрация
- `POST /api/users/login` - авторизация
- `GET /api/users/:userId` - получить профиль
- `PUT /api/users/:userId` - обновить профиль
- `GET /api/users/:userId/preferences` - получить предпочтения

**Data Model**:

```json
{
  "userId": "uuid",
  "email": "string",
  "preferences": {
    "location": ["string"],
    "salary": { "min": number, "currency": "string" },
    "companySize": "string",
    "industry": ["string"],
    "workMode": "string",
    "techStack": ["string"]
  },
  "skills": ["string"],
  "experience": [{
    "title": "string",
    "company": "string",
    "duration": "string",
    "description": "string"
  }],
  "careerGoals": "string",
  "resume": "url"
}
```

---

### 3.4. Job Matching Service

**Назначение**: Поиск, агрегация и подбор вакансий для кандидатов

**Функции**:

- Job Scraper/Crawler (планируется: 10,000 новых вакансий каждый час)
- Job Aggregation из различных источников
- Matching Algorithm (сопоставление вакансий с профилем)
- Ranking Engine (ранжирование по релевантности)
- Job Quality Filter (фильтрация некачественных вакансий)

**Технологии**:

- Node.js (TypeScript) с Express ✅
- PostgreSQL для хранения вакансий ✅
- Redis для очередей (BullMQ) ✅
- BullMQ для фоновых задач скрейпинга ✅
- Vector DB для семантического поиска (планируется)
- ML модели для ранжирования (планируется)

**API Endpoints**:

- `GET /api/jobs/match/:userId` - получить подходящие вакансии (требует JWT) ✅
- `POST /api/jobs/refresh` - запустить скрейпинг вручную (требует JWT) ✅
- `GET /api/jobs/:jobId` - получить детали вакансии ✅

**Интеграции**:

- HeadHunter.ru API (поддержка, требует API ключ) ✅
- Mock данные для MVP тестирования ✅
- Job boards API (LinkedIn Jobs, Indeed, Glassdoor) - планируется
- Company websites (парсинг) - планируется

**Matching Algorithm (MVP)**:

- **Rule-based matching** с scoring (0-100 баллов): ✅
  - Локация: 25 баллов
  - Опыт (experience_level): 20 баллов
  - Навыки (skills matching): 30 баллов
  - Желаемая должность (desiredRole): 15 баллов
  - Режим работы (workMode): 10 баллов
- Фильтрация вакансий с score < 30 ✅
- Сортировка по score (убывание) ✅
- Объяснения причин матчинга (reasons) ✅
- Vector similarity search (embeddings) - планируется
- ML-based ranking - планируется

**Хранение данных**:

- Таблица `jobs` в PostgreSQL со всеми необходимыми полями ✅
- Индексы для оптимизации поиска (location, skills, work_mode, experience_level) ✅
- Дедупликация по `source_url` (UNIQUE constraint) ✅

**Фоновые задачи**:

- Очередь скрейпинга через BullMQ (каждый час) ✅
- Worker для обработки задач скрейпинга ✅

---

### 3.5. Email Notification Service

**Назначение**: Отправка персонализированных email с вакансиями

**Функции**:

- Email Template Engine (динамические шаблоны) ✅
- Personalization Engine (персонализация под каждого кандидата) ✅
- SendGrid Integration ✅
- Email Scheduling (планирование отправки) - опционально для MVP
- Delivery Tracking (отслеживание доставки) - планируется

**Технологии**:

- Node.js (TypeScript) с Express ✅
- SendGrid API ✅
- Handlebars для шаблонов ✅

**API Endpoints**:

- `POST /api/email/send-jobs` - отправить подборку вакансий (требует JWT) ✅
- `POST /api/email/send-welcome` - отправить welcome email (требует JWT) ✅
- `GET /api/email/status/:emailId` - статус отправки (планируется)

**Email Templates**:

- `welcome-email.html` - приветственное письмо для новых пользователей ✅
  - Красивый HTML дизайн
  - Персонализация имени пользователя
  - Описание функций Jack
  - Кнопка "Начать диалог"
- `jobs-digest.html` - подборка вакансий с персонализацией ✅
  - Карточки вакансий с деталями (компания, локация, зарплата)
  - Показ matching score и объяснений
  - Кнопки для перехода к вакансиям
  - Адаптивный дизайн

**Email Features**:

- Персонализированное объяснение, почему вакансия подходит ✅
- Не выглядит как автоматическая рассылка ✅
- Красивый дизайн (HTML templates) ✅
- Персонализация имени пользователя ✅
- Unsubscribe функциональность (планируется)

**Интеграции**:

- User Profile Service (получение профиля пользователя) ✅
- Job Matching Service (получение деталей вакансий) ✅

---

### 3.6. Report Service (NEW)

**Назначение**: Генерация PDF-отчётов для wannanew (подготовка PM к собеседованиям)

**Функции**:

- **Сбор данных сессии** — получение collectedData из Conversation Service ✅
- **Генерация контента отчёта** — анализ ответов, оценка, рекомендации ✅
- **PDF-генерация** — HTML-шаблон → PDF через Puppeteer ✅
- **Облачное хранилище** — загрузка в Yandex Object Storage ✅
- **Signed URLs** — безопасные ссылки для скачивания ✅

**Технологии**:

- Node.js (TypeScript) с Express
- Puppeteer для генерации PDF
- Handlebars для HTML-шаблонов
- AWS SDK S3 (совместим с Yandex Object Storage)
- Redis для хранения статуса генерации

**API Endpoints**:

- `POST /api/report/generate` — запустить генерацию отчёта
  - Body: `{ sessionId, userId }`
  - Response: `{ reportId, status: 'pending' | 'generating' }`
- `GET /api/report/:reportId/status` — получить статус генерации
  - Response: `{ reportId, status, url?, error? }`
- `GET /api/report/:reportId/download` — скачать PDF (redirect на signed URL)

**Структура PDF-отчёта**:

1. Заголовок с данными кандидата
2. Профиль PM (целевой уровень, тип продукта)
3. Общая оценка (1-10)
4. Оценка по категориям (Приоритизация, Метрики, Стейкхолдеры)
5. Сильные стороны и зоны роста
6. Рекомендации по подготовке
7. Типовые вопросы под уровень PM

**Интеграции**:

- Conversation Service — получение данных сессии
- Yandex Object Storage — хранение PDF-файлов

**Переменные окружения**:

```env
REPORT_SERVICE_URL=http://localhost:3007
YC_STORAGE_BUCKET=aiheroes-reports
YC_STORAGE_ACCESS_KEY=...
YC_STORAGE_SECRET_KEY=...
YC_STORAGE_ENDPOINT=https://storage.yandexcloud.net
```

---

### 3.8. Application Helper Service

**Назначение**: Помощь кандидатам с заявками и подготовкой

**Функции**:

- Resume Analysis (анализ резюме)
- Cover Letter Generator (генерация сопроводительных писем)
- Interview Prep (подготовка к собеседованиям)
- Application Tracking (отслеживание статуса заявок)
- Follow-up Reminders (напоминания о follow-up)

**Технологии**:

- Python (для анализа резюме)
- LLM для генерации текстов
- PostgreSQL для хранения заявок

**API Endpoints**:

- `POST /api/application/analyze-resume` - анализ резюме
- `POST /api/application/generate-cover-letter` - генерация письма
- `POST /api/application/prepare-interview` - подготовка к интервью
- `GET /api/application/:userId/tracking` - отслеживание заявок

---

### 3.9. Referral/Intro Service

**Назначение**: Интеграция с Jill для прямых интро к менеджерам по найму

**Функции**:

- Connection to Jill Service (internal API)
- Candidate Introduction (передача кандидата в Jill)
- Hiring Manager Matching (сопоставление с менеджерами)
- Intro Workflow Management (управление процессом интро)

**Технологии**:

- Node.js/Python
- Internal API calls to Jill service

**API Endpoints**:

- `POST /api/referral/introduce` - сделать интро кандидата
- `GET /api/referral/status/:introId` - статус интро
- `GET /api/referral/:userId/history` - история интро

---

## 4. Data Layer

### 4.1. PostgreSQL (Primary Database)

**Хранит**:

- User profiles и preferences
- Job listings (структурированные данные)
- Application history
- Conversation metadata
- Referral history

**Schemas**:

- `users` - профили пользователей
- `jobs` - вакансии
- `applications` - заявки
- `conversations` - метаданные диалогов
- `referrals` - интро к компаниям

### 4.2. Redis (Cache & Session Storage)

**Хранит**:

- Session cache (активные сессии)
- Conversation state (текущее состояние диалога)
- Rate limiting counters
- Frequently accessed data (hot cache)

**TTL**: Зависит от типа данных (сессии: 24ч, кеш: 1ч)

### 4.3. Vector Database (Pinecone/Weaviate/Qdrant)

**Хранит**:

- Job embeddings (векторные представления вакансий)
- User preference embeddings (векторные представления предпочтений)
- Resume embeddings (для семантического поиска)

**Использование**:

- Semantic search (поиск похожих вакансий)
- Similarity matching (сопоставление вакансий с профилем)

### 4.4. Time Series Database (InfluxDB - optional)

**Хранит**:

- Job scraping metrics (количество найденных вакансий)
- User engagement analytics (активность пользователей)
- API performance metrics
- Error rates

---

## 5. Background Jobs & Queue System

### Job Queue (Celery/BullMQ/RabbitMQ)

**Типы задач**:

1. **Job Scraping Jobs** (каждый час)
   - Запуск скрейперов для всех источников
   - Парсинг новых вакансий
   - Обработка и нормализация данных
   - Векторизация вакансий

2. **Job Matching Jobs** (batch processing)
   - Матчинг новых вакансий с активными пользователями
   - Ранжирование результатов
   - Генерация персонализированных рекомендаций

3. **Email Sending Jobs**
   - Отправка email с вакансиями
   - Персонализация контента
   - Retry логика для failed sends

4. **Profile Updates**
   - Обновление профилей на основе новых диалогов
   - Пересчет предпочтений
   - Обновление embeddings

5. **Analytics Aggregation**
   - Сбор метрик
   - Генерация отчетов
   - Обновление дашбордов

**Технологии**:

- Celery (Python) или BullMQ (Node.js)
- Redis/RabbitMQ как message broker

---

## 6. External Integrations

### LLM APIs

- **YandexGPT** - основной LLM для диалогов и агентов
  - Модель: `foundation-models/yandexgpt` (рекомендуется) или `yandexgpt-pro`
  - Контекст: 32,000 токенов
  - API: Yandex Cloud AI Studio
  - Используется для:
    - Генерации вопросов для шагов сценария
    - Валидации ответов пользователя (Validator Agent)
    - Анализа полноты профиля (Profile Analyst Agent)
    - Проверки отклонений от темы (Context Manager Agent)
- **Embedding APIs** - для создания векторных представлений (планируется)

### Job Board APIs

- **LinkedIn Jobs API** (если доступен)
- **Indeed API**
- **Glassdoor API**
- **Custom scrapers** для других источников

### Email Services

- **SendGrid** - основной email сервис
- **Mailgun** - альтернатива
- **AWS SES** - для масштабирования

### Voice APIs ✅

- **Web Speech API** - основной механизм для STT и TTS (бесплатно, работает в браузере) ✅
- **Yandex SpeechKit** - планируется для премиального синтеза речи (генерация голоса Jack)
- **Google Speech-to-Text** - альтернатива для голосового ввода (планируется)
- **ElevenLabs** - для генерации голоса Jack (альтернатива)

### Calendar APIs

- **Google Calendar** - для планирования интервью
- **Calendly** - интеграция для booking

### Jill Service API (internal)

- **Internal REST API** - для передачи кандидатов в Jill
- Authentication через service-to-service tokens

---

## 7. Infrastructure

### Container Orchestration

- **Kubernetes** - оркестрация контейнеров
- **Docker** - контейнеризация сервисов
- **Helm Charts** - управление K8s deployments

### Cloud Provider

- **AWS** или **GCP**
  - EC2/GCE для compute
  - RDS/Cloud SQL для PostgreSQL
  - ElastiCache/Cloud Memorystore для Redis
  - S3/Cloud Storage для файлов (резюме, документы)

### Auto-scaling

- **Horizontal Pod Autoscaler** (K8s) - автоматическое масштабирование
- **Based on**: CPU, memory, queue length, request rate

### CDN

- **Cloudflare** - для статического контента
- **Caching** - для API responses где возможно

### Monitoring & Observability

- **Prometheus** - сбор метрик
- **Grafana** - визуализация метрик
- **DataDog/New Relic** - APM и мониторинг
- **ELK Stack** (Elasticsearch, Logstash, Kibana) - логирование
- **Sentry** - отслеживание ошибок

### CI/CD

- **GitHub Actions** или **GitLab CI**
- **Automated testing** перед деплоем
- **Blue-Green deployment** для zero-downtime

---

## 8. Data Flow Diagrams

### 8.1. Первичная регистрация и знакомство

```
User (Frontend)
    ↓
API Gateway (Auth)
    ↓
User Profile Service
    ↓
PostgreSQL (save user)
    ↓
Conversation Service (start session)
    ↓
AI/NLP Service (first greeting)
    ↓
Frontend (display Jack's message)
    ↓
User responds
    ↓
AI/NLP Service (extract preferences)
    ↓
User Profile Service (update preferences)
    ↓
Vector DB (create embeddings)
```

### 8.2. Диалог с Jack (с мультиагентной системой)

```
User (chat message)
    ↓
WebSocket → Conversation Service
    ↓
Dialogue Engine (handleUserReply)
    │
    ├─→ Context Manager Agent (проверка отклонений)
    │   └─→ POST /api/ai/check-context
    │       └─→ YandexGPT → { onTopic, deviation, shouldRedirect, importantInfo }
    │
    ├─→ Validator Agent (валидация ответа)
    │   └─→ POST /api/ai/validate-answer
    │       └─→ YandexGPT → { quality, reason, suggestion }
    │       └─→ Если quality !== 'good' → переход на шаг 'clarify'
    │
    ├─→ Сохранение ответа в collectedData (Redis)
    │
    ├─→ Разрешение следующего шага (resolveNextStep)
    │   ├─→ Проверка условий ветвления
    │   ├─→ Обработка типов шагов (question, info_card, command)
    │   └─→ Определение nextStepId
    │
    ├─→ Генерация текста вопроса (если нужно)
    │   └─→ POST /api/ai/generate-step
    │       └─→ YandexGPT → персонализированный текст вопроса
    │
    ├─→ Profile Analyst Agent (при завершении диалога)
    │   └─→ POST /api/ai/analyze-profile
    │       └─→ YandexGPT → { completeness, hasGaps, criticalGaps }
    │       └─→ Если hasGaps → переход на шаг 'completion_gap'
    │
    └─→ WebSocket → Frontend (display response)
        ├─→ QuestionMessage (для question)
        ├─→ InfoCardMessage (для info_card)
        └─→ CommandMessage (для command)
```

### 8.3. Поиск и отправка вакансий

```
Background Job (Scheduler)
    ↓
Job Scraper Service
    ├─→ LinkedIn Jobs
    ├─→ Indeed
    ├─→ Company websites
    └─→ Other sources
    ↓
Job Matching Service
    ├─→ Vector DB (semantic search)
    ├─→ User Profile (preferences)
    └─→ Matching Algorithm
    ↓
Ranking Engine
    ↓
Email Notification Service
    ├─→ Generate personalized email
    ├─→ Template engine
    └─→ SendGrid API
    ↓
User Email Inbox
```

### 8.4. Интро к менеджерам по найму

```
User expresses interest in job
    ↓
Application Helper Service
    ↓
Referral/Intro Service
    ↓
Internal API call to Jill Service
    ├─→ Send candidate profile
    ├─→ Send job details
    └─→ Request intro
    ↓
Jill Service processes
    ↓
Hiring Manager receives intro
    ↓
Status update back to User
```

---

## 9. Security & Compliance

### Authentication & Authorization

- **JWT tokens** для user authentication
- **OAuth 2.0** для социальных сетей (optional)
- **Service-to-service** authentication для внутренних API
- **Rate limiting** для предотвращения злоупотреблений

### Data Protection

- **Encryption at rest** (базы данных)
- **Encryption in transit** (HTTPS, TLS)
- **GDPR compliance** - возможность удаления данных
- **PII handling** - защита персональных данных

### API Security

- **API keys** для внешних интеграций
- **CORS** настройки
- **Input validation** и sanitization
- **SQL injection** prevention

---

## 10. Scalability Considerations

### Horizontal Scaling

- Все сервисы stateless (кроме очередей)
- Load balancing через API Gateway
- Database connection pooling
- Read replicas для PostgreSQL

### Caching Strategy

- Redis для hot data
- CDN для статики
- API response caching где возможно
- Database query caching

### Performance Optimization

- Async processing для тяжелых задач
- Batch processing для matching
- Lazy loading для больших данных
- Pagination для списков

---

## 11. Technology Stack Summary

### Frontend

- React/Next.js (Static Export для Serverless)
- TypeScript
- Tailwind CSS
- **REST API client** (chatApi.ts) для чат-коммуникации в Production
- Socket.io client для локальной разработки
- Axios для HTTP requests

### Backend

- **Node.js** (Express/Fastify) или **Python** (FastAPI)
- TypeScript/Python
- Microservices architecture

### AI/ML

- LangChain или LlamaIndex
- OpenAI API / Anthropic Claude
- Vector embeddings (OpenAI embeddings или sentence-transformers)

### Databases

- PostgreSQL (primary)
- Redis (cache/sessions)
- Vector DB (Pinecone/Weaviate/Qdrant)
- InfluxDB (optional, для метрик)

### Infrastructure

- Kubernetes
- Docker
- AWS/GCP
- Terraform (Infrastructure as Code)

### Monitoring

- Prometheus + Grafana
- ELK Stack
- Sentry
- DataDog/New Relic

---

## 12. Особенности реализации

### 1. Персонализация

- Использование векторных embeddings для семантического поиска
- ML модели для ранжирования вакансий
- Персонализированные объяснения в email

### 2. Масштабирование

- Асинхронные очереди для тяжелых операций
- Batch processing для matching
- Horizontal scaling всех сервисов

### 3. Память и контекст

- Redis для активных сессий
- PostgreSQL для долгосрочного хранения
- Vector DB для семантического поиска

### 4. Интеграция с Jill

- Внутренний API для передачи кандидатов
- Service-to-service authentication
- Shared data models

### 5. Персонаж Jack

- Fine-tuned промпты для нужного тона
- Context management для поддержания личности
- Эмпатичные ответы (как карьерный коуч)

### 6. UX и интерфейс

- Telegram-стиль сообщений (LEO слева, пользователь справа)
- Адаптивная сетка с минимальной шириной 500px для основного блока
- Упрощенный интерфейс без лишних элементов
- Подтверждение критических действий (удаление чатов)
- Голубоватая цветовая схема для сообщений пользователя
- Автоматическое перенаправление после регистрации в чат

---

## 13. Конфигурация и рефакторинг

### 13.1. Конфигурация сервисов

Все сервисы используют централизованную конфигурацию через переменные окружения. Подробное руководство по конфигурации см. в `docs/CONFIGURATION.md`.

**Ключевые особенности:**

- ✅ **Валидация конфигурации** - все сервисы проверяют обязательные переменные при старте
- ✅ **Подробные сообщения об ошибках** - понятные ошибки при отсутствии конфигурации
- ✅ **Production-ready** - разделение конфигурации для development и production
- ✅ **Документация** - полное описание всех переменных в `env.example` и `docs/CONFIGURATION.md`

**Основные переменные окружения:**

- YandexGPT: `YC_FOLDER_ID`, `YC_API_KEY`, `YC_MODEL_ID`
- SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- Database: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Job Scraping: `HH_API_KEY`, `USE_MOCK_JOBS`
- Service URLs: `USER_PROFILE_SERVICE_URL`, `CONVERSATION_SERVICE_URL`, и т.д.

### 13.2. Завершенный рефакторинг

**Этап 1: Конфигурация и переменные окружения** ✅

- ✅ Обновлен `env.example` со всеми переменными и комментариями
- ✅ Добавлена валидация конфигурации для каждого сервиса
- ✅ Создана документация `docs/CONFIGURATION.md`
- ✅ Создана документация `docs/DEPLOYMENT.md`

**Этап 2: Рефакторинг Job Matching Service** ✅

- ✅ Mock данные сделаны опциональными через `USE_MOCK_JOBS`
- ✅ Улучшена логика fallback (только если все источники недоступны)
- ✅ Добавлено логирование использования mock данных
- ✅ Добавлена retry логика для внешних API с экспоненциальной задержкой

**Этап 3: Улучшение обработки ошибок** ✅

- ✅ Создана централизованная обработка ошибок для всех сервисов
- ✅ Стандартизирован формат ошибок (ApplicationError класс)
- ✅ Добавлено логирование ошибок с контекстом
- ✅ Добавлен async handler wrapper для безопасной обработки async роутов

**Этап 4: Health Checks** ✅

- ✅ Расширены health endpoints с проверкой зависимостей
- ✅ Добавлена проверка DB, Redis и внешних API
- ✅ Возвращается детальная информация о состоянии сервиса
- ✅ Поддержка readiness/liveness probes для Kubernetes

**Этап 5: Качество кода** ✅

- ✅ Удалены TODO комментарии
- ✅ Улучшена типизация (убраны все `any` типы)
- ✅ Добавлены типы для PostgreSQL rows и Socket.io auth
- ✅ Улучшена обработка ошибок в скрейпере с retry логикой

### 13.3. Архитектурные улучшения

**Обработка ошибок:**

- Централизованный error handler middleware
- Стандартизированный формат ответов об ошибках
- Разделение операционных и системных ошибок
- Детальное логирование для debugging

**Health Checks:**

- Проверка состояния всех зависимостей (DB, Redis, внешние API)
- Метрики производительности (response time)
- Статус сервиса: `ok`, `degraded`, `down`
- Готовность к Kubernetes probes

**Job Scraping:**

- Retry логика с экспоненциальной задержкой
- Проверка retryable ошибок (network, timeouts, 5xx)
- Детальное логирование источников данных
- Контроль использования mock данных

**Типизация:**

- Строгая типизация TypeScript
- Интерфейсы для всех внешних зависимостей
- Типы для database rows
- Типы для Socket.io authentication

---

## 14. Будущие улучшения

### Общие улучшения платформы
- **Premium Voice interface** - интеграция Yandex SpeechKit/ElevenLabs для более естественного звучания
- **Mobile app** - нативные приложения iOS/Android
- **Advanced analytics** - детальная аналитика для кандидатов
- **Community features** - форумы, группы, networking

### Jack (LEO)
- **Career coaching** - расширенный карьерный коучинг
- **AI resume builder** - автоматическое создание резюме

### wannanew
- ✅ **PDF-отчёт** - генерация отчёта с оценкой и рекомендациями (Report Service)
- ✅ **Единая точка входа** - выбор продукта внутри чата
- **Загрузка резюме** - парсинг PDF/DOCX файлов
- **Расширенное интервью** - больше вопросов, follow-up логика
- **Gap Analysis Agent** - анализ пробелов в профиле PM
- **Interview simulation** - полноценная симуляция интервью с AI
- **Другие профессии** - масштабирование на другие роли (Designer, Engineer, etc.)
