# LeoAI — Руководство по деплою

> **Актуальный runbook:** [../STAGING_DEPLOY.md](../STAGING_DEPLOY.md) · **Ops:** [../OPERATIONS.md](../OPERATIONS.md)

## Актуальный production-like контур (VPS)

*Обновлено: 2026-05-27*

- Cloud.ru VPS (Ubuntu 22.04);
- Docker: `postgres`, `redis`, `resume-parser`;
- Node-сервисы: `npm run dev:up:staging` на VPS;
- reverse proxy + TLS через Caddy;
- домен `leo-ai.ru`, health: `https://leo-ai.ru/api/health`.

Подробный runbook:
- [VPS_STAGING_RUNBOOK.md](./VPS_STAGING_RUNBOOK.md)
- [STAGING_DEPLOY.md](../STAGING_DEPLOY.md)

---

## Production-переменные окружения

> **Примечание:** контур **Yandex Cloud Serverless Containers** (workflow `deploy-yc.yml`, `infrastructure/yandex-cloud/`) снят с эксплуатации. Единственный актуальный деплой — **VPS + Caddy** (см. выше). Yandex Cloud по-прежнему используется только как **внешний API**: YandexGPT, SpeechKit TTS, Object Storage для PDF.

### Требования (локально / VPS)

- Node.js 18+, Docker, Docker Compose
- PostgreSQL 14+ (на VPS — Docker `postgres` или managed)
- Redis 7+ (на VPS — Docker `redis` или managed)

### General

| Переменная | Описание | Пример |
|---|---|---|
| `NODE_ENV` | Окружение | `production` |

### Database

| Переменная | Описание | Пример |
|---|---|---|
| `DB_HOST` | Хост PostgreSQL | `rc1a-xxx.mdb.yandexcloud.net` |
| `DB_PORT` | Порт | `6432` |
| `DB_NAME` | Имя базы | `jack_ai` |
| `DB_USER` / `DB_PASSWORD` | Учетные данные | — |
| `DB_SSL` | SSL-подключение | `true` |

### Redis

| Переменная | Описание | Пример |
|---|---|---|
| `REDIS_HOST` | Хост Redis | `c-xxx.rw.mdb.yandexcloud.net` |
| `REDIS_PORT` | Порт | `6379` |
| `REDIS_PASSWORD` | Пароль | — |
| `REDIS_DB` | Номер БД | `0` |

### YandexGPT

| Переменная | Описание | Пример |
|---|---|---|
| `YC_API_KEY` | API-ключ Yandex Cloud | `AQVN...` |
| `YC_FOLDER_ID` | ID каталога | `b1g...` |

### Voice (Yandex SpeechKit)

| Переменная | Описание | Пример |
|---|---|---|
| `TTS_VOICE` | Голос ассистента | `ermil` |
| `TTS_SPEED` | Скорость речи | `1.0` |
| `TTS_FORMAT` | Формат аудио | `oggopus` |
| `TTS_PRESET` | Пресет голоса | `ermil_normal` |
| `STT_LANGUAGE` | Язык распознавания | `ru-RU` |

### Email (SMTP primary, SendGrid fallback)

| Переменная | Описание |
|---|---|
| `SMTP_HOST` | SMTP-сервер (`smtp.yandex.ru`) |
| `SMTP_PORT` | Порт (`465`) |
| `SMTP_USER` / `SMTP_PASSWORD` | Учетные данные |
| `SMTP_SECURE` | TLS (`true`) |
| `FROM_EMAIL` / `FROM_NAME` | Отправитель |
| `SENDGRID_API_KEY` | API-ключ SendGrid (fallback) |

### JWT

| Переменная | Описание |
|---|---|
| `JWT_SECRET` | Секрет подписи (32+ символов) |
| `JWT_EXPIRES_IN` | Время жизни access-токена (`7d`) |
| `JWT_REFRESH_SECRET` | Секрет refresh-токена |
| `JWT_REFRESH_EXPIRES_IN` | Время жизни refresh-токена (`30d`) |

### OAuth (Google / Yandex)

| Переменная | Описание |
|---|---|
| `OAUTH_CALLBACK_BASE_URL` | Базовый URL backend для OAuth callback (`https://leo-ai.ru`) |
| `FRONTEND_OAUTH_SUCCESS_URL` | URL frontend после успешного OAuth |
| `FRONTEND_OAUTH_ERROR_URL` | URL frontend после OAuth ошибки |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials Google |
| `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` | OAuth credentials Yandex |

### Job Scraping

| Переменная | Описание |
|---|---|
| `HH_API_KEY` | API-ключ hh.ru |
| `HH_USER_AGENT` | User-Agent для запросов к HH API |
| `HH_CLIENT_ID` / `HH_CLIENT_SECRET` | OAuth client credentials HH (для salary API) |
| `HH_ACCESS_TOKEN` / `HH_REFRESH_TOKEN` | Явный токен или refresh-механизм для HH |
| `USE_MOCK_JOBS` | Моки вместо API (`false`) |
| `JOB_CATALOG_TOKEN` | Токен защиты admin/debug endpoint-ов `/api/jobs/catalog` и `/api/jobs/hh/salary-evaluation/:areaId` |

### Service URLs

| Переменная | Порт |
|---|---|
| `USER_PROFILE_SERVICE_URL` | `http://localhost:3001` |
| `CONVERSATION_SERVICE_URL` | `http://localhost:3002` |
| `AI_NLP_SERVICE_URL` | `http://localhost:3003` |
| `JOB_MATCHING_SERVICE_URL` | `http://localhost:3004` |
| `EMAIL_SERVICE_URL` | `http://localhost:3005` |
| `REPORT_SERVICE_URL` | `http://localhost:3007` |

### CORS

| Переменная | Описание |
|---|---|
| `CORS_ORIGIN` | Разрешенный origin (`https://leoai.ru`) |

### Storage (Yandex Object Storage, для отчетов)

| Переменная | Описание |
|---|---|
| `YC_STORAGE_ENDPOINT` | `https://storage.yandexcloud.net` |
| `YC_STORAGE_ACCESS_KEY` / `YC_STORAGE_SECRET_KEY` | Ключи доступа |
| `YC_STORAGE_BUCKET` | Имя бакета (`aiheroes-reports`) |

## Варианты запуска

### PM2

```bash
npm install -g pm2
```

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    { name: 'user-profile',  cwd: './services/user-profile',  script: 'dist/index.js', env: { PORT: 3001, NODE_ENV: 'production' } },
    { name: 'conversation',   cwd: './services/conversation',  script: 'dist/index.js', env: { PORT: 3002, NODE_ENV: 'production' } },
    { name: 'ai-nlp',         cwd: './services/ai-nlp',        script: 'dist/index.js', env: { PORT: 3003, NODE_ENV: 'production' } },
    { name: 'job-matching',   cwd: './services/job-matching',  script: 'dist/index.js', env: { PORT: 3004, NODE_ENV: 'production' } },
    { name: 'email',           cwd: './services/email',         script: 'dist/index.js', env: { PORT: 3005, NODE_ENV: 'production' } },
    { name: 'report',          cwd: './services/report',        script: 'dist/index.js', env: { PORT: 3007, NODE_ENV: 'production' } },
  ],
};
```

```bash
npm run build --workspaces
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### Docker

Каждый сервис содержит `Dockerfile` в `services/<name>/`. Инфраструктура (PostgreSQL, Redis) запускается через `docker-compose.yml`:

```bash
docker compose up -d
```

Production-сборка:

```bash
docker build -t leoai-user-profile ./services/user-profile
docker build -t leoai-conversation ./services/conversation
docker build -t leoai-ai-nlp      ./services/ai-nlp
docker build -t leoai-job-matching ./services/job-matching
docker build -t leoai-email        ./services/email
docker build -t leoai-report       ./services/report
```

## Reverse proxy (Caddy / Nginx)

```nginx
upstream user_profile { server 127.0.0.1:3001; }
upstream conversation  { server 127.0.0.1:3002; }
upstream ai_nlp        { server 127.0.0.1:3003; }
upstream job_matching   { server 127.0.0.1:3004; }
upstream email_svc      { server 127.0.0.1:3005; }
upstream report_svc     { server 127.0.0.1:3007; }

server {
    listen 443 ssl;
    server_name leoai.ru;

    ssl_certificate     /etc/letsencrypt/live/leoai.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leoai.ru/privkey.pem;

    location /api/users  { proxy_pass http://user_profile; }
    location /api/chat   { proxy_pass http://conversation; }
    location /api/ai     { proxy_pass http://ai_nlp; }
    location /api/jobs   { proxy_pass http://job_matching; }
    location /api/email  { proxy_pass http://email_svc; }
    location /api/report { proxy_pass http://report_svc; }

    location /socket.io {
        proxy_pass http://conversation;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Health Checks

Все сервисы: `GET /health` (200 OK).

| Сервис | URL |
|---|---|
| user-profile | `http://localhost:3001/health` |
| conversation | `http://localhost:3002/health` |
| ai-nlp | `http://localhost:3003/health` |
| job-matching | `http://localhost:3004/health` |
| email | `http://localhost:3005/health` |
| report | `http://localhost:3007/health` |

## Staging rehearsal (обязательный перед prod)

1. Задеплоить staging с `NODE_ENV=production` и production-like env.
2. Прогнать smoke gate:

```bash
npm run smoke:mvp0
```

3. Проверить один end-to-end пользовательский путь (Jack **или** WannaNew):
   - login/register;
   - сессия диалога;
   - финальный артефакт (`email` или `report PDF`).
4. Зафиксировать результаты в changelog/release notes (passed/failed + блокеры).
5. Только после успешного rehearsal переходить к production rollout.

## Откат (Rollback)

VPS (через git + `dev:deploy:staging`):

```bash
git fetch origin main
git checkout <stable-commit>
bash ./scripts/dev/deploy-staging.sh --skip-pull
```

PM2 (если используется):

```bash
git checkout <commit>
npm run build --workspaces
pm2 restart ecosystem.config.js
```

## Production Checklist

- [ ] Все 6 сервисов запущены и отвечают
- [ ] Health checks проходят (`/health` -> 200)
- [ ] `npm run smoke:mvp0` прошел без ошибок
- [ ] API-ключи настроены (`YC_API_KEY`, `HH_API_KEY`, SMTP)
- [ ] `JWT_SECRET` — криптостойкая строка (32+ символов)
- [ ] База данных инициализирована (`npm run init:db`)
- [ ] SSL/TLS настроен
- [ ] `CORS_ORIGIN` указывает на production-домен
- [ ] Бэкапы PostgreSQL настроены
