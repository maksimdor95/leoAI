# Техническая архитектура LEO AI

## 1. Обзор системы

LEO AI построен на микросервисной архитектуре (Node.js + Express + TypeScript). Все сервисы используют общую инфраструктуру и AI-контур (YandexGPT).

### Стек технологий
- **Frontend:** Next.js 14 (App Router, Static Export), Ant Design, Tailwind.
- **Backend:** Node.js, Express, TypeScript.
- **AI:** YandexGPT, SpeechKit (STT/TTS).
- **Data:** PostgreSQL (основная БД), Redis (сессии, очереди BullMQ).
- **Storage:** Yandex Object Storage (S3) для PDF-отчётов.
- **Infra:** Docker Compose, VPS (Cloud.ru), Caddy (HTTPS).

---

## 2. Карта сервисов

| Сервис | Порт | Назначение |
|--------|------|------------|
| **Frontend** | 3000 | Next.js SPA, Web Speech API |
| **User Profile** | 3001 | Auth (JWT, OAuth), Профили, Резюме |
| **Conversation** | 3002 | Движок диалога, Сценарии, WebSocket/REST |
| **AI/NLP** | 3003 | Агенты (Validator, Analyst, Context), YandexGPT |
| **Job Matching** | 3004 | Скрейпинг HH/SuperJob, Scoring Engine |
| **Email** | 3005 | Уведомления (SMTP/Yandex, SendGrid) |
| **Report** | 3007 | Генерация PDF (Puppeteer), S3 Upload |

---

## 3. Мультиагентная система (AI/NLP)

AI/NLP Service реализует специализированных агентов:
- **Validator:** Оценка качества ответа пользователя.
- **Profile Analyst:** Анализ полноты собранного профиля.
- **Context Manager:** Обнаружение отклонений от темы диалога.

---

## 4. Сценарии и Интеграции

### Регистр сценариев (Conversation Service)
- `jack-profile-v2`: Сценарий поиска вакансий. Завершается вызовом Job Matching + Email.
- `wannanew-pm-v1`: Сценарий PM-интервью. Завершается вызовом Report Service (PDF).

### Техническая реализация WannaNew
- **Файлы:** `wannanewScenario.ts`, `reportGenerator.ts`, `pdfGenerator.ts`.
- **Поток:** После завершения диалога `IntegrationService` триггерит генерацию отчёта. Фронтенд опрашивает статус `/api/report/:id/status` до готовности.

---

## 5. Модель данных

### PostgreSQL
- `jack.users`: Аккаунты, OAuth IDs.
- `jack.career_profiles`: Роли, опыт, локация.
- `jack.resumes`: Файлы и распарсенные данные.
- `public.jobs`: Вакансии из HH/SuperJob.

### Redis
- `session:{id}`: Состояние чата (steps, collectedData).
- `ai:nlp:history:{id}`: Контекст для YandexGPT.
- `report:{id}`: Статус генерации PDF.

---

## 6. Внешние интеграции

- **OAuth (Google/Yandex):** Реализовано в `user-profile`.
- **Voice:** Web Speech API (клиент) + Yandex SpeechKit (целевой серверный контур).
- **Job Sources:** HH.ru API, SuperJob API.
