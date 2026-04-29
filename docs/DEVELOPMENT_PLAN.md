# LeoAI — План разработки

> Краткий план развития проекта. Детали архитектуры — в `ARCHITECTURE.md`.  
> **Приоритизированный план улучшений по свежему анализу (анкета, вакансии, окружение):** [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md).

---

## MVP 0: границы релиза (single source)

- **Цель MVP 0:** стабильный end-to-end путь `chat/interview -> финальный результат` **для каждого** co-primary сценария (см. scope freeze 2026-04-18 в `IMPROVEMENT_PLAN.md`).
- **Релизный путь A (Jack):** `Профиль -> подбор вакансий -> email`.
- **Релизный путь B (WannaNew):** `Интервью -> report preview -> PDF`.
- **Правило MVP 0:** пути A и B входят в релиз как **co-primary**; модель «второй только support/partial» не используем.

### Статус компонентов (Implemented / Partial / Planned)

| Компонент | Статус MVP 0 |
|---|---|
| User auth + profile | Implemented |
| Conversation orchestration (REST + WS dev) | Implemented |
| Jack flow (matching + email) | Partial |
| WannaNew flow (report preview + PDF) | Partial |
| Career onboarding (production persistence) | Partial |
| Security baseline (no fallback secrets, rate-limit, unified auth) | Implemented |
| Smoke/integration release gate | Implemented |
| Release runbook + staging rehearsal | Implemented |

*Смысл статусов в таблице:* `Implemented` — закрыто по смыслу для MVP0; `Partial` — работает, остаётся существенный долг или риск; `Planned` — к релизу по пункту ещё не доведено.

---

## Реализовано (база платформы)

### Инфраструктура
- [x] Docker Compose (все сервисы + зависимости)
- [x] PostgreSQL, Redis
- [x] Dockerfiles для каждого сервиса

### User Profile Service
- [x] Регистрация и аутентификация (JWT)
- [x] Управление профилями пользователей

### Frontend
- [x] Next.js 14, App Router
- [x] Лендинг, страница чата, список чатов
- [x] Экран выбора продукта (Jack / WannaNew)
- [x] Темная тема
- [x] Голосовой ввод (Web Speech API)

### Conversation Service
- [x] REST API + WebSocket
- [x] Диалоговый движок с ветвлением
- [x] Мульти-агентная система
- [x] Поддержка сценариев: jack-profile-v2, wannanew-pm-v1

### AI/NLP Service
- [x] Интеграция YandexGPT
- [x] Эндпоинты: generate-step, validate-answer, analyze-profile, check-context, free-chat

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

- [ ] Настроить API-ключи (YC_API_KEY, HH_API_KEY, SMTP) для полноценной работы
- [ ] E2E тестирование полного flow (регистрация -> диалог -> результат)
- [ ] Автоматические тесты (Jest) для всех сервисов
- [ ] CI/CD pipeline (GitHub Actions -> Yandex Cloud)
- [ ] API Gateway (nginx) для production

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
- [ ] Загрузка резюме
- [ ] Расширенное интервью (5-7 вопросов)
- [ ] AI-скоринг ответов
- [ ] Gap-анализ навыков

### AI Career Onboarding (Stage 1)
- [ ] Resume Agent — анализ и улучшение резюме
- [ ] Skills Analysis — оценка навыков
- [ ] Career Path Agent — построение карьерной траектории
- [ ] Learning Agent — рекомендации по обучению
- [ ] AI Readiness Score — общая оценка готовности

### Premium Voice
- [ ] Интеграция Yandex SpeechKit (TTS + STT)

### Production
- [ ] Мониторинг (Sentry, Prometheus/Grafana)
- [ ] Аудит безопасности
- [ ] Rate limiting
- [ ] SSL-сертификаты

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
