# Jack & Jill AI - Сервис для кандидатов (Jack)

AI-ассистент для помощи кандидатам в поиске работы. Jack проводит персональные беседы, понимает предпочтения кандидатов и отправляет подходящие вакансии.

## 📋 Описание

Jack - это AI-ассистент, который работает как персональный карьерный коуч и рекрутер. Он:

- Проводит глубокие беседы с кандидатами о их карьерных целях (поддерживает голосовой ввод и озвучку вопросов)
- Извлекает предпочтения и требования к работе
- Ищет 10,000+ новых вакансий каждый час
- Отправляет персонализированные подборки вакансий на email
- Помогает с заявками и подготовкой к интервью
- Делает прямые интро к менеджерам по найму через Jill

## 🏗️ Архитектура

Подробная техническая архитектура описана в [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

### Основные компоненты

- **Frontend** - React/Next.js приложение с чат-интерфейсом
- **User Profile Service** - управление профилями и предпочтениями
- **Conversation Service** - WebSocket сервис для диалогов
- **AI/NLP Service** - обработка естественного языка с GPT-4/Claude
- **Job Matching Service** - поиск и подбор вакансий
- **Email Notification Service** - персонализированные email рассылки
- **Application Helper Service** - помощь с заявками
- **Referral/Intro Service** - интеграция с Jill для интро

## 📅 План разработки

Детальный план разработки по шагам описан в [docs/DEVELOPMENT_PLAN.md](./docs/DEVELOPMENT_PLAN.md)

### Основные фазы

1. **Фаза 0**: Подготовка и инфраструктура (1-2 недели) ✅ В процессе
2. **Фаза 1**: MVP - Базовая функциональность (6-8 недель)
3. **Фаза 2**: Улучшение и расширение (4-6 недель)
4. **Фаза 3**: Продвинутые функции (4-6 недель)
5. **Фаза 4**: Production-ready (4-6 недель)

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+ или Python 3.10+
- Docker и Docker Compose (для локальной разработки)
- PostgreSQL 14+ (будет настроено через Docker)
- Redis 7+ (будет настроено через Docker)

### Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd AIheroes

# Установить зависимости
npm install  # для JavaScript/TypeScript
pip install -r requirements-dev.txt  # для Python

# Настроить pre-commit hooks
npx husky install  # для JavaScript проектов
# или
pre-commit install  # для Python проектов

# Настроить переменные окружения
cp env.example .env
# Отредактируйте .env файл и заполните значения

# Запустить локально через Docker Compose
docker-compose up -d

# Проверить статус
docker-compose ps

# Подробная инструкция: infrastructure/DOCKER_GUIDE.md
```

## 🛠️ Технологический стек

### Frontend

- React/Next.js
- TypeScript
- Tailwind CSS
- Socket.io client

### Backend

- Node.js (Express) или Python (FastAPI)
- PostgreSQL
- Redis
- Vector DB (Pinecone/Weaviate)

### AI/ML

- OpenAI GPT-4 / Anthropic Claude
- LangChain
- Vector embeddings

### Infrastructure

- Kubernetes
- Docker
- AWS/GCP
- Prometheus + Grafana

## 📁 Структура проекта

```
AIheroes/
├── frontend/              # React/Next.js приложение
├── services/              # Все сервисы (микросервисы)
│   ├── user-profile/      # User Profile Service
│   ├── conversation/      # Conversation Service
│   ├── ai-nlp/           # AI/NLP Service
│   ├── job-matching/     # Job Matching Service
│   ├── email/            # Email Notification Service
│   ├── application/      # Application Helper Service
│   └── referral/         # Referral/Intro Service
├── infrastructure/        # Docker, K8s, Terraform
└── docs/                 # Документация
```

## 📚 Документация

- [Архитектура](./docs/ARCHITECTURE.md) - детальная техническая архитектура
- [План разработки](./docs/DEVELOPMENT_PLAN.md) - план разработки по шагам
- [Стиль кода](./docs/CODE_STYLE.md) - правила форматирования и проверки кода
- [Pre-commit Hooks](./docs/PRE_COMMIT_SETUP.md) - настройка автоматической проверки

## 🔧 Разработка

### Проверка кода

```bash
# JavaScript/TypeScript
npm run lint          # Проверить код
npm run lint:fix      # Исправить ошибки
npm run format        # Отформатировать код

# Python
black .               # Отформатировать код
flake8 .              # Проверить стиль
```

### Git Workflow

- **main** - стабильная версия (production-ready)
- **develop** - ветка для разработки

Все изменения делаются в ветке `develop`, затем через Pull Request попадают в `main`.

## 🤝 Вклад в проект

1. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
3. Push в branch (`git push origin feature/AmazingFeature`)
4. Откройте Pull Request

## 📝 Лицензия

[Указать лицензию]

## 🔗 Ссылки

- [Jack & Jill AI Website](https://jackandjill.ai/)
- [OpenAI API](https://platform.openai.com/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
