# LEO AI

AI-платформа для карьерного развития: **Jack** (подбор вакансий через диалог) и **WannaNew** (подготовка PM к собеседованиям с PDF-отчётом). Публичный стенд: **https://leo-ai.ru**

## Стек

- **Frontend:** Next.js 14, TypeScript, Ant Design, Tailwind CSS
- **Backend:** Node.js + Express + TypeScript (микросервисы)
- **AI:** YandexGPT, SpeechKit TTS, Interview Prep Prompt V2
- **DB:** PostgreSQL 15, Redis 7
- **Infra:** Docker Compose (локально), VPS + Caddy (staging/production)

## Быстрый старт

```bash
git clone <repository-url>
cd leoAI

# Корневой .env — DB_PASSWORD, JWT_SECRET, YC_*, OAuth, SMTP (см. docs/HISTORY/CONFIGURATION.md)

docker compose up -d          # PostgreSQL, Redis, resume-parser

npm install
npm run dev:up                # все сервисы (логи в .runlogs/)
```

Открыть http://localhost:3000

Проверка: `npm run dev:status` · Smoke: `npm run smoke:mvp0`

## Staging (VPS)

```bash
ssh ubuntu@84.54.57.209
cd ~/leoAI
npm run dev:deploy:staging
```

Секреты на VPS: `.env.staging.local` (не в git).  
Подробнее: [docs/STAGING_DEPLOY.md](./docs/STAGING_DEPLOY.md)

Health: https://leo-ai.ru/api/health

## Структура проекта

```
leoAI/
├── frontend/                 # Next.js (3000)
├── services/
│   ├── user-profile/         # Auth, профили (3001)
│   ├── conversation/         # Чат, сценарии (3002)
│   ├── ai-nlp/               # YandexGPT, TTS, interview (3003)
│   ├── job-matching/         # Вакансии (3004)
│   ├── email/                # Email (3005)
│   ├── report/               # PDF (3007)
│   └── telegram-support/     # @leoaisupportbot (3008)
├── docs/                     # Документация
├── scripts/dev/              # dev:up, deploy-staging, status
└── docker-compose.yml
```

## Документация

| Документ | Описание |
|----------|----------|
| [docs/README.md](./docs/README.md) | Индекс документации |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | Продукт и сценарии |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Архитектура и сервисы |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Roadmap и статус |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | Эксплуатация |
| [docs/STAGING_DEPLOY.md](./docs/STAGING_DEPLOY.md) | Деплой на VPS |
| [docs/ALPHA_TEST.md](./docs/ALPHA_TEST.md) | Чеклист альфа-теста |
| [docs/HISTORY/CONFIGURATION.md](./docs/HISTORY/CONFIGURATION.md) | Переменные окружения |
| [docs/HISTORY/WANNANEW.md](./docs/HISTORY/WANNANEW.md) | Спецификация WannaNew |

Поддержка: [@leoaisupportbot](https://t.me/leoaisupportbot)
