# LEO AI

AI-платформа для карьерного развития. Два продукта: **LEO** (поиск работы через диалог с AI) и **wannanew** (подготовка PM к собеседованиям с PDF-отчётом).

## Стек

- **Frontend**: Next.js 14, TypeScript, Ant Design, Tailwind CSS
- **Backend**: Node.js + Express + TypeScript (микросервисы)
- **AI**: YandexGPT (Yandex Cloud)
- **DB**: PostgreSQL 15, Redis 7
- **Infra**: Docker Compose (локально), Yandex Cloud Serverless Containers (production)

## Быстрый старт

```bash
git clone <repository-url>
cd leoAI

# Создайте корневой .env (пример: из вашего локального шаблона/секретов команды)
# Минимально заполните DB_PASSWORD и JWT_SECRET

docker compose up -d          # PostgreSQL + Redis

npm install
for dir in services/user-profile services/conversation services/ai-nlp services/job-matching services/email services/report frontend; do
  (cd $dir && npm install)
done

cd services/user-profile && npm run init:db && cd ../..
cd services/job-matching && npm run init:db && cd ../..
```

Запуск каждого сервиса в отдельном терминале:

```bash
cd services/user-profile && npm run dev   # порт 3001
cd services/conversation && npm run dev   # порт 3002
cd services/ai-nlp && npm run dev         # порт 3003
cd services/job-matching && npm run dev   # порт 3004
cd services/email && npm run dev          # порт 3005
cd frontend && npm run dev                # порт 3000
```

Открыть http://localhost:3000

## Структура проекта

```
leoAI/
├── frontend/              # Next.js SPA
├── services/
│   ├── user-profile/      # Auth, профили (3001)
│   ├── conversation/      # Чат, диалоговый движок (3002)
│   ├── ai-nlp/            # YandexGPT интеграция (3003)
│   ├── job-matching/      # HH.ru скрейпинг, matching (3004)
│   ├── email/             # Email уведомления (3005)
│   └── report/            # PDF отчёты wannanew (3007)
├── docs/                  # Документация
├── docker-compose.yml     # PostgreSQL + Redis
└── .env                   # Локальные переменные окружения (не в git)
```

## Документация

- [Видение продукта и стратегия](./docs/PRODUCT_VISION.md)
- [Техническая архитектура](./docs/ARCHITECTURE.md)
- [Клиентские пути](./docs/USER_JOURNEYS.md)
- [План разработки](./docs/DEVELOPMENT_PLAN.md)
- [Локальная установка](./docs/SETUP.md)
- [Конфигурация](./docs/CONFIGURATION.md)
- [Развёртывание](./docs/DEPLOYMENT.md)
- [wannanew спецификация](./docs/WANNANEW.md)

Полный индекс: [docs/README.md](./docs/README.md)
