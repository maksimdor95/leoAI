# LeoAI — Руководство по деплою (Yandex Cloud)

## Требования

- Node.js 18+, Docker, Docker Compose
- Yandex Cloud CLI (`yc`) — [установка](https://cloud.yandex.ru/docs/cli/quickstart)
- PostgreSQL 14+ (Yandex Managed PostgreSQL или self-hosted)
- Redis 7+ (Yandex Managed Redis или self-hosted)

## Production-переменные окружения

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

### Yandex Serverless Containers

1. GitHub Actions собирает Docker-образы и публикует в Yandex Container Registry.
2. Каждый сервис разворачивается как Serverless Container.
3. WebSocket не поддерживается в serverless — для `conversation` используйте REST API с polling.

## GitHub Actions секреты

### Repository Secrets

| Секрет | Описание |
|---|---|
| `YC_REGISTRY_ID` | ID реестра Container Registry |
| `YC_SERVICE_ACCOUNT_ID` | ID сервисного аккаунта |
| `YC_SERVICE_ACCOUNT_KEY_JSON` | JSON-ключ сервисного аккаунта |
| `YC_ACCESS_KEY_ID` | Access Key (Object Storage) |
| `YC_SECRET_ACCESS_KEY` | Secret Key (Object Storage) |
| `YC_API_KEY` | API-ключ YandexGPT |
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_PORT` | Параметры PostgreSQL |
| `REDIS_HOST` / `REDIS_PASSWORD` | Параметры Redis |
| `JWT_SECRET` | Секрет JWT |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_SECURE` | SMTP-параметры |
| `FROM_EMAIL` / `FROM_NAME` | Отправитель |

### Workflow-переменные (не секреты)

| Переменная | Описание |
|---|---|
| `YC_FOLDER_ID` | ID каталога Yandex Cloud |
| `YC_NETWORK_ID` | ID сети |
| `YC_SUBNET_ID` | ID подсети |

## Nginx (Reverse Proxy)

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

Serverless Containers:

```bash
yc serverless container revision list --container-name leoai-user-profile
yc serverless container revision deploy --container-name leoai-user-profile --revision-id <ID>
```

PM2 (через git):

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
