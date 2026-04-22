# Работа с PostgreSQL и Redis

## PostgreSQL

### Подключение через Docker Compose

PostgreSQL запускается через `docker-compose.yml`:

```bash
docker compose up -d
```

Параметры подключения (из `.env`):

| Параметр | Значение по умолчанию |
|----------|----------------------|
| Host | `localhost` |
| Port | `5432` |
| Database | `jack_ai` |
| User | `postgres` |
| Password | из `DB_PASSWORD` в `.env` |

### Инициализация схемы

```bash
cd services/user-profile && npm run init:db
cd services/job-matching && npm run init:db
```

User Profile создаёт схему `jack` с таблицами: `users`, `career_profiles`, `resumes`, `skills`, `user_skills`, `learning_plans`.

Job Matching создаёт таблицу `public.jobs`.

### Подключение через psql

```bash
docker exec -it leoai-postgres-1 psql -U postgres -d jack_ai
```

Полезные команды:

```sql
\dn              -- список схем
\dt jack.*       -- таблицы в схеме jack
\dt public.*     -- таблицы в public
\d jack.users    -- структура таблицы users
SELECT * FROM jack.users LIMIT 5;
SELECT count(*) FROM public.jobs;
```

### pgAdmin

Для графического интерфейса можно добавить pgAdmin в `docker-compose.yml` или подключиться через локально установленный клиент (DBeaver, TablePlus, pgAdmin).

Параметры подключения те же, что и для psql.

---

## Redis

### Подключение

Redis запускается вместе с PostgreSQL через Docker Compose. Порт: `6379`.

### Проверка подключения

```bash
docker exec -it leoai-redis-1 redis-cli ping
# Ответ: PONG
```

### Структура ключей

| Ключ | Сервис | Данные | TTL |
|------|--------|--------|-----|
| `session:{id}` | Conversation | Сессия чата | 24h |
| `user:{userId}:session` | Conversation | ID активной сессии | 24h |
| `user:{userId}:sessions` | Conversation | Set всех сессий пользователя | 24h |
| `ai:nlp:history:{sessionId}` | AI/NLP | История диалога для GPT | 24h |
| `ai:nlp:facts:{sessionId}` | AI/NLP | Извлечённые факты | 7d |
| `bull:job-scraping:*` | Job Matching | Очередь BullMQ | managed |
| `report:{id}` | Report | Статус генерации PDF | 7d |

### Просмотр данных

```bash
docker exec -it leoai-redis-1 redis-cli

# Все ключи
KEYS *

# Сессии пользователя
SMEMBERS user:{userId}:sessions

# Данные сессии
GET session:{sessionId}

# История AI
GET ai:nlp:history:{sessionId}
```

### Очистка данных

```bash
# Удалить все данные (осторожно!)
docker exec -it leoai-redis-1 redis-cli FLUSHALL

# Удалить конкретный ключ
docker exec -it leoai-redis-1 redis-cli DEL session:{id}
```

---

## Частые проблемы

### PostgreSQL: ECONNREFUSED
- Проверить, что контейнер запущен: `docker compose ps`
- Проверить порт: `docker compose logs postgres`
- Проверить `.env`: `DB_HOST=localhost`, `DB_PORT=5432`

### Redis: ECONNREFUSED
- Проверить, что контейнер запущен: `docker compose ps`
- Проверить `.env`: `REDIS_HOST=localhost`, `REDIS_PORT=6379`

### Роль "jack_user" does not exist
Эта ошибка возникает при `init:db`, если `DB_USER` отличается от `jack_user`. Исправлено: SQL использует `CURRENT_USER` вместо hardcoded имени.
