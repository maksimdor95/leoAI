# Staging deploy (VPS)

Чеклист для обновления стенда **leo-ai.ru** на Evolution VPS.

*Актуально на 2026-05-27*

## Подключение

```bash
ssh ubuntu@84.54.57.209
cd ~/leoAI
```

Репозиторий на сервере: `/home/ubuntu/leoAI`.

---

## Один раз: секреты

Создайте на VPS файл `.env.staging.local` (скопируйте с Mac, **не коммитьте**).

### Минимум

```env
# Auth
JWT_SECRET=...
DB_PASSWORD=...

# Yandex Cloud (AI + TTS)
YC_API_KEY=...
YC_FOLDER_ID=...

# OAuth
OAUTH_CALLBACK_BASE_URL=https://leo-ai.ru
FRONTEND_OAUTH_SUCCESS_URL=https://leo-ai.ru/oauth/callback
FRONTEND_OAUTH_ERROR_URL=https://leo-ai.ru/oauth/callback
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Redirect URI в кабинете Яндекса:

`https://leo-ai.ru/api/users/oauth/yandex/callback`

Google OAuth: те же redirect URI для `https://leo-ai.ru`.

### Рекомендуется для стенда

```env
# Email
SMTP_USER=...
SMTP_PASSWORD=...
# Заявки «Написать нам». Нужен MX у домена leo-ai.ru и ящик hello@ (см. ниже).
CONSULTATION_TO_EMAIL=hello@leo-ai.ru
# Пока hello@ не настроен — копия на рабочую почту:
CONSULTATION_BCC=dorochov.maxim@yandex.ru

# Jobs: «Токен приложения» (APPL…) с dev.hh.ru — для поиска вакансий
HH_API_KEY=APPL...
HH_USER_AGENT=leoAI-job-matching/1.0 (your@email)
# Пользовательский OAuth (USER…) — опционально, для salary bank
# HH_ACCESS_TOKEN=USER...
# HH_REFRESH_TOKEN=USER...

# Monitoring
SENTRY_DSN=...
NEXT_PUBLIC_SENTRY_DSN=...
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# Telegram Support
TELEGRAM_BOT_TOKEN=...
TELEGRAM_SUPPORT_CHAT_ID=...
TELEGRAM_SITE_URL=https://leo-ai.ru
TELEGRAM_USE_POLLING=true
# На VPS в РФ при webhook:
# TELEGRAM_USE_POLLING=false
# TELEGRAM_PROXY_URL=socks5h://127.0.0.1:40000
# TELEGRAM_NGROK_AUTOSYNC=true
```

`NEXT_PUBLIC_API_URL` на стенде **не обязателен**: фронт на `leo-ai.ru` ходит на тот же origin (`/api/users`, `/api/chat`, …). Для `localhost:3000` задайте прямые URL в `.env` (см. [HISTORY/CONFIGURATION.md](./HISTORY/CONFIGURATION.md)).

---

## Обычный деплой (после push)

На **Mac** — push ветки (например `main` или feature-ветка).

На **VPS** — из корня репозитория:

```bash
cd ~/leoAI
npm run dev:deploy:staging
```

**Важно:** после `dev:kill-ports` всегда нужен `dev:up:staging` (или `dev:deploy:staging`), иначе сайт отдаст **502**.

### Чистый деплой с ветки (если на сервере были ручные правки)

Сбрасывает код на сервере к `origin/<ветка>`. Файл `.env.staging.local` **не трогает**.

```bash
cd ~/leoAI
bash ./scripts/dev/deploy-staging.sh --branch feat/staging-platform --reset
```

Или через env:

```bash
STAGING_GIT_BRANCH=feat/staging-platform bash ./scripts/dev/deploy-staging.sh --reset
```

### Опции скрипта

```bash
bash ./scripts/dev/deploy-staging.sh --skip-pull
bash ./scripts/dev/deploy-staging.sh --skip-install
bash ./scripts/dev/deploy-staging.sh --skip-docker
bash ./scripts/dev/deploy-staging.sh --branch main --reset
```

---

## Проверка

```bash
npm run dev:status
curl -s https://leo-ai.ru/api/health | head -c 500
curl -s -o /dev/null -w "%{http_code}\n" https://leo-ai.ru/
curl -s -o /dev/null -w "%{http_code}\n" https://leo-ai.ru/oauth/callback
curl -s http://127.0.0.1:3008/health
```

Логи:

```bash
tail -50 ~/leoAI/.runlogs/frontend.log
tail -50 ~/leoAI/.runlogs/user-profile.log
tail -50 ~/leoAI/.runlogs/telegram-support.log
```

---

## Mac vs VPS

| | Mac | VPS |
|---|-----|-----|
| Путь | `/Users/maxim/Project/leoAI` | `~/leoAI` |
| Env | `.env` | `.env.staging.local` |
| Запуск | `npm run dev:up` | `npm run dev:up:staging` |

Не путайте: `dev:up:staging` на Mac редиректит OAuth на `leo-ai.ru`.

---

## Альфа-тест

Перед ссылкой в канал: [ALPHA_TEST.md](./ALPHA_TEST.md)
