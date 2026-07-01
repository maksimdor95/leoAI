# Telegram Support Service

Бот [@leoaisupportbot](https://t.me/leoaisupportbot): обращения из лички → группа **LEO Support**, ответ оператора **reply** → пользователю в личку.

## Переменные окружения

Добавьте в корневой `.env`:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_SUPPORT_CHAT_ID=-5120978370
TELEGRAM_SITE_URL=https://leoai.com
PORT=3008
```

Опционально:

```env
TELEGRAM_OPERATOR_IDS=123456789
TELEGRAM_WEBHOOK_SECRET=случайная_строка
TELEGRAM_WEBHOOK_URL=https://your-domain.com/telegram/webhook
TELEGRAM_USE_POLLING=true
```

## Локальный запуск (без ngrok)

По умолчанию в dev включён **long polling** — webhook не нужен.

```bash
cd services/telegram-support
npm install
npm run dev
```

Проверка:

```bash
curl http://localhost:3008/health
```

Тест в Telegram:

1. Напишите боту `/start`
2. Отправьте текст обращения
3. В группе LEO Support появится карточка
4. **Reply** на карточку → ответ уйдёт пользователю

## 24/7 на VPS через ngrok

На российских VPS `api.telegram.org` часто недоступен. Схема:

1. **ngrok** — публичный HTTPS URL → webhook на порт `3008` (входящие сообщения от Telegram).
2. **Прокси** — исходящие вызовы Bot API (`sendMessage`, `setWebhook`).

### Шаг 1. Прокси для Bot API

Любой HTTP/HTTPS/SOCKS5 прокси **вне РФ** (или Cloudflare WARP на VPS):

```env
TELEGRAM_PROXY_URL=http://user:pass@proxy.example:8080
```

Без прокси сервис на VPS упадёт с `ETIMEDOUT` при старте.

### Шаг 2. ngrok на VPS

```bash
# Установка (один раз)
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
ngrok config add-authtoken YOUR_NGROK_TOKEN
```

Конфиг: `infrastructure/ngrok/telegram-support.yml`  
systemd (опционально): `infrastructure/ngrok/telegram-support.service.example`

```bash
ngrok start --config ~/leoAI/infrastructure/ngrok/telegram-support.yml leo-telegram
```

### Шаг 3. Переменные в `.env.staging.local` на VPS

```env
TELEGRAM_USE_POLLING=false
TELEGRAM_NGROK_AUTOSYNC=true
TELEGRAM_WEBHOOK_SECRET=случайная_длинная_строка
TELEGRAM_PROXY_URL=http://...
```

Порядок запуска: **сначала ngrok**, затем `telegram-support` (автоматически возьмёт URL с `http://127.0.0.1:4040/api/tunnels`).

Платный ngrok с фиксированным доменом — задайте `TELEGRAM_WEBHOOK_URL` вместо autosync.

### Шаг 4. Деплой

```bash
cd ~/leoAI
npm run dev:deploy:staging
curl -s http://127.0.0.1:3008/health
tail -20 .runlogs/telegram-support.log   # Bot connected + Webhook registered
```

Ручная регистрация webhook (если autosync выключен):

```bash
ngrok http 3008   # терминал 1
cd services/telegram-support && npm run sync-webhook-from-ngrok   # терминал 2
```

## Команды бота

При старте сервис сам вызывает `setMyCommands` — в личке с ботом появится кнопка меню (☰) с командами.

| Команда | Действие |
|---------|----------|
| `/start` | Приветствие |
| `/help` | Справка |
| `/privacy` | Ссылка на политику |
| Текст / медиа | Тикет в группу + «Обращение получено» |

В BotFather вручную добавлять команды **не обязательно**, если запущен этот сервис.

## Операторам

Отвечайте **только reply** на сообщение бота с карточкой обращения. Сообщения в группу без reply пользователь не получит.

## Порты

- Сервис: **3008**
- Webhook path: `POST /telegram/webhook`

## Надёжность и безопасность (VPS)

### Не падать при рестарте / нестабильном WARP

- Сервис поднимает HTTP **до** проверки Bot API и не завершается при временной недоступности Telegram.
- Polling с экспоненциальным backoff (3s → 60s), автоматически восстанавливается.
- `/health` возвращает `503` + `telegram.connected: false`, пока API недоступен — видно в `https://leo-ai.ru/api/health`.

### Безопасность

| Переменная | Зачем |
|------------|--------|
| `TELEGRAM_OPERATOR_IDS` | Только эти Telegram ID могут отвечать пользователям из группы LEO Support |
| `TELEGRAM_WEBHOOK_SECRET` | Обязателен в webhook-режиме (`TELEGRAM_STRICT_CONFIG=true`) |
| `BIND_HOST=127.0.0.1` | Порт 3008 только на localhost; снаружи не доступен |
| `TELEGRAM_STRICT_CONFIG=true` | Предупреждения о пустых операторах / секрете webhook |

Рекомендуемый фрагмент `.env.staging.local`:

```env
TELEGRAM_STRICT_CONFIG=true
BIND_HOST=127.0.0.1
TELEGRAM_OPERATOR_IDS=564582497
TELEGRAM_PROXY_URL=socks5h://127.0.0.1:40000
TELEGRAM_USE_POLLING=true
```

### Автоперезапуск (systemd)

Не зависеть от `dev:up` — отдельный unit с `Restart=always`:

`infrastructure/systemd/telegram-support.service.example`

### Webhook через leo-ai.ru (без ngrok)

На RU VPS ngrok с IP сервера не работает. Альтернатива polling:

1. В Caddy добавить `handle /telegram/webhook → 127.0.0.1:3008` (см. `infrastructure/caddy/Caddyfile.example`)
2. `TELEGRAM_USE_POLLING=false`
3. `TELEGRAM_WEBHOOK_URL=https://leo-ai.ru/telegram/webhook`
4. `TELEGRAM_WEBHOOK_SECRET=<длинная случайная строка>`

Исходящие (`sendMessage`) по-прежнему идут через `TELEGRAM_PROXY_URL`.
