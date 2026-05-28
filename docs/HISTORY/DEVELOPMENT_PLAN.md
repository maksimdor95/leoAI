# LeoAI — План разработки

> **Актуальный roadmap:** [../ROADMAP.md](../ROADMAP.md) · **Архитектура:** [../ARCHITECTURE.md](../ARCHITECTURE.md)  
> Этот файл — расширенный снимок статусов и истории задач.  
> **Приоритизированный план улучшений:** [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md).

*Обновлено: 2026-05-27*

---

## MVP 0: границы релиза (single source)

- **Цель MVP 0:** стабильный end-to-end путь `chat/interview -> финальный результат` **для каждого** co-primary сценария (см. scope freeze 2026-04-18 в `IMPROVEMENT_PLAN.md`).
- **Релизный путь A (Jack):** `Профиль -> подбор вакансий -> email`.
- **Релизный путь B (WannaNew):** `Интервью -> report preview -> PDF`.
- **Правило MVP 0:** пути A и B входят в релиз как **co-primary**; модель «второй только support/partial» не используем.

### Статус компонентов (Implemented / Partial / Planned)

| Компонент | Статус MVP 0 |
|---|---|
| User auth + profile + OAuth (Google/Yandex) | Implemented |
| Conversation orchestration (REST + WS dev) | Implemented |
| Interview Prep (Prompt V2) | Implemented |
| Jack flow (matching + email) | Partial (нужен `HH_API_KEY` для live jobs) |
| WannaNew flow (report preview + PDF) | Implemented |
| Career onboarding (production persistence) | Partial |
| Voice TTS (Yandex SpeechKit) | Implemented |
| Voice STT (browser) | Partial (server STT — backlog) |
| Telegram Support | Implemented |
| Observability (Sentry + PostHog) | Implemented |
| Security baseline (no fallback secrets, rate-limit, unified auth) | Implemented |
| Smoke/integration release gate | Implemented |
| Release runbook + staging on `leo-ai.ru` | Implemented |

*Смысл статусов в таблице:* `Implemented` — закрыто по смыслу для MVP0; `Partial` — работает, остаётся существенный долг или риск; `Planned` — к релизу по пункту ещё не доведено.

---

## Реализовано (база платформы)

### Инфраструктура
- [x] Docker Compose (все сервисы + зависимости)
- [x] PostgreSQL, Redis
- [x] Dockerfiles для каждого сервиса

### User Profile Service
- [x] Регистрация и аутентификация (JWT)
- [x] OAuth endpoints (Google/Yandex) в backend + привязка provider ID к пользователю
- [x] Управление профилями пользователей

### Frontend
- [x] Next.js 14, App Router
- [x] Лендинг, страница чата, список чатов
- [x] Экран выбора продукта (Jack / WannaNew)
- [x] Темная тема
- [x] Голосовой ввод (Web Speech API)
- [x] Озвучка LEO через Yandex SpeechKit TTS (`POST /api/ai/tts`)
- [x] UI-кнопки social login (Google/Yandex) + OAuth callback page
- [x] Privacy / Terms, PostHog, Sentry (client)
- [x] Ссылка на Telegram Support в UI

### Conversation Service
- [x] REST API + WebSocket
- [x] Диалоговый движок с ветвлением
- [x] Мульти-агентная система
- [x] Поддержка сценариев: jack-profile-v2, wannanew-pm-v1

### AI/NLP Service
- [x] Интеграция YandexGPT
- [x] Эндпоинты: generate-step, validate-answer, analyze-profile, check-context, free-chat
- [x] TTS (Yandex SpeechKit), Interview Prep (`/api/ai/interview/*`)
- [x] Sentry в error handler

### Telegram Support Service
- [x] Бот @leoaisupportbot, тикеты в группу LEO Support
- [x] Polling (dev) / webhook + ngrok (VPS)

### Job Matching Service
- [x] HH.ru API scraper + mock-режим
- [x] Rule-based скоринг (0-100)
- [x] BullMQ cron (ежечасный запуск)

### Email Service
- [x] SMTP (Yandex) + SendGrid
- [x] Handlebars-шаблоны: welcome, jobs-digest

### Report Service
- [x] Генерация PDF (Puppeteer)
- [x] Yandex Object Storage, подписанные URL

### Интеграция
- [x] Завершение диалога -> подбор вакансий -> email (для Jack)

### Career Onboarding
- [x] 7-шаговый визард
- [x] Сохранение прогресса (localStorage)
- [x] Интеграция с чатом

### Рефакторинг
- [x] Валидация конфигов, обработка ошибок, health checks, type safety

### Документация
- [x] Архитектура, конфигурация, деплой, BPMN-диаграммы

---

## Текущие задачи (приоритет: высокий)

- [x] Production OAuth (Google/Yandex) + redirect URI `https://leo-ai.ru` (2026-05)
- [x] TTS на Yandex SpeechKit (2026-05)
- [x] Sentry + PostHog на стенде (2026-05)
- [x] Telegram Support на стенде (2026-05)
- [ ] `HH_API_KEY` / SuperJob для живого Jack matching на проде
- [ ] Server-side STT (SpeechKit) — остаётся browser STT для ввода
- [ ] E2E тестирование полного flow (регистрация -> диалог -> результат)
- [ ] Автоматические тесты (Jest) для всех сервисов
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] API Gateway (единая точка `/api/*`) — опционально при росте
- [ ] Sentry alerts / SLO dashboards (MVP 1)

### Smoke gate (MVP 0)

- Команда: `npm run smoke:mvp0`
- Скрипт: `scripts/smoke/mvp0-smoke.sh`
- Проверки:
  - health для `user-profile`, `conversation`, `job-matching`, `report`;
  - auth-доступ к `GET /api/users/profile`;
  - проверка `chat session` (при `SESSION_ID`);
  - проверка `jobs match` (при `USER_ID`);
  - проверка `report status` (при `REPORT_ID`).

---

## Следующие этапы

### Улучшение AI
- [ ] Доработка промптов для повышения качества диалогов
- [ ] Память разговоров (conversation memory)
- [ ] Поддержка длинного контекста

### Улучшение Job Matching
- [ ] Векторный поиск (Qdrant)
- [ ] ML-ранжирование вакансий
- [ ] Дополнительные источники вакансий

### Расширение WannaNew
- [x] Загрузка резюме (career upload + extract-profile-from-resume)
- [ ] Расширенное интервью (5-7 вопросов)
- [x] AI-скоринг ответов (Interview Prep Prompt V2)
- [ ] Gap-анализ навыков

### AI Career Onboarding (Stage 1)
- [ ] Resume Agent — анализ и улучшение резюме
- [ ] Skills Analysis — оценка навыков
- [ ] Career Path Agent — построение карьерной траектории
- [ ] Learning Agent — рекомендации по обучению
- [ ] AI Readiness Score — общая оценка готовности

### Premium Voice
- [x] Yandex SpeechKit TTS (production)
- [ ] Yandex SpeechKit STT (server-side ввод)

### Production
- [x] Sentry (все сервисы + frontend)
- [x] PostHog (frontend)
- [ ] Prometheus/Grafana, формальные SLO
- [ ] Аудит безопасности (полный)
- [x] Rate limiting на `/api/ai/*`
- [x] SSL (Caddy + `leo-ai.ru`, 2026-05-06)
- [x] VPS runbook ([VPS_STAGING_RUNBOOK.md](./VPS_STAGING_RUNBOOK.md), [../STAGING_DEPLOY.md](../STAGING_DEPLOY.md))
- [ ] Автоматизированный backup PostgreSQL (cron + retention + restore smoke)

---

## Долгосрочные цели

- Мобильное приложение (React Native)
- B2B-направление (Jill Service — подбор кандидатов для компаний)
- Talent Marketplace (связь кандидатов и работодателей)
- AI Career Agent (автономная подача заявок на вакансии)
- Расширение WannaNew на другие профессии (Designer, Engineer и др.)

---

## Технический долг

- [ ] Нет автоматических тестов (unit, integration)
- [ ] Нет E2E тестов
- [ ] Отсутствует API Gateway
- [ ] Дефолт `PORT=8080` в нескольких сервисах — риск коллизий при запуске без явного `PORT` (см. [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md))
- [ ] LLM-валидация коротких ответов на числовых шагах сценария Jack (нап `positionsCount`) — риск зацикливания диалога
- [ ] Job matching: жёсткий порог `score >= 30` без объяснения пользователю при пустом списке

Уже закрыто в коде (проверять при регрессии): передача `product` при создании сессии по WebSocket; вызов интеграции при завершении по REST; триггер report для wannanew; CORS `localhost` + `127.0.0.1` для user-profile.

Уже закрыто в инфраструктуре (2026-05): VPS (`Cloud.ru + Docker Compose + Caddy HTTPS`), агрегированный health `https://leo-ai.ru/api/health`, альфа-тест: [../ALPHA_TEST.md](../ALPHA_TEST.md).
