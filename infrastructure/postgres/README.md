# PostgreSQL Configuration

Конфигурация PostgreSQL для Jack AI Service.

## Структура

- `init/` - SQL скрипты для инициализации базы данных
  - `01-init.sql` - базовые расширения и схемы

## Подключение

### Из приложения

```
Host: localhost
Port: 5432
Database: jack_ai
User: postgres
Password: postgres (по умолчанию, измените в .env)
```

### Из командной строки

```bash
docker-compose exec postgres psql -U postgres -d jack_ai
```

### Из pgAdmin

- URL: http://localhost:5050
- Email: admin@jack.ai (по умолчанию)
- Password: admin (по умолчанию)

## Миграции

Миграции лежат в `migrations/` и применяются вручную:

```bash
# из корня репозитория, контейнер postgres из docker compose
docker exec -i leoai-postgres-1 psql -U postgres -d jack_ai \
  < infrastructure/postgres/migrations/002_leowork_employer_schema.sql
```

Проверка:

```sql
\dn employer
\dt employer.*
```

| Файл | Описание |
|------|----------|
| `migrations/002_leowork_employer_schema.sql` | LEOWORK B2B: schema `employer` (companies, briefs, shortlist, intros, pipeline, invoices, consent) |

Сервисные миграции (jack, jobs) по-прежнему в `services/*/src` (`npm run init:db`).
