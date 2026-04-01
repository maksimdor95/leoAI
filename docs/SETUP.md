# Инструкция по настройке проекта

## Предварительные требования

### Обязательные

- **Node.js** 18+ - [Скачать](https://nodejs.org/)
- **Python** 3.10+ - [Скачать](https://www.python.org/)
- **Git** - [Скачать](https://git-scm.com/)
- **Docker Desktop** - [Скачать](https://www.docker.com/products/docker-desktop)

### Проверка установки

```bash
node --version    # Должно быть v18.0.0 или выше
python --version  # Должно быть 3.10.0 или выше
git --version     # Любая версия
docker --version  # Любая версия
```

## Установка проекта

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd AIheroes
```

### 2. Установка зависимостей

#### JavaScript/TypeScript зависимости

```bash
npm install
```

#### Python зависимости (для разработки)

```bash
pip install -r requirements-dev.txt
```

### 3. Настройка переменных окружения

```bash
# Скопировать пример файла
cp env.example .env

# Отредактировать .env файл и заполнить значения
# (особенно важны API ключи)
```

### 4. Настройка pre-commit hooks

#### Для JavaScript/TypeScript

```bash
npx husky install
```

#### Для Python

```bash
pre-commit install
```

### 5. Запуск базы данных (через Docker)

```bash
# Запустить PostgreSQL и Redis
docker-compose up -d

# Проверить, что контейнеры запущены
docker-compose ps

# Должно показать:
# - jack-postgres (healthy)
# - jack-redis (healthy)
```

**Подробная инструкция:** См. [infrastructure/DOCKER_GUIDE.md](../infrastructure/DOCKER_GUIDE.md)

## Структура проекта

```
AIheroes/
├── frontend/              # Frontend приложение
├── services/              # Backend сервисы
│   ├── user-profile/      # Сервис профилей
│   ├── conversation/      # Сервис чата
│   ├── ai-nlp/           # AI сервис
│   ├── job-matching/     # Сервис поиска вакансий
│   ├── email/            # Email сервис
│   ├── application/      # Сервис помощи с заявками
│   └── referral/         # Сервис интро
├── infrastructure/        # Docker, K8s конфигурации
└── docs/                 # Документация
```

## Первый запуск

После установки всех зависимостей и настройки переменных окружения:

1. **Запустить базу данных:**

   ```bash
   docker-compose up -d
   ```

2. **Проверить подключение к базе данных:**

   ```bash
   # Проверить PostgreSQL
   docker-compose exec postgres psql -U postgres -d jack_ai

   # Проверить Redis
   docker-compose exec redis redis-cli ping
   ```

3. **Запустить сервисы:**
   ```bash
   # Запустить конкретный сервис (пример)
   cd services/user-profile
   npm run dev
   ```

## Разработка

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

### Тестирование

```bash
# JavaScript/TypeScript
npm test

# Python
pytest
```

## Проблемы и решения

### Проблема: `npm install` не работает

**Решение:**

- Убедитесь, что Node.js версии 18+ установлен
- Попробуйте удалить `node_modules` и `package-lock.json`, затем запустить снова
- Проверьте интернет-соединение

### Проблема: Docker контейнеры не запускаются

**Решение:**

- Убедитесь, что Docker Desktop запущен
- Проверьте, что порты 5432 (PostgreSQL) и 6379 (Redis) не заняты
- Попробуйте перезапустить Docker Desktop

### Проблема: Pre-commit hooks не работают

**Решение:**

- Убедитесь, что выполнили `npx husky install` или `pre-commit install`
- Проверьте права на выполнение файлов в `.husky/`
- Попробуйте переустановить hooks

## Дополнительная информация

- [Архитектура проекта](./ARCHITECTURE.md)
- [План разработки](./DEVELOPMENT_PLAN.md)
- [Стиль кода](./CODE_STYLE.md)
- [Pre-commit hooks](./PRE_COMMIT_SETUP.md)
