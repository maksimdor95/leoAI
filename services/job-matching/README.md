# Job Matching Service

Сервис для поиска и подбора вакансий.

## Функции:

- Сбор вакансий из разных источников
- Подбор вакансий под профиль пользователя
- Ранжирование по релевантности
- Фильтрация некачественных вакансий

## Технологии:

- Node.js (TypeScript) с Express
- PostgreSQL для хранения вакансий
- Redis для очередей (BullMQ)
- BullMQ для фоновых задач скрейпинга

## Структура:

```
src/
├── config/          # Конфигурация БД и Redis
├── controllers/     # HTTP контроллеры
├── models/          # Модели данных и репозитории
├── routes/          # API маршруты
├── services/        # Бизнес-логика (scraper, matcher, queue)
├── utils/           # Утилиты (logger, jwt)
└── workers/         # Фоновые воркеры (scraper worker)
```

## API Endpoints:

- `GET /api/jobs/match/:userId` - получить подходящие вакансии для пользователя
- `GET /api/jobs/:jobId` - получить детали вакансии
- `POST /api/jobs/refresh` - запустить скрейпинг вакансий

## Запуск:

```bash
# Установка зависимостей
npm install

# Инициализация БД
npm run init:db

# Разработка
npm run dev

# Production
npm run build
npm start
```

## Переменные окружения:

- `PORT` - порт сервиса (по умолчанию: 3004)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - настройки PostgreSQL
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - настройки Redis
- `USER_PROFILE_SERVICE_URL` - URL сервиса профилей (по умолчанию: http://localhost:3001)
- `JWT_SECRET` - секретный ключ для JWT

## Matching Algorithm:

Сервис использует rule-based алгоритм матчинга на основе:

- Локация (25 баллов)
- Должность/роль (25 баллов)
- Навыки (25 баллов)
- Уровень опыта (15 баллов)
- Режим работы (10 баллов)

Вакансии с оценкой < 30 не включаются в результаты.
