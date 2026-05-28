# Техническая архитектура LEO AI

*Актуально на 2026-05-27*

## 1. Обзор системы

LEO AI — микросервисная платформа (Node.js + Express + TypeScript) с общим AI-контуром (YandexGPT, SpeechKit TTS).

### Стек

| Слой | Технологии |
|------|------------|
| Frontend | Next.js 14 (App Router), Ant Design, Tailwind |
| Backend | Node.js, Express, TypeScript |
| AI | YandexGPT, SpeechKit TTS, Interview Prep Prompt V2 |
| Data | PostgreSQL, Redis (сессии, BullMQ) |
| Storage | Yandex Object Storage (PDF) |
| Infra | Docker Compose, VPS (Cloud.ru), Caddy (HTTPS) |
| Observability | Sentry, PostHog |

---

## 2. Карта сервисов

| Сервис | Порт | Назначение |
|--------|------|------------|
| **Frontend** | 3000 | Next.js, чат, лендинг, OAuth callback |
| **User Profile** | 3001 | Auth (JWT, OAuth), профили, резюме |
| **Conversation** | 3002 | Диалоговый движок, сценарии, WebSocket/REST |
| **AI/NLP** | 3003 | YandexGPT, TTS, Interview Prep, агенты |
| **Job Matching** | 3004 | HH/SuperJob, scoring |
| **Email** | 3005 | SMTP / SendGrid, дайджесты |
| **Report** | 3007 | PDF (Puppeteer), S3 |
| **Telegram Support** | 3008 | Бот [@leoaisupportbot](https://t.me/leoaisupportbot) |
| **Resume Parser** | 3011 | Docker: извлечение текста из PDF/DOCX |

Запуск локально / на VPS: `npm run dev:up` (см. [OPERATIONS.md](./OPERATIONS.md)).

### Health

- Каждый сервис: `GET /health`
- Агрегатор на стенде: `GET https://leo-ai.ru/api/health` (Next.js route, опрашивает все сервисы на `127.0.0.1`)

---

## 3. Мультиагентная система (AI/NLP)

Специализированные агенты и режимы:

- **Validator** — качество ответа пользователя
- **Profile Analyst** — полнота профиля
- **Context Manager** — отклонение от темы
- **Interview Prep (Prompt V2)** — режимы `diagnostics`, `theory`, `case`, `mock`, `star`, `employer_questions`; role packs PM/Product, Analytics/Data — см. [INTERVIEW_TRAINER_PROMPT_V2.md](./INTERVIEW_TRAINER_PROMPT_V2.md)

Ключевые API:

- `POST /api/ai/generate-step`, `validate-answer`, `analyze-profile`, …
- `POST /api/ai/tts` — синтез речи (Yandex SpeechKit)
- `POST /api/ai/interview/*` — подготовка к собеседованию

---

## 4. Сценарии (Conversation)

| ID | Продукт | Завершение |
|----|---------|------------|
| `jack-profile-v2` | Jack | Job Matching → Email |
| `wannanew-pm-v1` | WannaNew | Report Service → PDF |

WannaNew: `integrationService` не вызывает matching для `product=wannanew`; отчёт по кнопке / статусу сессии.

Подробнее: [HISTORY/WANNANEW.md](./HISTORY/WANNANEW.md)

---

## 5. Голос

| Направление | Реализация | Статус |
|-------------|------------|--------|
| **TTS** (озвучка LEO) | `ai-nlp` → Yandex SpeechKit; фронт воспроизводит base64 | Production baseline |
| **STT** (ввод пользователя) | `webkitSpeechRecognition` в `frontend/app/chat/page.tsx` | Chrome; server STT — backlog MVP1 |

Опционально: `NEXT_PUBLIC_ENABLE_BROWSER_TTS_FALLBACK=true` — браузерный `speechSynthesis` если серверный TTS недоступен.

---

## 6. Модель данных

### PostgreSQL

- `jack.users` — аккаунты, OAuth IDs
- `jack.career_profiles` — роли, опыт, локация
- `jack.resumes` — файлы и распарсенные данные
- `public.jobs` — вакансии (HH/SuperJob)

### Redis

- `session:{id}` — состояние чата
- `ai:nlp:history:{id}` — контекст YandexGPT
- `report:{id}` — статус PDF

---

## 7. Внешние интеграции

| Интеграция | Где |
|------------|-----|
| OAuth Google / Yandex | `user-profile` |
| YandexGPT + SpeechKit TTS | `ai-nlp` |
| HH.ru / SuperJob | `job-matching` |
| Yandex Object Storage | `report` |
| Telegram Bot API | `telegram-support` (proxy на VPS в РФ) |
| Sentry | все сервисы + frontend |
| PostHog | frontend |

---

## 8. Reverse proxy (production)

Caddy на VPS проксирует `leo-ai.ru` → frontend (порт **3011** в текущем runbook; Next dev/build слушает согласно `dev:up:staging`).

См. [OPERATIONS.md](./OPERATIONS.md), [STAGING_DEPLOY.md](./STAGING_DEPLOY.md).
