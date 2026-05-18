# Staging deploy (VPS)

Чеклист для обновления стенда **leo-ai.ru** на Evolution VPS.

## Подключение

```bash
ssh ubuntu@84.54.57.209
cd ~/leoAI
```

Репозиторий на сервере: `/home/ubuntu/leoAI`.

## Один раз: секреты

Создайте на VPS файл `.env.staging.local` (скопируйте с Mac, **не коммитьте**).

Минимум для OAuth:

```env
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

## Обычный деплой (после push в main)

На **Mac**:

```bash
cd /Users/maxim/Project/leoAI
git add -A && git commit -m "..." && git push origin main
```

На **VPS**:

```bash
cd ~/leoAI
npm run dev:deploy:staging
```

Это то же самое, что:

```bash
git pull origin main
npm install && (cd frontend && npm install)
for d in services/*/; do (cd "$d" && npm install); done
docker compose up -d
npm run dev:down
npm run dev:kill-ports
npm run dev:up:staging
```

**Важно:** после `dev:kill-ports` всегда нужен `dev:up:staging` (или `dev:deploy:staging`), иначе сайт отдаст **502**.

## Опции скрипта

```bash
bash ./scripts/dev/deploy-staging.sh --skip-pull      # только перезапуск
bash ./scripts/dev/deploy-staging.sh --skip-install   # без npm install
bash ./scripts/dev/deploy-staging.sh --skip-docker    # без docker compose
```

## Проверка

```bash
npm run dev:status
curl -s -o /dev/null -w "%{http_code}\n" https://leo-ai.ru/
curl -s -o /dev/null -w "%{http_code}\n" https://leo-ai.ru/oauth/callback
```

Логи:

```bash
tail -50 ~/leoAI/.runlogs/frontend.log
tail -50 ~/leoAI/.runlogs/user-profile.log
```

## Mac vs VPS

| | Mac | VPS |
|---|-----|-----|
| Путь | `/Users/maxim/Project/leoAI` | `~/leoAI` |
| Env | `.env` | `.env.staging.local` |
| Запуск | `npm run dev:up` | `npm run dev:up:staging` |

Не путайте: `dev:up:staging` на Mac редиректит OAuth на `leo-ai.ru`.
