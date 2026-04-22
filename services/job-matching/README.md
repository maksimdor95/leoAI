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

- `GET /api/jobs/catalog` — список вакансий в БД (отладка / админ). Query: `source` (например `superjob.ru`, `hh.ru`), `limit` (≤200), `offset`. В **production** обязателен `JOB_CATALOG_TOKEN` в env и заголовок `X-Job-Catalog-Token` или `Authorization: Bearer`. В dev без токена доступ открыт.
- `GET /api/jobs/hh/salary-evaluation/:areaId` — прокси к HH Salary Bank API (`/salary_statistics/paid/salary_evaluation/{areaId}`), поддерживает query-параметры HH и использует OAuth на стороне сервиса
- `GET /api/jobs/match/:userId` - получить подходящие вакансии для пользователя
- `GET /api/jobs/:jobId` - получить детали вакансии
- `POST /api/jobs/refresh` - запустить скрейпинг вакансий

### UI (frontend)

Страница `/admin/jobs` (клиентский запрос из браузера) читает каталог с `NEXT_PUBLIC_JOB_MATCHING_URL` (по умолчанию `http://127.0.0.1:3004`). Если на job-matching задан `JOB_CATALOG_TOKEN`, введите его в поле на странице. Убедитесь, что `CORS_ORIGIN` сервиса совпадает с origin фронта.

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
- `JOB_CATALOG_TOKEN` (опционально) — защита `GET /api/jobs/catalog`; в production без него каталог отключён
- `HH_CLIENT_ID`, `HH_CLIENT_SECRET` — OAuth credentials HH для salary API
- `HH_ACCESS_TOKEN` (опционально) — если хотите использовать заранее полученный bearer token HH напрямую
- `HH_REFRESH_TOKEN` (опционально) — refresh token для автоматического обновления access token
- `HH_USER_AGENT` — обязателен для HH API, формат вида `AppName/Version (email)`

**SuperJob (дополнительно к `SUPERJOB_API_KEY`):** `SUPERJOB_TOWN` (по умолчанию город **4** — Москва), `SUPERJOB_TOWN_IDS` (например `4,14`), `SUPERJOB_KEYWORD_LIMIT`, `SUPERJOB_PAGE_SIZE` (max 100), `SUPERJOB_MAX_PAGES`, `SUPERJOB_MAX_VACANCIES_PER_KEYWORD`, `SUPERJOB_REQUEST_DELAY_MS`.

## Matching Algorithm:

Сервис использует rule-based алгоритм матчинга на основе:

- Локация (25 баллов)
- Должность/роль (25 баллов)
- Навыки (25 баллов)
- Уровень опыта (15 баллов)
- Режим работы (10 баллов)

Вакансии с оценкой < 30 не включаются в результаты.
