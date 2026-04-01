# Docker Configuration

Конфигурация Docker для всех сервисов проекта.

## Dockerfile'ы

Каждый сервис имеет свой Dockerfile:

### Node.js сервисы (Node.js 18)

- `services/user-profile/Dockerfile`
- `services/conversation/Dockerfile`
- `services/email/Dockerfile`
- `services/referral/Dockerfile`

### Python сервисы (Python 3.11)

- `services/ai-nlp/Dockerfile`
- `services/job-matching/Dockerfile`
- `services/application/Dockerfile`

### Frontend

- `frontend/Dockerfile` - Nginx для статики

## Использование

### Сборка образа

```bash
# Для конкретного сервиса
docker build -t jack-user-profile -f services/user-profile/Dockerfile .

# Для всех сервисов (через docker-compose)
docker-compose build
```

### Запуск контейнера

```bash
docker run -p 3001:3001 jack-user-profile
```

## Многостадийная сборка

Dockerfile'ы используют многостадийную сборку для оптимизации размера образов:

- `base` - базовая стадия с установленными зависимостями
- `builder` - стадия сборки (для frontend)

## Примечания

- Все Dockerfile'ы сейчас базовые (заглушки)
- Они будут дополнены при создании самих сервисов
- Порты для каждого сервиса:
  - User Profile: 3001
  - Conversation: 3002
  - AI/NLP: 3003
  - Job Matching: 3004
  - Email: 3005
  - Application: 3006
  - Referral: 3007
  - Frontend: 80
