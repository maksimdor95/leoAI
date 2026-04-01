# Conversation Service

WebSocket/REST сервис для общения пользователя с AI в реальном времени.

## Технологии

- **Node.js** + **TypeScript**
- **Socket.io** - WebSocket сервер (для локальной разработки)
- **Express** - HTTP сервер (REST API для Serverless)
- **Redis** - хранение сессий
- **Axios** - интеграция с AI/NLP сервисом

## Функциональность

- ✅ REST API для чата (основной метод для Production/Serverless)
- ✅ WebSocket соединение для локальной разработки
- ✅ **Мульти-продуктовая поддержка** (Jack/LEO и wannanew)
- ✅ **Регистр сценариев** с динамической загрузкой
- ✅ Управление сессиями разговора (с `product` и `scenarioId`)
- ✅ Сохранение истории сообщений
- ✅ Разные типы сообщений:
  - Текстовые сообщения
  - Вопросы (отображаются по центру)
  - Информационные карточки
  - Команды/кнопки (сценарии)
- ✅ Интеграция с User Profile Service (авторизация)
- ✅ REST-интеграция с AI/NLP Service (Yandex GPT)
- ✅ **Условная логика интеграций** (Job Matching только для Jack)
- ✅ Тестовая страница `/test-client.html` для ручной проверки WebSocket потока

## Продукты и сценарии

| Product | Scenario ID | Описание | Интеграции при завершении |
|---------|-------------|----------|---------------------------|
| `jack` | `jack-profile-v2` | Сбор профиля для поиска работы | Job Matching → Email |
| `wannanew` | `wannanew-pm-v1` | Подготовка PM к собеседованиям | Report Service → PDF ✅ |

### Создание сессии с продуктом

```bash
# Создать сессию Jack (по умолчанию)
curl -X POST /api/chat/session -d '{"createNew": true}'

# Создать сессию wannanew
curl -X POST /api/chat/session -d '{"createNew": true, "product": "wannanew"}'
```

### PDF-отчёт для wannanew ✅

```bash
# Запросить генерацию PDF-отчёта
curl -X POST /api/chat/session/{sessionId}/report

# Получить статус и URL для скачивания
curl /api/chat/session/{sessionId}/report/{reportId}
```

Эти endpoints проксируют запросы на Report Service.

### Регистр сценариев

Сценарии определены в `src/scenario/`:
- `jackScenario.ts` — сценарий Jack/LEO
- `wannanewScenario.ts` — сценарий wannanew для PM

Регистр в `dialogueEngine.ts`:
```typescript
const SCENARIOS: Record<string, ScenarioDefinition> = {
  'jack-profile-v2': JACK_SCENARIO,
  'wannanew-pm-v1': WANNANEW_SCENARIO,
};
```

## Установка

```bash
# Установить зависимости
npm install
```

## Переменные окружения

Файл `.env` (создать вручную при необходимости):

```
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# User Profile Service
USER_PROFILE_SERVICE_URL=http://localhost:3001
JWT_SECRET=your-secret-key-change-in-production

# AI/NLP Service
AI_SERVICE_URL=http://localhost:3003

# Report Service (для wannanew PDF-отчётов)
REPORT_SERVICE_URL=http://localhost:3007
```

## Запуск

```bash
# Режим разработки
npm run dev

# Production
npm run build
npm start
```

## Быстрая проверка WebSocket через браузер

1. Запусти все сервисы (`user-profile`, `conversation`, `ai-nlp`, `frontend`).
2. Авторизуйся на фронтенде `http://localhost:3000` (нажми "Начать поиск работы" и войди в систему) и скопируй токен `jack_token` из Local Storage (DevTools → Application → Local Storage).
3. Открой `http://localhost:3002/test-client.html`.
4. Вставь токен, нажми «Подключиться» и введи сообщение. Ответ Jack появится в логах.

## WebSocket API

### Подключение

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3002', {
  auth: {
    token: 'your-jwt-token',
  },
});
```

### События

#### От клиента к серверу:

- `message:send` - отправить сообщение

  ```javascript
  socket.emit('message:send', { content: 'Hello!' });
  ```

- `command:execute` - выполнить команду
  ```javascript
  socket.emit('command:execute', {
    commandId: 'continue',
    action: 'continue_conversation',
  });
  ```

#### От сервера к клиенту:

- `session:joined` - сессия создана/подключена

  ```javascript
  socket.on('session:joined', ({ sessionId }) => {
    console.log('Session ID:', sessionId);
  });
  ```

- `session:history` - история сообщений

  ```javascript
  socket.on('session:history', ({ messages }) => {
    console.log('History:', messages);
  });
  ```

- `message:received` - новое сообщение

  ```javascript
  socket.on('message:received', ({ message }) => {
    console.log('New message:', message);
  });
  ```

- `error` - ошибка
  ```javascript
  socket.on('error', ({ message }) => {
    console.error('Error:', message);
  });
  ```

## Типы сообщений

### TextMessage

Обычное текстовое сообщение в чате.

### QuestionMessage

Вопрос, отображаемый по центру экрана.

### InfoCardMessage

Информационные карточки с заголовками и описаниями.

### CommandMessage

Команды/кнопки для выполнения действий (сценарии).

## Структура проекта

```
src/
├── index.ts              # Главный файл, WebSocket сервер
├── config/
│   └── database.ts       # Redis подключение
├── services/
│   ├── sessionService.ts # Управление сессиями
│   ├── authService.ts    # Авторизация
│   └── aiClient.ts       # Вызов AI/NLP сервиса
├── utils/
│   └── logger.ts         # Универсальный логгер
├── types/
│   ├── message.ts        # Типы сообщений
│   └── session.ts        # Типы сессий
└── public/
    └── test-client.html  # Тестовая страница WebSocket
```

## Следующие шаги

- Шаг 1.4: Интеграция с AI/NLP сервисом ✅
- Шаг 1.5: Frontend для чата
