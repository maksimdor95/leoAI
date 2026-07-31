# Руководство по Docker

## Быстрый старт

### 1. Запуск базы данных и Redis

```bash
# Запустить PostgreSQL и Redis
docker-compose up -d

# Проверить статус
docker-compose ps

# Посмотреть логи
docker-compose logs -f
```

### 2. Остановка

```bash
# Остановить все контейнеры
docker-compose down

# Остановить и удалить volumes (данные)
docker-compose down -v
```

### 3. Перезапуск

```bash
# Перезапустить все контейнеры
docker-compose restart

# Перезапустить конкретный сервис
docker-compose restart postgres
```

## Работа с базой данных

### Подключение к PostgreSQL

```bash
# Через docker-compose
docker-compose exec postgres psql -U postgres -d jack_ai

# Или напрямую
docker exec -it jack-postgres psql -U postgres -d jack_ai
```

### Полезные команды PostgreSQL

```sql
-- Список баз данных
\l

-- Подключение к базе
\c jack_ai

-- Список таблиц
\dt

-- Список схем
\dn

-- Выход
\q
```

### Резервное копирование

```bash
# Создать backup
docker-compose exec postgres pg_dump -U postgres jack_ai > backup.sql

# Восстановить из backup
docker-compose exec -T postgres psql -U postgres jack_ai < backup.sql
```

## Работа с Redis

### Подключение к Redis

```bash
# Через docker-compose
docker-compose exec redis redis-cli

# С паролем (если установлен)
docker-compose exec redis redis-cli -a your_password
```

### Полезные команды Redis

```bash
# Проверка подключения
PING
# Должно вернуть: PONG

# Информация о сервере
INFO

# Список всех ключей
KEYS *

# Очистить все данные
FLUSHALL

# Выход
EXIT
```

## pgAdmin (инструмент для управления БД)

### Запуск

```bash
# Запустить с профилем tools
docker-compose --profile tools up -d pgadmin
```

### Доступ

- URL: http://localhost:5050
- Email: admin@jack.ai (по умолчанию)
- Password: admin (по умолчанию)

### Добавление сервера в pgAdmin

1. Правый клик на "Servers" → "Create" → "Server"
2. Вкладка "General":
   - Name: Jack AI Local
3. Вкладка "Connection":
   - Host: postgres (имя сервиса в docker-compose)
   - Port: 5432
   - Database: jack_ai
   - Username: postgres
   - Password: postgres (или из .env)

## Переменные окружения

Все переменные настраиваются в файле `.env`:

```env
# Database
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=jack_ai
DB_PORT=5432

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=

# pgAdmin
PGADMIN_EMAIL=admin@jack.ai
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050
```

## Решение проблем

### Проблема: Порт уже занят

```bash
# Проверить, что использует порт
netstat -ano | findstr :5432  # Windows
lsof -i :5432                  # Mac/Linux

# Изменить порт в .env
DB_PORT=5433
```

### Проблема: Контейнер не запускается

```bash
# Посмотреть логи
docker-compose logs postgres

# Пересоздать контейнер
docker-compose up -d --force-recreate postgres
```

### Проблема: Данные не сохраняются

Убедитесь, что volumes созданы:

```bash
docker volume ls
```

### Проблема: Очистка всего

```bash
# Остановить и удалить все
docker-compose down -v

# Удалить все неиспользуемые данные Docker
docker system prune -a --volumes
```

## Мониторинг

### Использование ресурсов

```bash
# Статистика по контейнерам
docker stats

# Использование диска
docker system df
```

### Health checks

Все сервисы имеют health checks. Проверить статус:

```bash
docker-compose ps
# Должно показать "healthy" для всех сервисов
```

## Сеть

Все сервисы находятся в одной сети `jack-network` и могут общаться друг с другом по именам:

- PostgreSQL: `postgres:5432`
- Redis: `redis:6379`
- pgAdmin: `pgadmin:80`

## Дополнительные команды

```bash
# Посмотреть логи всех сервисов
docker-compose logs -f

# Посмотреть логи конкретного сервиса
docker-compose logs -f postgres

# Войти в контейнер
docker-compose exec postgres sh

# Обновить образы
docker-compose pull

# Пересобрать контейнеры
docker-compose up -d --build
```
