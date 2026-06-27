# LEOWORK AI — B2B-платформа для работодателей

*Версия документа: 1.0 | 2026-06-17*
*Ветка разработки: `feature/leowork-b2b`*
*Статус: PRE-DEVELOPMENT*

---

## Содержание

1. [Концепция продукта](#1-концепция-продукта)
2. [Бизнес-модель и монетизация](#2-бизнес-модель-и-монетизация)
3. [Системная архитектура](#3-системная-архитектура)
4. [Модель данных (PostgreSQL)](#4-модель-данных-postgresql)
5. [Авторизация по ключу доступа](#5-авторизация-по-ключу-доступа)
6. [AI-скрининг кандидатов (обратный матчинг)](#6-ai-скрининг-кандидатов-обратный-матчинг)
7. [Система интродукций](#7-система-интродукций)
8. [Consent Flow (согласие кандидата)](#8-consent-flow-согласие-кандидата)
9. [Frontend: B2B-кабинет](#9-frontend-b2b-кабинет)
10. [Аналитика и дашборд](#10-аналитика-и-дашборд)
11. [Дорожная карта разработки](#11-дорожная-карта-разработки)
12. [Переиспользование существующего кода](#12-переиспользование-существующего-кода)
13. [Изоляция от B2C-части](#13-изоляция-от-b2c-части)
14. [Адаптация под российский рынок](#14-адаптация-под-российский-рынок)
15. [Риски и митигация](#15-риски-и-митигация)

---

## 1. Концепция продукта

### Двусторонняя модель LEO AI

```
┌─────────────────────────────┐          ┌─────────────────────────────┐
│        LEO AI (B2C)         │          │     LEOWORK AI (B2B)        │
│   для кандидатов — бесплатно│          │ для работодателей — платно  │
│   🟢 зелёная палитра       │          │ 🔵 синяя палитра            │
│                             │          │                             │
│  • Карьерный коучинг        │  интро   │  • AI-скрининг кандидатов   │
│  • Подготовка к интервью    │ ───────► │  • Тёплые интродукции       │
│  • Поиск вакансий           │          │  • Воронка найма            │
│  • Зарплатные бенчмарки     │ ◄─────── │  • Аналитика и метрики      │
│                             │  оплата  │  • Биллинг (success fee)    │
│  ✓ ЕСТЬ — база растёт      │          │  ← СТРОИТЬ — здесь деньги  │
└─────────────────────────────┘          └─────────────────────────────┘
```

### Суть LEOWORK AI

LEOWORK AI — это AI-рекрутер, работающий на стороне работодателя. Работодатель описывает роль — LEOWORK за минуты находит подходящих кандидатов из базы LEO AI, генерирует персонализированные описания и организует тёплые интродукции.

### Аналог на рынке

[Jack & Jill](https://jackandjill.ai/) — London/SF, $20M seed (Creandum), 256K кандидатов, 2000 клиентов. Jack (бесплатный AI-агент для кандидатов) + Jill (платный AI-рекрутер для компаний, 10% от годовой ЗП). LEOWORK AI — российский аналог Jill.

### Конкурентное преимущество

LEO AI уже собирает данные, **недоступные из резюме**:
- Карьерные цели и мотивация (из диалога)
- Зарплатные ожидания и готовность к торгу
- Предпочтения по культуре компании и формату работы
- Сильные/слабые стороны (из mock-интервью)
- Степень "горячести" — активно ищет vs пассивно открыт

Работодатель получает не просто резюме, а **глубокий контекст** о кандидате.

---

## 2. Бизнес-модель и монетизация

### Ценообразование

| Параметр | Значение |
|----------|----------|
| Модель | Success fee (оплата за результат) |
| Ставка | 8–10% от годовой ЗП при успешном найме |
| Средний чек (РФ IT) | 150 000–360 000 ₽ (при ЗП 150–300K/мес) |
| Гарантия | 3 месяца — полный возврат, если кандидат ушёл |
| Подписка | Нет на старте. Опция SaaS (30–50K ₽/мес + сниженный %) — Фаза 3 |
| Порог входа | Бесплатный доступ к 3 кандидатам для калибровки |

### Сравнение с альтернативами

| | LEOWORK AI | Кадровое агентство | Самостоятельный найм |
|---|---|---|---|
| Стоимость | 8–10% годовой ЗП | 15–25% годовой ЗП | Время руководителя |
| Скорость шортлиста | Минуты | 1–3 недели | Недели поиска |
| Качество кандидатов | Pre-vetted из базы LEO | Кого нашли в базе | Кто откликнулся |
| Глубина контекста | Цели, мотивация, ожидания | Резюме + звонок | Только резюме |
| Гарантия | 3 месяца, полный возврат | Varies | Нет |

### Целевые клиенты (Фаза 1)

- IT-стартапы (seed–series B) — быстрые решения, бюджет есть
- Digital-агентства — нанимают часто, понимают AI
- Fintech/EdTech — активный рост команд

### Go-to-Market

1. **Telegram-чаты** HR-директоров и основателей стартапов
2. **Оффер**: "Покажу 3 релевантных кандидата бесплатно — если понравятся, договоримся"
3. **Партнёрства** с акселераторами (ФРИИ, Сколково, Спринт)

---

## 3. Системная архитектура

### Карта сервисов (после добавления LEOWORK)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            Frontend (Next.js 14)                        │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐   │
│  │   /chat, /chats ...  │    │   /employer/*                       │   │
│  │   LEO AI (B2C)       │    │   LEOWORK AI (B2B)                  │   │
│  │   🟢 Green theme     │    │   🔵 Blue theme                     │   │
│  └──────────┬───────────┘    └──────────────────┬───────────────────┘   │
└─────────────┼───────────────────────────────────┼──────────────────────-┘
              │                                   │
    ┌─────────▼─────────┐              ┌──────────▼──────────┐
    │  User Profile 3001│              │  Employer Svc  3012 │  ← НОВЫЙ
    │  Conversation 3002│              │  ┌────────────────┐  │
    │  AI/NLP       3003│◄────────────►│  │ Candidate      │  │
    │  Job Matching 3004│              │  │ Search Engine  │  │
    │  Email        3005│◄─────────────│  │ (обратный      │  │
    │  Report       3007│              │  │  матчинг)      │  │
    │  Telegram     3008│              │  └────────────────┘  │
    │  Resume Parse 3011│              │  Brief Parser        │
    └─────────┬─────────┘              │  Intro Generator     │
              │                        │  Pipeline Manager    │
    ┌─────────▼─────────┐              │  Analytics Engine    │
    │   PostgreSQL       │◄────────────│  Billing Tracker     │
    │   (pgvector)       │              └─────────────────────┘
    │   Redis            │
    └────────────────────┘
```

### Порты сервисов

| Сервис | Порт | Статус |
|--------|------|--------|
| Frontend (Next.js) | 3000 | ✅ Есть |
| User Profile | 3001 | ✅ Есть |
| Conversation | 3002 | ✅ Есть |
| AI/NLP | 3003 | ✅ Есть |
| Job Matching | 3004 | ✅ Есть |
| Email | 3005 | ✅ Есть |
| Report | 3007 | ✅ Есть |
| Telegram Support | 3008 | ✅ Есть |
| Resume Parser | 3011 | ✅ Есть |
| **Employer Service** | **3012** | 🔵 **НОВЫЙ** |

### Структура нового сервиса

```
services/employer/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts                    # Express app, порт 3012
│   ├── config/
│   │   ├── database.ts             # PostgreSQL pool (schema employer)
│   │   └── redis.ts                # Redis client
│   ├── middleware/
│   │   ├── apiKeyAuth.ts           # Авторизация по API-ключу
│   │   ├── rateLimiter.ts          # Rate limiting per API key
│   │   └── errorHandler.ts         # Единообразная обработка ошибок
│   ├── models/
│   │   ├── Company.ts              # Интерфейс компании
│   │   ├── HiringBrief.ts          # Описание вакансии
│   │   ├── CandidateShortlist.ts   # Шортлист кандидатов
│   │   ├── Introduction.ts         # Интродукция
│   │   └── PipelineEvent.ts        # Событие воронки
│   ├── repositories/
│   │   ├── companyRepository.ts    # CRUD компаний
│   │   ├── briefRepository.ts      # CRUD вакансий
│   │   ├── shortlistRepository.ts  # Шортлисты
│   │   ├── introRepository.ts      # Интродукции
│   │   └── pipelineRepository.ts   # Воронка
│   ├── controllers/
│   │   ├── companyController.ts    # Управление профилем компании
│   │   ├── briefController.ts      # Создание/редакция брифов
│   │   ├── searchController.ts     # Поиск кандидатов
│   │   ├── introController.ts      # Управление интродукциями
│   │   ├── pipelineController.ts   # Управление воронкой
│   │   └── analyticsController.ts  # Аналитика
│   ├── services/
│   │   ├── candidateSearch.ts      # AI-скрининг (ядро ценности)
│   │   ├── briefParser.ts          # AI-парсинг описания вакансии
│   │   ├── introGenerator.ts       # Генерация текста интродукции
│   │   ├── pipelineService.ts      # Бизнес-логика воронки
│   │   ├── analyticsService.ts     # Агрегация метрик
│   │   └── billingService.ts       # Трекинг success fee
│   ├── types/
│   │   └── index.ts                # Общие типы
│   └── utils/
│       ├── logger.ts               # Pino/Winston
│       └── sentry.ts               # Sentry integration
```

### API-эндпоинты Employer Service

Все эндпоинты требуют заголовок `X-Api-Key`.

#### Компания

```
GET    /api/employer/company              # Профиль компании (по ключу)
PUT    /api/employer/company              # Обновить профиль
```

#### Вакансии (Hiring Briefs)

```
POST   /api/employer/briefs               # Создать вакансию
GET    /api/employer/briefs               # Список вакансий компании
GET    /api/employer/briefs/:id           # Детали вакансии
PUT    /api/employer/briefs/:id           # Обновить вакансию
PATCH  /api/employer/briefs/:id/status    # Изменить статус (active/paused/closed/filled)
DELETE /api/employer/briefs/:id           # Удалить вакансию
```

#### Поиск кандидатов

```
POST   /api/employer/briefs/:id/search         # AI-поиск кандидатов по брифу
GET    /api/employer/briefs/:id/shortlist       # Текущий шортлист
POST   /api/employer/briefs/:id/calibrate       # Калибровка (feedback на кандидатов)
```

#### Интродукции

```
POST   /api/employer/intros                     # Запросить интро к кандидату
GET    /api/employer/intros                     # Список интродукций
GET    /api/employer/intros/:id                 # Статус интродукции
PATCH  /api/employer/intros/:id/response        # Ответ работодателя (interested/passed)
```

#### Воронка

```
GET    /api/employer/pipeline                   # Все кандидаты в работе (kanban)
GET    /api/employer/pipeline/brief/:briefId    # Воронка по вакансии
PATCH  /api/employer/pipeline/:id/stage         # Перевести кандидата на стадию
POST   /api/employer/pipeline/:id/notes         # Добавить заметку
```

#### Аналитика

```
GET    /api/employer/analytics/overview         # Общие метрики
GET    /api/employer/analytics/brief/:briefId   # Метрики по вакансии
GET    /api/employer/analytics/funnel           # Конверсия воронки
```

---

## 4. Модель данных (PostgreSQL)

### Новая схема `employer`

Вся B2B-логика живёт в отдельной PostgreSQL-схеме `employer`, изолированной от кандидатской схемы `jack`.

```sql
-- ============================================================
-- LEOWORK AI — Database Schema
-- Схема: employer
-- ============================================================

CREATE SCHEMA IF NOT EXISTS employer;

-- ----------------------------------------------------------
-- 1. Компании-работодатели
-- ----------------------------------------------------------
CREATE TABLE employer.companies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    industry      VARCHAR(100),
    size          VARCHAR(50),              -- 'startup' | 'smb' | 'enterprise'
    website       VARCHAR(500),
    description   TEXT,
    logo_url      VARCHAR(500),

    -- Контактное лицо (первичный пользователь)
    contact_name  VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    contact_role  VARCHAR(100),             -- 'founder' | 'hr_lead' | 'hiring_manager'

    -- Доступ
    api_key_hash  VARCHAR(255) NOT NULL,    -- bcrypt hash API-ключа
    api_key_prefix VARCHAR(8) NOT NULL,     -- первые 8 символов для идентификации

    -- Биллинг
    fee_percent   DECIMAL(4,2) DEFAULT 10.00,
    guarantee_days INTEGER DEFAULT 90,

    -- Метаданные
    status        VARCHAR(50) DEFAULT 'active',  -- active | suspended | churned
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_companies_api_key_prefix ON employer.companies(api_key_prefix);
CREATE INDEX idx_companies_status ON employer.companies(status);

-- ----------------------------------------------------------
-- 2. Вакансии / Hiring Briefs
-- ----------------------------------------------------------
CREATE TABLE employer.hiring_briefs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES employer.companies(id) ON DELETE CASCADE,

    -- Описание роли
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    requirements    TEXT,
    raw_text        TEXT,                   -- оригинальный текст от работодателя (до парсинга)

    -- Структурированные данные (заполняются AI)
    desired_skills  JSONB DEFAULT '[]',
    experience_min  INTEGER,
    experience_max  INTEGER,
    experience_level VARCHAR(50),           -- 'junior' | 'middle' | 'senior' | 'lead'
    salary_min      INTEGER,
    salary_max      INTEGER,
    currency        VARCHAR(10) DEFAULT 'RUB',
    location        JSONB DEFAULT '[]',
    work_mode       VARCHAR(50),            -- 'remote' | 'office' | 'hybrid'

    -- AI-обогащение
    role_family     VARCHAR(50),            -- из roleFamily.ts: 'backend', 'product', 'analytics'...
    embedding       vector(256),            -- эмбеддинг для семантического поиска

    -- Калибровка
    calibration_feedback JSONB DEFAULT '[]', -- [{userId, verdict: 'yes'|'no'|'maybe', reason}]

    -- Статус
    status          VARCHAR(50) DEFAULT 'active',  -- active | paused | closed | filled
    filled_at       TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_briefs_company_id ON employer.hiring_briefs(company_id);
CREATE INDEX idx_briefs_status ON employer.hiring_briefs(status);
CREATE INDEX idx_briefs_role_family ON employer.hiring_briefs(role_family);

-- ----------------------------------------------------------
-- 3. Шортлист кандидатов
-- ----------------------------------------------------------
CREATE TABLE employer.candidate_shortlist (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id          UUID NOT NULL REFERENCES employer.hiring_briefs(id) ON DELETE CASCADE,
    candidate_user_id UUID NOT NULL,         -- REFERENCES jack.users(id), но cross-schema

    -- Скоринг
    match_score       INTEGER,               -- 0–100
    match_reasons     JSONB,                 -- массив причин совпадения
    role_family_match VARCHAR(50),           -- 'same' | 'adjacent' | 'conflict'

    -- AI-контент для работодателя
    ai_summary        TEXT,                  -- "Иван — PM с 5 годами в fintech..."
    ai_strengths      JSONB DEFAULT '[]',    -- ключевые сильные стороны
    ai_concerns       JSONB DEFAULT '[]',    -- потенциальные риски

    -- Анонимизация (до consent)
    display_name      VARCHAR(100),          -- "Кандидат #7" до согласия, имя после

    -- Статус
    status            VARCHAR(50) DEFAULT 'suggested',
    -- suggested → reviewed → intro_requested → intro_sent →
    -- interviewing → offered → hired → rejected

    employer_notes    TEXT,
    employer_rating   INTEGER,               -- 1-5 звёзд

    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW(),

    UNIQUE(brief_id, candidate_user_id)
);

CREATE INDEX idx_shortlist_brief_id ON employer.candidate_shortlist(brief_id);
CREATE INDEX idx_shortlist_candidate ON employer.candidate_shortlist(candidate_user_id);
CREATE INDEX idx_shortlist_status ON employer.candidate_shortlist(status);

-- ----------------------------------------------------------
-- 4. Интродукции
-- ----------------------------------------------------------
CREATE TABLE employer.introductions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shortlist_id      UUID REFERENCES employer.candidate_shortlist(id),
    brief_id          UUID NOT NULL REFERENCES employer.hiring_briefs(id),
    company_id        UUID NOT NULL REFERENCES employer.companies(id),
    candidate_user_id UUID NOT NULL,

    -- Содержание
    intro_text        TEXT NOT NULL,          -- AI-сгенерированный текст для работодателя
    candidate_pitch   TEXT,                   -- AI-сгенерированный pitch для кандидата

    -- Канал доставки
    delivery_method   VARCHAR(50) DEFAULT 'email',  -- 'email' | 'telegram' | 'in_app'

    -- Согласие кандидата
    candidate_consent        BOOLEAN DEFAULT false,
    candidate_consent_at     TIMESTAMP,
    candidate_decline_reason TEXT,

    -- Реакция сторон
    employer_response VARCHAR(50) DEFAULT 'pending',  -- 'pending' | 'interested' | 'passed'
    candidate_response VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'

    -- Временные метки
    sent_at           TIMESTAMP,
    employer_responded_at TIMESTAMP,
    candidate_responded_at TIMESTAMP,
    created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_intros_brief_id ON employer.introductions(brief_id);
CREATE INDEX idx_intros_company_id ON employer.introductions(company_id);
CREATE INDEX idx_intros_candidate ON employer.introductions(candidate_user_id);
CREATE INDEX idx_intros_status ON employer.introductions(employer_response);

-- ----------------------------------------------------------
-- 5. Воронка найма (события)
-- ----------------------------------------------------------
CREATE TABLE employer.pipeline_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id          UUID NOT NULL REFERENCES employer.hiring_briefs(id) ON DELETE CASCADE,
    company_id        UUID NOT NULL REFERENCES employer.companies(id),
    candidate_user_id UUID NOT NULL,

    stage             VARCHAR(50) NOT NULL,
    -- 'sourced' → 'shortlisted' → 'intro_sent' → 'intro_accepted' →
    -- 'interviewing' → 'offer_extended' → 'offer_accepted' → 'hired'
    -- боковые: 'rejected_by_employer' | 'rejected_by_candidate' | 'withdrawn'

    previous_stage    VARCHAR(50),
    notes             TEXT,
    actor             VARCHAR(50) DEFAULT 'system',  -- 'system' | 'employer' | 'candidate'

    created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pipeline_brief_id ON employer.pipeline_events(brief_id);
CREATE INDEX idx_pipeline_candidate ON employer.pipeline_events(candidate_user_id);
CREATE INDEX idx_pipeline_stage ON employer.pipeline_events(stage);
CREATE INDEX idx_pipeline_created ON employer.pipeline_events(created_at);

-- ----------------------------------------------------------
-- 6. Биллинг
-- ----------------------------------------------------------
CREATE TABLE employer.invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES employer.companies(id),
    brief_id        UUID NOT NULL REFERENCES employer.hiring_briefs(id),
    candidate_user_id UUID NOT NULL,

    -- Расчёт
    candidate_salary_annual INTEGER NOT NULL,  -- годовая ЗП кандидата
    fee_percent     DECIMAL(4,2) NOT NULL,
    fee_amount      INTEGER NOT NULL,          -- итоговая сумма в рублях
    currency        VARCHAR(10) DEFAULT 'RUB',

    -- Статус
    status          VARCHAR(50) DEFAULT 'pending',
    -- 'pending' → 'invoiced' → 'paid' → 'refunded'
    -- гарантийный период: если 'paid' и кандидат ушёл < guarantee_days → 'refunded'

    hired_at        TIMESTAMP,
    invoiced_at     TIMESTAMP,
    paid_at         TIMESTAMP,
    guarantee_expires_at TIMESTAMP,
    refunded_at     TIMESTAMP,

    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_company ON employer.invoices(company_id);
CREATE INDEX idx_invoices_status ON employer.invoices(status);

-- ----------------------------------------------------------
-- 7. Consent — согласие кандидата на интродукции
--    (добавляется в схему jack, но управляется из employer)
-- ----------------------------------------------------------
-- ALTER TABLE jack.users ADD COLUMN IF NOT EXISTS
--     opt_in_introductions BOOLEAN DEFAULT false;
-- ALTER TABLE jack.users ADD COLUMN IF NOT EXISTS
--     intro_privacy_level VARCHAR(50) DEFAULT 'anonymous';
--     -- 'anonymous' | 'partial' (имя, без компаний) | 'full'

-- Отдельная таблица для гранулярного consent
CREATE TABLE employer.candidate_consent (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_user_id UUID NOT NULL,          -- REFERENCES jack.users(id)
    consent_type      VARCHAR(50) NOT NULL,   -- 'global_opt_in' | 'specific_intro'
    intro_id          UUID REFERENCES employer.introductions(id),
    granted           BOOLEAN NOT NULL,
    granted_at        TIMESTAMP,
    revoked_at        TIMESTAMP,
    ip_address        VARCHAR(45),

    created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_consent_candidate ON employer.candidate_consent(candidate_user_id);
```

### Связи между схемами

```
employer.companies ─────────┐
                            │
employer.hiring_briefs ─────┤ company_id
                            │
employer.candidate_shortlist│ brief_id + candidate_user_id → jack.users
                            │
employer.introductions ─────┤ shortlist_id + brief_id + company_id
                            │
employer.pipeline_events ───┤ brief_id + company_id + candidate_user_id
                            │
employer.invoices ──────────┤ company_id + brief_id + candidate_user_id
                            │
employer.candidate_consent ─┘ candidate_user_id → jack.users
```

---

## 5. Авторизация по ключу доступа

### Концепция

В отличие от B2C-части (JWT + OAuth), работодатели авторизуются **по API-ключу**, который генерирует и выдаёт администратор LEO AI.

### Формат ключа

```
leowork_live_a1b2c3d4_e5f6g7h8i9j0k1l2m3n4o5p6
└──────┘ └──┘ └──────┘ └──────────────────────────┘
 prefix  env  company   random (32 hex chars)
              prefix
```

- `leowork_` — префикс продукта
- `live_` / `test_` — среда
- `a1b2c3d4` — 8 символов для идентификации компании (хранится в БД как `api_key_prefix`)
- 32 случайных hex-символа — секретная часть

### Middleware авторизации

```typescript
// services/employer/src/middleware/apiKeyAuth.ts

interface AuthenticatedRequest extends Request {
  company: {
    id: string;
    name: string;
    status: string;
    feePercent: number;
  };
}

async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey || !apiKey.startsWith('leowork_')) {
    return res.status(401).json({ error: 'Missing or invalid API key' });
  }

  // Извлекаем prefix для быстрого поиска в БД
  const prefix = apiKey.split('_')[2]; // 'a1b2c3d4'

  // Находим компанию по prefix
  const company = await companyRepository.findByKeyPrefix(prefix);
  if (!company) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Верифицируем полный ключ через bcrypt
  const valid = await bcrypt.compare(apiKey, company.api_key_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  if (company.status !== 'active') {
    return res.status(403).json({ error: 'Account suspended' });
  }

  (req as AuthenticatedRequest).company = {
    id: company.id,
    name: company.name,
    status: company.status,
    feePercent: company.fee_percent,
  };

  next();
}
```

### Генерация ключей (CLI-утилита)

```typescript
// services/employer/src/scripts/generate-api-key.ts
// Запуск: npx ts-node src/scripts/generate-api-key.ts \
//   --company "Яндекс" \
//   --contact-name "Иван Петров" \
//   --contact-email "ivan@yandex.ru" \
//   --industry "tech"

// Выводит:
// ✅ Компания создана: Яндекс (id: uuid)
// 🔑 API-ключ (сохраните, повторно получить нельзя):
//    leowork_live_a1b2c3d4_e5f6g7h8i9j0k1l2m3n4o5p6
```

### Безопасность

- Ключ хранится в БД как **bcrypt hash** — утечка БД не компрометирует ключи
- Prefix (`api_key_prefix`) обеспечивает O(1) lookup без перебора всех записей
- Rate limiting: 100 запросов/мин на ключ (Redis counter)
- Все запросы логируются с `company_id` для аудита
- Ротация: генерация нового ключа инвалидирует старый

---

## 6. AI-скрининг кандидатов (обратный матчинг)

### Суть

Существующий `services/job-matching/src/services/matcher.ts` оценивает соответствие **вакансий профилю кандидата**. Для LEOWORK нужно **инвертировать** этот процесс: оценивать **кандидатов под вакансию**.

### Алгоритм `candidateSearch.ts`

```
Работодатель вводит описание вакансии
          │
          ▼
    ┌─────────────┐
    │ 1. Brief    │  AI-NLP парсит raw_text → структурированный HiringBrief
    │    Parser   │  (title, skills, experience_level, role_family, embedding)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ 2. Pre-     │  SQL: career_tracks WHERE role_family IN (same, adjacent)
    │    filter   │  + pgvector: cosine_similarity(brief.embedding, track.embedding) > 0.4
    │             │  + WHERE experience_years BETWEEN brief.min AND brief.max
    │             │  → ~50-200 кандидатов
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ 3. Detailed │  Адаптированный matchJobs() в обратную сторону:
    │    Scoring   │  - Role match (30 pts): brief.title vs track.target_role
    │             │  - Skills (25 pts): brief.desired_skills vs user_skills
    │             │  - Location (20 pts): brief.location vs desired.location
    │             │  - Experience (15 pts): brief.level vs experience_years
    │             │  - Work mode (10 pts): brief.work_mode vs desired.workFormat
    │             │  × family_multiplier (same=1.0, adjacent=0.6, conflict=0.2)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ 4. AI       │  LLM ранжирует топ-20 с учётом:
    │    Ranking   │  - careerSummary (мотивация, амбиции)
    │             │  - desired.salary vs brief.salary (совместимость по ЗП)
    │             │  - desired.culture (культурный fit)
    │             │  - "горячесть" (недавняя активность в LEO)
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │ 5. Summary  │  Для каждого кандидата в шортлисте AI генерирует:
    │    Generator │  - ai_summary: "Иван — PM, 5 лет fintech, хочет product lead..."
    │             │  - ai_strengths: ["discovery", "метрики", "рост команды"]
    │             │  - ai_concerns: ["нет опыта в e-commerce"]
    └──────┬──────┘
           │
           ▼
    Шортлист из 5-10 кандидатов с карточками
```

### Факторы скоринга (обратный матчинг)

| Фактор | Макс. баллов | Источник данных кандидата | Как считается |
|--------|-------------|--------------------------|---------------|
| Роль | 30 | `target_role`, `current_role`, позиции | Фразовый + токенный матчинг с `brief.title` |
| Навыки | 25 | `user_skills`, `skills_hard`, `careerSummary` | Пересечение + cosine similarity эмбеддингов |
| Локация | 20 | `desired.location` | Совпадение города / remote-compatible |
| Опыт | 15 | `experience_years` | Соответствие `brief.experience_level` |
| Формат | 10 | `desired.workFormat` | Exact/partial match с `brief.work_mode` |
| **Бонус** | +5 | Активность, количество факторов | Multi-signal bonus при 3+ сильных совпадениях |

### Калибровка

После первого поиска работодатель отмечает кандидатов: "Да" / "Нет" / "Может быть" с комментарием. Feedback сохраняется в `calibration_feedback` и используется для корректировки весов при повторном поиске.

---

## 7. Система интродукций

### Процесс интродукции

```
Работодатель нажимает "Интро"
     │
     ▼
Система запрашивает consent у кандидата
(push / email / in-app)
     │
     ├── Кандидат принял ──────────────────────┐
     │                                         │
     │   Система раскрывает имя и контакт      │
     │   AI генерирует intro-текст             │
     │   Email обеим сторонам                  │
     │   Pipeline event: 'intro_accepted'      │
     │                                         │
     ├── Кандидат отклонил ────────────────────┐│
     │   Работодатель видит "Кандидат не       ││
     │   заинтересован" (без причины)          ││
     │   Pipeline event: 'rejected_by_candidate'│
     │                                         │
     └── Таймаут 48 часов ─────────────────────┘
         Автоматический decline
```

### AI-генерация intro-текста

Для работодателя:
> **Кандидат Иван С.** — Product Manager с 5 годами опыта в fintech.
> Сейчас работает в [крупном банке], руководит командой из 8 человек.
> Хочет перейти в продуктовый стартап. Сильные стороны: discovery,
> A/B-тестирование, работа с метриками. Ожидает от 250K ₽/мес.
> Готов к офису в Москве или гибридному формату. Открыт к предложениям
> с марта 2026.

Для кандидата:
> **Компания [Название]** ищет Product Manager в свою команду.
> [Industry], [size]. Предлагают [salary range], [work_mode].
> Кратко о роли: [description]. Хотите, чтобы мы представили вас?

### Каналы доставки

| Канал | Приоритет | Когда |
|-------|-----------|-------|
| In-app (LEO AI) | 1 | Если кандидат активен в LEO |
| Email | 2 | Всегда (через `services/email`) |
| Telegram | 3 | Если привязан аккаунт (будущее) |

---

## 8. Consent Flow (согласие кандидата)

### Принцип

Кандидат **никогда** не передаётся работодателю без явного согласия. Это и этика, и требование ФЗ-152 (персональные данные).

### Два уровня consent

#### 1. Глобальный opt-in

Добавляется в сценарий LEO AI (`conversation/src/scenario/`) как новый шаг после сбора профиля:

> "Хотите ли вы получать предложения от работодателей через LEO?
> Мы никогда не передадим ваши данные без вашего подтверждения
> на каждое конкретное предложение."

Сохраняется в `jack.users.opt_in_introductions = true`.

**Без глобального opt-in кандидат не попадает в результаты поиска LEOWORK.**

#### 2. Per-intro consent

При каждой конкретной интродукции кандидат получает запрос и подтверждает/отклоняет. Только после подтверждения работодатель видит реальное имя и контакты.

### Уровни анонимизации

| Уровень | Что видит работодатель | Когда |
|---------|----------------------|-------|
| `anonymous` | "Кандидат #7", роль, опыт, навыки, AI-summary. Без имени, компаний, контактов | До consent |
| `partial` | Имя, роль, навыки, ожидания. Без текущей компании | После consent, если кандидат выбрал partial |
| `full` | Все данные, включая текущую компанию и контакты | После consent, если кандидат выбрал full |

---

## 9. Frontend: B2B-кабинет

### Маршрутизация

```
frontend/app/
  employer/                         # Отдельный layout, синяя тема
    layout.tsx                      # EmployerLayout: header, sidebar, blue theme
    page.tsx                        # Лендинг LEOWORK (если нет ключа)
    auth/page.tsx                   # Ввод API-ключа
    dashboard/
      page.tsx                      # Главная: активные вакансии, последние кандидаты, метрики
    briefs/
      page.tsx                      # Список вакансий
      new/page.tsx                  # Создание вакансии (бриф)
      [id]/
        page.tsx                    # Детали вакансии + шортлист
        edit/page.tsx               # Редактирование
    pipeline/
      page.tsx                      # Kanban-доска всех кандидатов
    analytics/
      page.tsx                      # Аналитика и метрики
    settings/
      page.tsx                      # Профиль компании, ключ, биллинг
```

### Дизайн-система

| Элемент | LEO AI (B2C) 🟢 | LEOWORK AI (B2B) 🔵 |
|---------|------------------|---------------------|
| Primary color | `#10B981` (emerald) | `#3B82F6` (blue-500) |
| Primary dark | `#059669` | `#2563EB` (blue-600) |
| Background | `#F0FDF4` (green-50) | `#EFF6FF` (blue-50) |
| Accent | `#34D399` | `#60A5FA` (blue-400) |
| Sidebar | Зелёный градиент | Синий градиент |
| Logo text | LEO AI | LEOWORK AI |

### Ключевые экраны

#### Dashboard

```
┌──────────────────────────────────────────────────────┐
│  LEOWORK AI                          [Компания XYZ]  │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ 📋 Вакан │  Активные вакансии          [+ Новая]    │
│ 📊 Пайп  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ 📈 Анали │  │ Senior PM │ │ Backend  │ │ Designer │ │
│ ⚙️ Настр │  │ 8 кандид. │ │ 3 кандид.│ │ 0 кандид.│ │
│          │  │ 2 интро   │ │ 1 интро  │ │ Поиск... │ │
│          │  └──────────┘ └──────────┘ └──────────┘ │
│          │                                           │
│          │  Метрики за 30 дней                       │
│          │  ┌────────┐ ┌────────┐ ┌────────┐        │
│          │  │  12    │ │  67%   │ │ 14 дн  │        │
│          │  │кандид. │ │конверс.│ │ср.срок │        │
│          │  └────────┘ └────────┘ └────────┘        │
└──────────┴───────────────────────────────────────────┘
```

#### Создание вакансии (Hiring Brief)

```
┌──────────────────────────────────────────────────────┐
│  Новая вакансия                                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Опишите роль (свободный текст или JD):             │
│  ┌────────────────────────────────────────────────┐  │
│  │ Ищем Senior Product Manager в fintech-стартап. │  │
│  │ Опыт от 5 лет, знание платёжных систем,       │  │
│  │ B2B SaaS. Москва или удалёнка. До 350К.       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [AI парсит → показывает структуру]                 │
│                                                      │
│  Название: Senior Product Manager                    │
│  Навыки: fintech, B2B SaaS, платёжные системы       │
│  Опыт: 5+ лет (senior)                              │
│  Локация: Москва, удалёнка                           │
│  ЗП: до 350 000 ₽/мес                               │
│  Формат: remote / hybrid                             │
│                                                      │
│  В базе LEO: ~23 подходящих кандидата                │
│                                                      │
│  [Создать и найти кандидатов]                        │
└──────────────────────────────────────────────────────┘
```

#### Шортлист кандидатов

```
┌──────────────────────────────────────────────────────┐
│  Senior Product Manager — 8 кандидатов               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ Кандидат #1 ─────────────────── Score: 92 ────┐  │
│  │ 🔵 PM, 6 лет в fintech                        │  │
│  │ Навыки: B2B SaaS, A/B, SQL, Jira              │  │
│  │ Ожидает: 280-320K, remote/hybrid               │  │
│  │ "Хочет перейти в растущий стартап,             │  │
│  │  устал от корпоративной бюрократии"            │  │
│  │                                                 │  │
│  │ [👍 Подходит] [👎 Не подходит] [📩 Интро]     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Кандидат #2 ─────────────────── Score: 85 ────┐  │
│  │ 🔵 Product Lead, 8 лет, e-commerce + fintech   │  │
│  │ Навыки: discovery, roadmap, P&L                │  │
│  │ Ожидает: 300-400K, Москва                      │  │
│  │ "Ищет founding PM роль в seed/A стартапе"      │  │
│  │                                                 │  │
│  │ [👍 Подходит] [👎 Не подходит] [📩 Интро]     │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

#### Pipeline (Kanban)

```
┌──────────────────────────────────────────────────────────────────┐
│  Воронка найма                                    [Фильтр: Все] │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│ Shortlist│ Интро    │ Интервью │ Оффер    │ Нанят    │ Отказ    │
│    (5)   │   (3)    │   (2)    │   (1)    │   (0)    │   (2)    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │          │ ┌──────┐ │
│ │Канд.1│ │ │Канд.3│ │ │Канд.6│ │ │Канд.8│ │          │ │Канд.2│ │
│ │PM,92 │ │ │BE,78 │ │ │PM,88 │ │ │PM,91 │ │          │ │DE,45 │ │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │          │ └──────┘ │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │          │          │ ┌──────┐ │
│ │Канд.4│ │ │Канд.5│ │ │Канд.7│ │          │          │ │Канд.9│ │
│ │PM,85 │ │ │PM,82 │ │ │PM,80 │ │          │          │ │QA,30 │ │
│ └──────┘ │ └──────┘ │ └──────┘ │          │          │ └──────┘ │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

---

## 10. Аналитика и дашборд

### Метрики для работодателя

| Метрика | Формула | Визуализация |
|---------|---------|--------------|
| Время до шортлиста | `shortlist.created_at - brief.created_at` | Среднее, медиана |
| Конверсия воронки | `% перехода между стадиями` | Funnel chart |
| Acceptance rate | `intros accepted / intros sent` | % |
| Time to hire | `hired_at - brief.created_at` | Дни, тренд |
| Cost per hire | `fee_amount` (при success fee) | ₽ |
| Средний match score | `AVG(match_score) по нанятым` | Число |
| Активные вакансии | `COUNT(briefs WHERE status='active')` | Число |

### SQL для аналитики (пример)

```sql
-- Конверсия воронки по компании
SELECT
  stage,
  COUNT(DISTINCT candidate_user_id) as candidates,
  ROUND(
    COUNT(DISTINCT candidate_user_id)::numeric /
    NULLIF(FIRST_VALUE(COUNT(DISTINCT candidate_user_id))
      OVER (ORDER BY
        CASE stage
          WHEN 'sourced' THEN 1
          WHEN 'shortlisted' THEN 2
          WHEN 'intro_sent' THEN 3
          WHEN 'interviewing' THEN 4
          WHEN 'offer_extended' THEN 5
          WHEN 'hired' THEN 6
        END
      ), 0) * 100, 1
  ) as conversion_pct
FROM employer.pipeline_events
WHERE company_id = $1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY stage
ORDER BY
  CASE stage
    WHEN 'sourced' THEN 1
    WHEN 'shortlisted' THEN 2
    WHEN 'intro_sent' THEN 3
    WHEN 'interviewing' THEN 4
    WHEN 'offer_extended' THEN 5
    WHEN 'hired' THEN 6
  END;
```

---

## 11. Дорожная карта разработки

### Фаза 0: Ручная валидация (0 кода, 2-4 недели)

**Цель**: доказать, что работодатели готовы платить за доступ к кандидатам LEO.

| Шаг | Действие | Результат |
|-----|----------|-----------|
| 0.1 | Набрать 50-100 кандидатов с заполненными профилями в LEO | База для поиска |
| 0.2 | Найти 3-5 работодателей (Telegram-чаты, LinkedIn) | Первые клиенты |
| 0.3 | Вручную сделать матчинг SQL-запросами по базе | Шортлисты |
| 0.4 | Отправить "тёплые интро" по email/Telegram | Первые интродукции |
| 0.5 | Закрыть 1-2 найма, получить feedback | Валидация и кейсы |

**Критерий перехода к Фазе 1**: минимум 2 закрытых вакансии ИЛИ 5 компаний в активной воронке.

### Фаза 1: MVP Backend (4-6 недель)

| Неделя | Задачи | Deliverable |
|--------|--------|-------------|
| 1-2 | DB schema (`employer.*`), сервис `employer/`, API-key auth, CLI генерации ключей | Работающий бэкенд с auth |
| 3-4 | Обратный matcher (`candidateSearch.ts`), brief parser через AI-NLP, AI-summary генерация | Ядро поиска кандидатов |
| 5-6 | CRUD брифов, шортлист API, базовый pipeline | Полный API для B2B-кабинета |

### Фаза 2: MVP Frontend (4-6 недель)

| Неделя | Задачи | Deliverable |
|--------|--------|-------------|
| 7-8 | Layout `/employer/`, auth по ключу, dashboard, список вакансий | Работающий B2B-кабинет |
| 9-10 | Создание вакансии (бриф), шортлист кандидатов с карточками | Поиск кандидатов через UI |
| 11-12 | Pipeline (kanban), базовая аналитика, настройки | Управление воронкой |

### Фаза 3: Интродукции и Consent (3-4 недели)

| Неделя | Задачи | Deliverable |
|--------|--------|-------------|
| 13-14 | Consent flow в LEO (opt-in шаг в сценарии), per-intro consent | Согласие кандидатов |
| 15-16 | Intro generator, email delivery, push-уведомления | Полный цикл интро |

### Фаза 4: Биллинг и Polish (3-4 недели)

| Неделя | Задачи | Deliverable |
|--------|--------|-------------|
| 17-18 | Биллинг (success fee), лендинг LEOWORK, калибровка | Монетизация |
| 19-20 | Telegram-бот для HR, ATS-интеграция (HuntFlow), feedback loop | Масштабирование |

### Общий таймлайн

```
Фаза 0        Фаза 1          Фаза 2          Фаза 3        Фаза 4
Ручная         Backend MVP     Frontend MVP     Intros         Billing
валидация                                       + Consent      + Scale
├──────────────┼───────────────┼───────────────┼──────────────┼──────────►
нед 1-4        нед 5-10        нед 11-16       нед 17-20      нед 21-24
```

---

## 12. Переиспользование существующего кода

| Существующий компонент | Как используется в LEOWORK |
|------------------------|---------------------------|
| `services/job-matching/src/services/matcher.ts` | Инвертировать скоринг: кандидаты под вакансию вместо вакансий под кандидата |
| `services/job-matching/src/services/roleFamily.ts` | Классификация ролей — работает в обе стороны без изменений |
| `services/ai-nlp/src/controllers/embeddingController.ts` | Эмбеддинги hiring briefs для pgvector cosine search по резюме кандидатов |
| `services/ai-nlp/src/controllers/generationController.ts` | Генерация AI-саммари кандидата для HR-карточки |
| `services/email/src/controllers/emailController.ts` | Отправка intro-писем обеим сторонам |
| `services/conversation/src/types/session.ts` | `CollectedData` — данные кандидата = "товар" для LEOWORK |
| `services/user-profile/` | Паттерн авторизации, модель пользователя, bcrypt |
| `services/report/` | Паттерн PDF-генерации — для "Отчёт о кандидате" |
| `infrastructure/postgres/` | pgvector, pg_trgm уже настроены |
| `frontend/components/chat/StagePanel.tsx` | Паттерн карточек с контентом — адаптировать для кандидатских карточек |
| Docker Compose, Sentry, Logger | Инфраструктура переиспользуется целиком |

---

## 13. Изоляция от B2C-части

### Git-стратегия

```
main ─────────────────────────────────────► (стабильный B2C)
  │
  └── feature/leowork-b2b ───────────────► (вся B2B-разработка)
        │
        ├── leowork/db-schema ────────────► (схема БД)
        ├── leowork/employer-service ─────► (бэкенд)
        ├── leowork/frontend ─────────────► (фронтенд)
        ├── leowork/consent-flow ─────────► (изменения в B2C для consent)
        └── leowork/intros ───────────────► (система интродукций)
```

### Принципы изоляции

1. **Отдельная PostgreSQL-схема** `employer` — не трогает таблицы `jack.*`
2. **Отдельный микросервис** `services/employer/` на порту 3012 — не трогает существующие сервисы
3. **Отдельный layout** `frontend/app/employer/` — не трогает B2C-страницы
4. **Единственные точки пересечения** (минимальные изменения в B2C):
   - `jack.users` — добавление `opt_in_introductions` (ALTER TABLE)
   - `conversation/src/scenario/` — добавление opt-in шага
   - `services/email/` — новые шаблоны для intro-писем
5. **Feature flag**: `LEOWORK_ENABLED=true/false` — полностью отключает B2B-роуты
6. **На стенд не выкладывается** до ready — ветка `feature/leowork-b2b` не мержится в `main`

### Docker Compose (дополнение)

```yaml
# Добавляется в docker-compose.yml с профилем leowork
services:
  employer:
    build:
      context: ./services/employer
      dockerfile: Dockerfile
    container_name: jack-employer
    restart: unless-stopped
    ports:
      - '${EMPLOYER_PORT:-3012}:3012'
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://redis:6379
      - AI_SERVICE_URL=http://localhost:3003
      - EMAIL_SERVICE_URL=http://localhost:3005
    networks:
      - jack-network
    depends_on:
      - postgres
      - redis
    profiles:
      - leowork  # Запускается только с --profile leowork
```

---

## 14. Адаптация под российский рынок

### Отличия от Jack & Jill (UK/US)

| Аспект | Jack & Jill | LEOWORK AI |
|--------|-------------|------------|
| Рынок | London, SF, NYC | Москва, СПб, удалёнка РФ |
| Ценообразование | 10% от годовой ЗП (£/$) | 8-10% от годовой ЗП (₽) |
| Средний чек | $15-30K | 150-360K ₽ |
| Каналы продаж | LinkedIn | Telegram, HR-чаты, акселераторы |
| ATS-интеграции | Ashby | HuntFlow, Потоки, Хантфлоу |
| Валюта | GBP, USD | RUB (с поддержкой USD для remote) |
| Правовая база | GDPR | ФЗ-152 (персональные данные) |
| AI-провайдер | OpenAI (предположительно) | YandexGPT (уже используется) |
| Источники вакансий | Собственная база | HH.ru, SuperJob (уже подключены) |

### Правовые требования (ФЗ-152)

1. **Согласие на обработку ПД** — обязательно от каждого кандидата (opt-in)
2. **Согласие на передачу ПД третьим лицам** — per-intro consent
3. **Право на отзыв согласия** — кандидат может отозвать opt-in в любой момент
4. **Уведомление Роскомнадзора** — регистрация оператора ПД
5. **Хранение данных на территории РФ** — VPS уже в РФ (Cloud.ru)

---

## 15. Риски и митигация

| Риск | Вероятность | Импакт | Митигация |
|------|-------------|--------|-----------|
| Мало кандидатов в базе LEO | Высокая | Критический | Фокус на росте B2C до запуска B2B; минимум 200-500 активных профилей |
| Работодатели не готовы платить | Средняя | Критический | Фаза 0 — ручная валидация до написания кода |
| Кандидаты не дают consent | Средняя | Высокий | UX consent: фокус на ценности для кандидата ("компания мечты сама вас ищет") |
| Конкуренция с HH.ru / Хабр | Высокая | Средний | Дифференциация: глубина контекста, AI-скрининг, тёплые интро |
| Правовые проблемы (ФЗ-152) | Средняя | Высокий | Юридическая консультация до запуска; consent flow с первого дня |
| Сложность обратного матчинга | Низкая | Средний | Matcher уже написан, нужна только инверсия + адаптация весов |
| Перегрузка существующих сервисов | Низкая | Средний | Отдельный сервис, rate limiting, профиль Docker |

---

## Приложение A: Glossary

| Термин | Определение |
|--------|-------------|
| **LEO AI** | B2C-продукт для кандидатов (аналог Jack) |
| **LEOWORK AI** | B2B-продукт для работодателей (аналог Jill) |
| **Hiring Brief** | Структурированное описание вакансии от работодателя |
| **Shortlist** | Список подходящих кандидатов с AI-скорингом |
| **Introduction / Интро** | Тёплое представление кандидата работодателю |
| **Consent** | Согласие кандидата на передачу данных работодателю |
| **Pipeline** | Воронка найма: sourced → hired |
| **Success fee** | Оплата только при успешном найме |
| **Calibration** | Feedback работодателя на шортлист для улучшения поиска |
| **Role family** | Семейство профессий (product, backend, analytics...) |

## Приложение B: Связанные документы

- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура B2C-части
- [ROADMAP.md](./ROADMAP.md) — общий roadmap LEO AI
- [PRODUCT.md](./PRODUCT.md) — продуктовая документация
- [OPERATIONS.md](./OPERATIONS.md) — инструкции по деплою и эксплуатации
