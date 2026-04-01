# Redis Configuration

Конфигурация Redis для Jack AI Service.

## Использование

Redis используется для:

- Кеширования данных
- Хранения сессий
- Очередей задач
- Временного хранения данных

## Подключение

### Из приложения

```
Host: localhost
Port: 6379
Password: (пусто по умолчанию, настройте в .env)
Database: 0
```

### Из командной строки

```bash
# Подключение без пароля
docker-compose exec redis redis-cli

# Подключение с паролем
docker-compose exec redis redis-cli -a your_password
```

## Проверка работы

```bash
# Ping
docker-compose exec redis redis-cli ping
# Должен вернуть: PONG

# Проверка информации
docker-compose exec redis redis-cli INFO
```
