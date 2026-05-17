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

## Webhook (staging / prod)

Когда будет HTTPS URL:

```bash
# Терминал 1
npm run dev

# Терминал 2 — ngrok
ngrok http 3008

# В .env:
# TELEGRAM_WEBHOOK_URL=https://xxxx.ngrok-free.app/telegram/webhook
# TELEGRAM_USE_POLLING=false

npm run set-webhook
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
