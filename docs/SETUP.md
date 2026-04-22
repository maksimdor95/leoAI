# Локальная разработка — руководство по настройке

## Требования

- Node.js 18+
- Docker и Docker Compose
- Git

## Быстрый старт

### 1. Клонирование и установка зависимостей

```bash
git clone <repo-url>
cd leoAI
npm install
```

Установите зависимости каждого сервиса:

```bash
cd services/user-profile && npm install && cd ../..
cd services/conversation && npm install && cd ../..
cd services/ai-nlp && npm install && cd ../..
cd services/job-matching && npm install && cd ../..
cd services/email && npm install && cd ../..
cd services/report && npm install && cd ../..
cd frontend && npm install && cd ..
```

### 2. Инфраструктура (PostgreSQL + Redis)

```bash
# Убедитесь, что в корне проекта есть .env
# Минимально нужны DB_PASSWORD и JWT_SECRET
docker compose up -d
```

Будут запущены PostgreSQL (порт 5432) и Redis (порт 6379).

### 3. Инициализация базы данных

```bash
cd services/user-profile && npm run init:db && cd ../..
cd services/job-matching && npm run init:db && cd ../..
```

### 4. Запуск сервисов

Каждый сервис запускается в отдельном терминале:

```bash
# Терминал 1: User Profile (порт 3001)
cd services/user-profile && npm run dev

# Терминал 2: Conversation (порт 3002)
cd services/conversation && npm run dev

# Терминал 3: AI/NLP (порт 3003)
cd services/ai-nlp && npm run dev

# Терминал 4: Job Matching (порт 3004)
cd services/job-matching && npm run dev

# Терминал 5: Email (порт 3005)
cd services/email && npm run dev

# Терминал 6: Frontend (порт 3000)
cd frontend && npm run dev
```

### 5. Проверка

Откройте http://localhost:3000

Health-проверки сервисов:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

## API-ключи (опционально для полной функциональности)

Без API-ключей приложение работает с заглушками (mock/fallback-ответы):

- **YC_API_KEY** + **YC_FOLDER_ID** — для YandexGPT (генерация ответов ИИ)
- **HH_API_KEY** — для скрейпинга вакансий с HH.ru (или установите `USE_MOCK_JOBS=true`)
- **SMTP_HOST** + **SMTP_USER** + **SMTP_PASSWORD** — для отправки email (или **SENDGRID_API_KEY**)
- **YC_STORAGE_*** — для хранения PDF-отчётов (Report Service)

Полный справочник переменных окружения: [docs/CONFIGURATION.md](CONFIGURATION.md).

## Структура проекта

```
leoAI/
├── frontend/              # Next.js 14 приложение
├── services/
│   ├── user-profile/      # Аутентификация, профили (порт 3001)
│   ├── conversation/      # Чат, диалоговый движок (порт 3002)
│   ├── ai-nlp/            # YandexGPT интеграция (порт 3003)
│   ├── job-matching/      # Скрейпинг и подбор вакансий (порт 3004)
│   ├── email/             # Email уведомления (порт 3005)
│   └── report/            # PDF отчёты для wannanew (порт 3007)
├── infrastructure/        # Docker, nginx конфиги
├── docs/                  # Документация
├── docker-compose.yml     # PostgreSQL + Redis
└── .env                   # Локальные переменные окружения (не в git)
```

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| Порт занят | Проверьте `lsof -i :PORT` и остановите конфликтующий процесс |
| БД не инициализирована | Убедитесь, что контейнер PostgreSQL запущен: `docker compose ps` |
| Сервис не стартует | Проверьте наличие `.env` в корне и что все переменные заполнены |
