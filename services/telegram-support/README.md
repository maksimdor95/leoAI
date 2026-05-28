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
