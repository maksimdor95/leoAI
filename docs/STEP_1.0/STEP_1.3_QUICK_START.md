# Шаг 1.3: Conversation Service - Быстрый старт

## ✅ Что уже сделано

1. ✅ Создана структура Conversation Service
2. ✅ Настроен WebSocket сервер (Socket.io)
3. ✅ Реализовано управление сессиями (Redis)
4. ✅ Созданы типы сообщений (текст, вопросы, карточки, команды)
5. ✅ Интеграция с User Profile Service (авторизация)
6. ✅ Заглушка для AI обработки (будет заменено в Шаге 1.4)

---

## 🚀 Что нужно сделать сейчас

### Шаг 1: Установить зависимости

```bash
# Перейти в папку сервиса
cd services/conversation

# Установить зависимости
npm install
```

**Время:** 2-3 минуты

---

### Шаг 2: Создать файл `.env`

Создайте файл `.env` в папке `services/conversation`:

```env
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Redis (используем тот же, что и для User Profile Service)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# User Profile Service
USER_PROFILE_SERVICE_URL=http://localhost:3001
JWT_SECRET=your-secret-key-change-in-production
```

**Время:** 1 минута

---

### Шаг 3: Проверить, что Redis запущен

```bash
# Проверить статус Docker контейнеров
docker-compose ps

# Если Redis не запущен, запустить
docker-compose up -d redis
```

**Время:** 1 минута

---

### Шаг 4: Запустить Conversation Service

```bash
# В папке services/conversation
npm run dev
```

**Ожидаемый результат:**

```
✅ Redis Client Connected
✅ Connected to Redis
🚀 Conversation Service running on port 3002
📝 Environment: development
🔌 WebSocket: ws://localhost:3002/socket.io
```

**Время:** 10 секунд

---

## ✅ Проверка работы

### 1. Health check

Откройте в браузере: `http://localhost:3002/health`

Должно вернуть:

```json
{
  "status": "ok",
  "service": "conversation-service",
  "port": 3002
}
```

### 2. Проверка WebSocket

WebSocket будет протестирован в Шаге 1.5 (Frontend для чата).

---

## 📋 Что работает сейчас

- ✅ WebSocket сервер на порту 3002
- ✅ Авторизация через JWT токен
- ✅ Создание и управление сессиями
- ✅ Сохранение истории сообщений в Redis
- ✅ Обработка сообщений (заглушка)
- ✅ Разные типы сообщений:
  - Текстовые сообщения
  - Вопросы
  - Информационные карточки
  - Команды/кнопки

---

## ⏳ Что будет добавлено позже

- Шаг 1.4: Реальная интеграция с AI/NLP сервисом
- Шаг 1.5: Frontend интерфейс для чата
- Голосовое взаимодействие (TTS)
- Более сложные сценарии

---

## 🐛 Если что-то не работает

### Ошибка подключения к Redis

- Проверьте, что Redis запущен: `docker-compose ps`
- Проверьте настройки в `.env`

### Ошибка авторизации

- Убедитесь, что `JWT_SECRET` совпадает с User Profile Service
- Проверьте, что User Profile Service запущен на порту 3001

### Порт занят

- Измените `PORT` в `.env` на другой порт (например, 3003)

---

## 🎯 Следующий шаг

После успешного запуска Conversation Service:

- **Шаг 1.4**: AI/NLP Service (реальная обработка сообщений)
- **Шаг 1.5**: Frontend для чата (интерфейс пользователя)
