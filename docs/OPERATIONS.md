# Эксплуатация и настройка LEO AI

*Актуально на 2026-05-27*

## 1. Локальная разработка

### Требования

- Node.js 18+, Docker, Docker Compose

### Быстрый старт

```bash
# Корневой .env — DB_PASSWORD, JWT_SECRET, YC_*, SMTP, OAuth (см. HISTORY/CONFIGURATION.md)
docker compose up -d          # PostgreSQL, Redis, resume-parser

npm install
npm run dev:up                # все сервисы + frontend (логи в .runlogs/)
```

Открыть http://localhost:3000

### Полезные команды

| Команда | Описание |
|---------|----------|
| `npm run dev:up` | Запуск всех сервисов |
| `npm run dev:down` | Остановка |
| `npm run dev:status` | Health по портам |
| `npm run dev:up:staging` | Локально с `.env.staging.local` (OAuth → leo-ai.ru) |
| `npm run smoke:mvp0` | Smoke-тест MVP0 |

---

## 2. Конфигурация (.env)

Все backend-сервисы используют **один и тот же** `JWT_SECRET`.

### Минимум для работы

| Переменная | Назначение |
|------------|------------|
| `DB_PASSWORD` | PostgreSQL |
| `JWT_SECRET` | Auth между сервисами |
| `YC_API_KEY`, `YC_FOLDER_ID` | YandexGPT, TTS |
| `SMTP_USER`, `SMTP_PASSWORD` | Email (или SendGrid) |

Полный справочник: [HISTORY/CONFIGURATION.md](./HISTORY/CONFIGURATION.md)

### Справочник портов

| Сервис | Порт |
|--------|------|
| Frontend | 3000 |
| User Profile | 3001 |
| Conversation | 3002 |
| AI/NLP | 3003 |
| Job Matching | 3004 |
| Email | 3005 |
| Report | 3007 |
| Telegram Support | 3008 |
| Resume Parser (Docker) | 3011 |

---

## 3. Staging / production (VPS)

Актуальный контур: **Cloud.ru VPS + Docker Compose + Caddy + `npm run dev:up:staging`**.

Подробный runbook: [STAGING_DEPLOY.md](./STAGING_DEPLOY.md)

```bash
ssh ubuntu@84.54.57.209
cd ~/leoAI
npm run dev:deploy:staging
```

Секреты на сервере: `.env.staging.local` (не в git).

### Caddy (маршрутизация `/api/*`)

Пример актуального конфига: [infrastructure/caddy/Caddyfile.example](../infrastructure/caddy/Caddyfile.example).

Важно: **`/api/email*`** → порт **3005** (email-service), до catch-all `/api/*` → 3001. Без этого форма «Написать нам» даёт 404.

После правки Caddy на VPS:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://leo-ai.ru/api/email/send-consultation \
  -H "Content-Type: application/json" -d '{"message":"test","consent":true}'
# ожидается 200
```

---

## 4. Операционный чеклист

| Действие | Команда / URL |
|----------|----------------|
| Статус сервисов на VPS | `npm run dev:status` |
| Агрегированный health | `curl -s https://leo-ai.ru/api/health \| jq` |
| Главная | `curl -s -o /dev/null -w "%{http_code}\n" https://leo-ai.ru/` |
| Логи | `tail -50 ~/leoAI/.runlogs/frontend.log` |
| Docker (БД) | `docker compose ps` |
| Smoke | `npm run smoke:mvp0` |
| Telegram bot health | `curl -s http://127.0.0.1:3008/health` (на VPS) |

### Мониторинг

- **Sentry:** `SENTRY_DSN` (сервисы), `NEXT_PUBLIC_SENTRY_DSN` (frontend)
- **PostHog:** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

Алерты и SLO-дашборды — в scope MVP 1.

### Безопасность

- Снаружи: порты 22, 80, 443
- Не публиковать PostgreSQL/Redis наружу
- Секреты только в `.env` / `.env.staging.local`, не в git

---

## 5. Поддержка пользователей

- Telegram: [@leoaisupportbot](https://t.me/leoaisupportbot)
- Документация бота: [services/telegram-support/README.md](../services/telegram-support/README.md)
