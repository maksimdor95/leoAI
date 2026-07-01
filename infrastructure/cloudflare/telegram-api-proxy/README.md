# Telegram API proxy (Cloudflare Worker, free)

RU VPS не достаёт до `api.telegram.org`. Worker на Cloudflare ходит туда сам и проксирует запросы бота.

```
telegram-support (VPS) → Worker (*.workers.dev) → api.telegram.org
```

## 1. Cloudflare (5 мин)

1. Регистрация: [dash.cloudflare.com](https://dash.cloudflare.com) (бесплатно).
2. Установка CLI (на Mac):

```bash
npm install -g wrangler
wrangler login
```

3. Секрет (придумай длинную строку, сохрани — понадобится в `.env`):

```bash
cd infrastructure/cloudflare/telegram-api-proxy
npx wrangler secret put PROXY_SECRET
```

4. Деплой:

```bash
npx wrangler deploy
```

В выводе будет URL, например: `https://leo-telegram-api-proxy.<account>.workers.dev`

## 2. Env на VPS

В `~/leoAI/.env.staging.local` (и локально в `.env.staging.local`):

```env
TELEGRAM_API_ROOT=https://leo-telegram-api-proxy.<account>.workers.dev
TELEGRAM_API_PROXY_SECRET=тот_же_секрет_что_PROXY_SECRET
# WARP больше не нужен для Telegram:
# TELEGRAM_PROXY_URL=
```

Закомментируй или удали `TELEGRAM_PROXY_URL` — иначе запросы пойдут в SOCKS вместо Worker.

## 3. Перезапуск бота

```bash
cd ~/leoAI
npm run dev:down
npm run dev:up:staging
tail -f .runlogs/telegram-support.log
# ожидай: Bot connected
```

Проверка с VPS:

```bash
curl -s -X POST "https://leo-telegram-api-proxy.<account>.workers.dev/bot<TOKEN>/getMe" \
  -H "X-Telegram-Proxy-Secret: <секрет>" \
  -H "Content-Type: application/json"
```

Должен вернуться JSON с `"ok":true`.

## Лимиты

Free Workers: ~100k запросов/день — для бота поддержки более чем достаточно.

`getUpdates` с `timeout=25` укладывается в лимит длительности Worker (~30s).
