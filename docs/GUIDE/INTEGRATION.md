# Интеграция сервисов

Документация по интеграции всех компонентов системы Jack AI.

## End-to-End Flow

### Полный цикл: Регистрация → Диалог → Job Matching → Email

1. **Регистрация пользователя**
   - Frontend → User Profile Service (`POST /api/users/register`)
   - Пользователь получает JWT токен
   - Создается профиль в PostgreSQL

2. **Диалог с Jack**
   - Frontend подключается к Conversation Service через WebSocket
   - Conversation Service использует AI/NLP Service для генерации вопросов
   - Ответы пользователя сохраняются в `collectedData` в Redis
   - После завершения диалога (все шаги пройдены), автоматически запускается интеграция

3. **Job Matching (автоматически)**
   - Conversation Service вызывает `handleConversationCompletion()`
   - Интеграционный сервис обращается к Job Matching Service
   - Job Matching Service:
     - Получает профиль пользователя из User Profile Service
     - Получает `collectedData` из Redis (сессия диалога)
     - Применяет matching algorithm
     - Возвращает топ 10-20 подходящих вакансий

4. **Отправка Email (автоматически)**
   - Интеграционный сервис вызывает Email Service
   - Email Service:
     - Получает детали вакансий из Job Matching Service
     - Генерирует персонализированный HTML email
     - Отправляет через SendGrid

## Service-to-Service Communication

### User Profile Service → Job Matching Service

- **Endpoint**: `GET /api/users/profile`
- **Auth**: JWT token (передается в заголовке Authorization)
- **Используется**: Получение профиля пользователя для matching

### Conversation Service → Job Matching Service

- **Endpoint**: `GET /api/jobs/match/:userId`
- **Auth**: JWT token
- **Используется**: Автоматический запуск после завершения диалога

### Job Matching Service → Email Service

- **Endpoint**: `POST /api/email/send-jobs`
- **Auth**: JWT token
- **Body**: `{ userId, jobIds: string[] }`
- **Используется**: Отправка подборки вакансий

### Redis → Services

- **Ключи**:
  - `session:${sessionId}` - данные сессии диалога
  - `user:${userId}:session` - активная сессия пользователя
  - `user:${userId}:sessions` - список всех сессий пользователя
- **Используется**: Получение `collectedData` для matching

## Конфигурация

### Environment Variables

Все сервисы должны иметь следующие переменные окружения:

```bash
# Общие
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:3000

# Базы данных
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jack_ai
DB_USER=postgres
DB_PASSWORD=postgres

REDIS_HOST=localhost
REDIS_PORT=6379

# Service URLs
USER_PROFILE_SERVICE_URL=http://localhost:3001
CONVERSATION_SERVICE_URL=http://localhost:3002
AI_NLP_SERVICE_URL=http://localhost:3003
JOB_MATCHING_SERVICE_URL=http://localhost:3004
EMAIL_SERVICE_URL=http://localhost:3005

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
```

## API Gateway

Для production рекомендуется использовать Nginx как reverse proxy:

- Конфигурация: `infrastructure/nginx/nginx.conf`
- Функции:
  - Маршрутизация запросов к нужным сервисам
  - Rate limiting
  - CORS настройки
  - WebSocket support для Conversation Service

## Триггеры интеграции

### Автоматические триггеры

1. **После завершения диалога**
   - Условие: `nextStepId === null` и завершено > 5 шагов
   - Действие: Вызов `handleConversationCompletion()`
   - Реализация: `services/conversation/src/services/integrationService.ts`

### Ручные триггеры (для разработки/тестирования)

1. **Job Matching**: `POST /api/jobs/refresh` - запустить скрейпинг
2. **Email**: `POST /api/email/send-welcome` - отправить welcome email

## Troubleshooting

### Проблема: Интеграция не запускается после завершения диалога

**Решение:**

- Проверьте, что все шаги завершены (`completedSteps.length > 5`)
- Проверьте логи Conversation Service
- Убедитесь, что JWT токен передается в WebSocket connection

### Проблема: Job Matching не находит вакансии

**Решение:**

- Проверьте, что в базе есть вакансии (`GET /api/jobs` через Job Matching Service)
- Запустите скрейпинг: `POST /api/jobs/refresh`
- Проверьте, что `collectedData` содержит нужные поля (location, skills, desiredRole)

### Проблема: Email не отправляется

**Решение:**

- Проверьте `SENDGRID_API_KEY` в переменных окружения
- Проверьте логи Email Service
- Убедитесь, что Job Matching Service вернул вакансии

## Мониторинг

Для мониторинга интеграции рекомендуется отслеживать:

- Время выполнения полного flow (от регистрации до email)
- Успешность каждого этапа
- Количество отправленных email
- Количество найденных matches на пользователя
