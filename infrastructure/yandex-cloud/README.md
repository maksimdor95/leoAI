# Yandex Cloud Deployment

Это руководство описывает развертывание Jack AI в Yandex Cloud с использованием Serverless Containers.

## Архитектура в Yandex Cloud

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │
│   (Static)      │    │   (Container)   │
└─────────────────┘    └─────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
          ┌─────────▼──┐ ┌────▼──┐ ┌───▼────┐
          │ User      │ │ AI/NLP │ │ Job     │
          │ Profile   │ │ Service│ │ Matching│
          │ Container │ │ Container│ │ Container│
          └───────────┘ └────────┘ └─────────┘
                    │         │         │
                    └─────────┼─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Conversation    │
                    │   + Email         │
                    │   Containers      │
                    └───────────────────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
          ┌─────────▼──┐ ┌────▼──┐
          │ PostgreSQL │ │ Redis │
          │ (Managed)  │ │ (Managed)│
          └────────────┘ └────────┘
```

## Быстрый старт

### 1. Предварительные требования

- Аккаунт в Yandex Cloud
- Установленный YC CLI: `curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash`
- Настроенный сервисный аккаунт с необходимыми правами

### 2. Настройка инфраструктуры

```bash
# Инициализация YC CLI
yc init

# Запуск скрипта создания инфраструктуры
./infrastructure/yandex-cloud/deploy.sh
```

### 3. Настройка секретов в GitHub

Добавьте следующие секреты в ваш GitHub repository:

```bash
# Yandex Cloud
YC_ACCESS_KEY_ID=your_access_key_id
YC_SECRET_ACCESS_KEY=your_secret_access_key
YC_REGISTRY_ID=your_registry_id
YC_SERVICE_ACCOUNT_ID=your_service_account_id

# Application
JWT_SECRET=your_jwt_secret
YC_API_KEY=your_yandex_cloud_api_key
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Database (Yandex Managed PostgreSQL)
DB_HOST=your_postgres_host
DB_NAME=jack_ai
DB_USER=jack_user
DB_PASSWORD=your_db_password

# Redis (Yandex Managed Redis)
REDIS_HOST=your_redis_host
```

### 4. Первый деплой

```bash
# Push в main ветку автоматически запустит деплой
git add .
git commit -m "Setup Yandex Cloud deployment"
git push origin main
```

## Ручное управление

### Просмотр статуса контейнеров

```bash
# Список всех контейнеров
yc serverless container list

# Детали конкретного контейнера
yc serverless container get --name jack-gateway

# Логи контейнера
yc serverless container logs --name jack-gateway
```

### Масштабирование

```bash
# Увеличение памяти для Conversation Service
yc serverless container revision deploy \
  --container-name jack-conversation \
  --memory 2048MB \
  --cores 2 \
  --concurrency 16
```

### Мониторинг

```bash
# Метрики использования
yc monitoring metrics get \
  --service serverless-containers \
  --folder-id b1gfl9cu32kktuuthcf3 \
  --metrics cpu_usage \
  --from-time 2024-01-01T00:00:00Z

# Логи всех контейнеров
for container in jack-user-profile jack-conversation jack-ai-nlp jack-job-matching jack-email jack-gateway; do
  echo "=== $container ==="
  yc serverless container logs --name $container --limit 10
done
```

## Troubleshooting

### Контейнер не запускается

```bash
# Проверить логи
yc serverless container logs --name jack-gateway --since 1h

# Проверить переменные окружения
yc serverless container get --name jack-gateway --format yaml
```

### Проблемы с подключением к БД

```bash
# Проверить доступность PostgreSQL
yc managed-postgresql cluster get jack-ai-postgres

# Проверить хост и порт
yc managed-postgresql cluster list
```

### Высокая латентность

```bash
# Проверить cold start время
yc monitoring metrics get \
  --service serverless-containers \
  --folder-id b1gfl9cu32kktuuthcf3 \
  --metrics duration

# Оптимизировать: увеличить concurrency
yc serverless container revision deploy \
  --container-name jack-gateway \
  --concurrency 32
```

## Стоимость

### Serverless Containers

- CPU: $0.000144/секунда
- RAM: $0.000010/МБ/секунда
- Requests: $0.000002 за запрос

### Managed Databases

- PostgreSQL: от 300₽/месяц (s2.micro)
- Redis: от 300₽/месяц (s2.micro)

### YandexGPT

- Lite: 0.6₽ за 1000 токенов
- Pro: 7.5₽ за 1000 токенов

**Примерная стоимость MVP:** 1000-3000₽/месяц при умеренной нагрузке.

## Безопасность

- Все секреты хранятся в GitHub Secrets
- Service Account имеет минимально необходимые права
- Трафик шифруется HTTPS
- Доступ к БД только из контейнеров Yandex Cloud
