# План развития (Roadmap)

*Актуально на 2026-05-27. Публичный стенд: https://leo-ai.ru*

---

## 1. Текущий статус — MVP 0 (завершён)

**Цель:** стабильный end-to-end для Jack и WannaNew на VPS.

| Область | Статус |
|---------|--------|
| Инфраструктура (Docker, VPS, HTTPS, Caddy) | ✅ |
| Jack: чат → профиль → matching → email | ✅ (Partial: нужен `HH_API_KEY` для живых вакансий) |
| WannaNew: интервью → preview → PDF | ✅ |
| Interview Prep (Prompt V2, режимы mock/case/…) | ✅ |
| Auth: JWT + OAuth Google/Yandex на `leo-ai.ru` | ✅ |
| TTS: Yandex SpeechKit (`POST /api/ai/tts`) | ✅ |
| STT: Web Speech API в браузере | ✅ (Chrome; server STT — в backlog) |
| Sentry (backend + frontend) | ✅ (при `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`) |
| PostHog (product analytics) | ✅ (при `NEXT_PUBLIC_POSTHOG_KEY`) |
| Telegram Support [@leoaisupportbot](https://t.me/leoaisupportbot) | ✅ |
| Privacy / Terms | ✅ |
| Smoke gate (`npm run smoke:mvp0`) | ✅ |
| Staging deploy runbook | ✅ [STAGING_DEPLOY.md](./STAGING_DEPLOY.md) |

**Следующий продуктовый шаг:** закрытый альфа-тест (канал) — [ALPHA_TEST.md](./ALPHA_TEST.md).

---

## 2. Ближайшие задачи (до / параллельно MVP 1)

| # | Задача | Статус | Комментарий |
|---|--------|--------|-------------|
| 1 | OAuth production | ✅ Done | Credentials в `.env.staging.local`; redirect на `leo-ai.ru` |
| 2 | Voice hardening | ⚠️ Partial | TTS на SpeechKit ✅; STT в браузере — server STT в backlog |
| 3 | E2E testing | 🔲 Open | Автотесты полного flow (регистрация → результат) |
| 4 | Monitoring | ⚠️ Partial | Sentry + PostHog подключены; алерты/SLO — MVP 1 |
| 5 | Telegram Support | ✅ Done | Сервис `3008`, health OK на стенде |
| 6 | HH.ru live jobs | 🔲 Open | На health часто `hhApiConfigured: false` без `HH_API_KEY` |
| 7 | Автотесты (Jest) + CI/CD | 🔲 Open | — |
| 8 | PostgreSQL backup (cron + restore smoke) | 🔲 Open | — |

---

## 3. План MVP 1 (Event-Driven & Scale)

Детали: [HISTORY/MVP1_PRODUCT_PLATFORM_PLAN.md](./HISTORY/MVP1_PRODUCT_PLATFORM_PLAN.md)  
Ежедневный чеклист: [HISTORY/MVP1_DAILY_EXECUTION_CHECKLIST.md](./HISTORY/MVP1_DAILY_EXECUTION_CHECKLIST.md)

### Эпики

- **Epic A: Event Backbone** — Email, Report через очереди (BullMQ/Redis), outbox, DLQ.
- **Epic B: AI Quality** — Eval pipeline, prompt registry, A/B.
- **Epic C: Search Upgrade** — Qdrant, explainability matching.
- **Epic D: Reliability** — Correlation ID, SLO-дашборды, алерты.
- **Epic E: Security+** — Секрет-менеджер, ротация, PII в логах.

### Таймлайн (ориентир)

| Недели | Фокус |
|--------|--------|
| 1–2 | Scope, SLO, event contracts, observability baseline |
| 3–4 | Async report/email, DLQ/replay |
| 5–6 | Retrieval, matching explainability |
| 6–7 | Server STT, voice observability |
| 7–8 | AI eval + prompt versioning |
| 9–10 | Hardening, Go/No-Go MVP 1 |

---

## 4. Долгосрочный Backlog

- **Resume Agent** — улучшение и генерация резюме
- **Skills Graph** — траектория обучения
- **B2B (LEOWORK AI)** — AI-рекрутер для работодателей → [LEOWORK_METHODOLOGY.md](./LEOWORK%20AI/LEOWORK_METHODOLOGY.md), [IMPLEMENTATION_PLAN.md](./LEOWORK%20AI/LEOWORK_IMPLEMENTATION_PLAN.md), [техспека](./LEOWORK%20AI/LEOWORK_AI.md)
- **Mobile App** — React Native
- **Расширение WannaNew** — роли кроме PM (Designer, Engineer, …)
