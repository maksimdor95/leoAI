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

Миграции базы данных будут добавляться в каждом сервисе отдельно.
