# AI/NLP Service

AI-сервис, который взаимодействует с YandexGPT для генерации ответов Jack и извлекает полезные факты из диалога.

## Возможности

- Принимает сообщения от Conversation Service
- Формирует промпт Jack и отправляет в YandexGPT
- Возвращает ответ ассистента и обновляет историю диалога
- Извлекает факты (email, навыки и др.) и сохраняет в Redis

## Требования

- Node.js 18+
- Redis (можно использовать контейнер из `docker-compose.yml`)
- Yandex Cloud CLI (`yc`) с активной папкой
- Сервисный аккаунт с ролью `ai.languageModels.user`
- API-ключ для Foundation Models (см. ниже)

## Настройка окружения Yandex Cloud

1. Убедитесь, что `yc` установлен: `yc --version`
2. Если нужно, выполните `yc init` и выберите нужное облако и папку
3. Создайте сервисный аккаунт:
   ```bash
   yc iam service-account create --name jack-ai-nlp-sa
   yc resource-manager folder add-access-binding <folder-id> \
     --role ai.languageModels.user \
     --service-account-id <sa-id>
   ```
4. Создайте API-ключ:
   ```bash
   yc iam api-key create --service-account-id <sa-id> --description "jack-ai-nlp"
   ```
5. Сохраните значения `folder-id` и `API key` — они понадобятся для `.env`

## Переменные окружения

Создайте файл `.env` (пример ниже). Если файл не создаётся автоматически, скопируйте текст вручную:

```
PORT=3003
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_PREFIX=ai:nlp:

# Yandex Cloud
YC_FOLDER_ID=<ваш folder-id>
YC_API_KEY=<секрет API ключа>
YC_MODEL_ID=foundation-models/yandexgpt-lite
YC_TEMPERATURE=0.6
YC_TOP_P=0.9
YC_MAX_TOKENS=800
TTS_VOICE=ermil
TTS_SPEED=1.0
TTS_FORMAT=oggopus
TTS_PRESET=ermil_normal

LOG_LEVEL=info
```

## Установка зависимостей

```bash
cd services/ai-nlp
npm install
```

## Запуск сервиса

```bash
npm run dev
```

После запуска:

- Health check: `http://localhost:3003/health`
- Основной endpoint: `POST http://localhost:3003/api/ai/process-message`

Пример запроса:

```json
{
  "sessionId": "123",
  "userId": "user-001",
  "message": "Привет! Я ищу работу продакт-менеджера"
}
```

## Структура проекта

```
src/
├── index.ts              # Точка входа, Express сервер
├── config/
│   └── redis.ts          # Подключение к Redis
├── controllers/
│   └── aiController.ts   # REST endpoint для обработки сообщений
├── services/
│   ├── yandexClient.ts   # Вызов YandexGPT
│   ├── contextService.ts # История и факты в Redis
│   ├── promptService.ts  # Промпты для Jack
│   └── factsExtractor.ts # Извлечение фактов
└── types/
    ├── ai.ts             # Типы сообщений
    └── request.ts        # Типы API-запросов
```

## Следующие шаги

- Настроить более умный анализ фактов
- Добавить тесты и мониторинг
- Реализовать fallback на другие модели (если требуется)
