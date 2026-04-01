# Руководство по развертыванию Jack AI

Это руководство описывает процесс развертывания Jack AI в production окружении.

## Предварительные требования

### Инфраструктура

- **PostgreSQL 14+** - для хранения данных
- **Redis 7+** - для кеширования и очередей
- **Node.js 18+** - для запуска сервисов
- **Docker** (опционально) - для контейнеризации

### Внешние сервисы

- **Yandex Cloud** - для YandexGPT API
- **SendGrid** - для отправки email
- **HeadHunter.ru API** (опционально) - для скрейпинга вакансий

### Безопасность

- SSL/TLS сертификаты
- Firewall правила
- Secrets management (HashiCorp Vault, AWS Secrets Manager, и т.д.)

## Шаг 1: Подготовка окружения

### 1.1 Создание базы данных

```sql
-- Создать базу данных
CREATE DATABASE jack_ai;

-- Создать пользователя (опционально)
CREATE USER jack_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE jack_ai TO jack_user;
```

### 1.2 Настройка Redis

Убедитесь, что Redis запущен и доступен:

```bash
redis-cli ping
# Должно вернуть: PONG
```

### 1.3 Получение API ключей

1. **Yandex Cloud:**
   - Зарегистрируйтесь в [Yandex Cloud](https://cloud.yandex.ru/)
   - Создайте каталог
   - Получите Folder ID и создайте API ключ

2. **SendGrid:**
   - Зарегистрируйтесь на [SendGrid](https://sendgrid.com/)
   - Создайте API ключ
   - Верифицируйте домен отправителя

3. **HeadHunter.ru:**
   - Зарегистрируйтесь на [dev.hh.ru](https://dev.hh.ru/)
   - Создайте приложение
   - Получите API ключ

## Шаг 2: Конфигурация

### 2.1 Создание .env файла

Скопируйте `env.example` в `.env` и заполните все значения:

```bash
cp env.example .env
```

### 2.2 Обязательные переменные для production

```env
# Окружение
NODE_ENV=production

# База данных
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=jack_ai
DB_USER=jack_user
DB_PASSWORD=secure_password
DB_SSL=true

# Redis
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=secure_redis_password

# YandexGPT (обязательно)
YC_FOLDER_ID=your_folder_id
YC_API_KEY=your_api_key

# SendGrid (обязательно)
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Jack AI

# JWT (критически важно - должен быть одинаковым во всех сервисах!)
JWT_SECRET=your_long_random_secret_key_min_32_chars

# Service URLs (для production используйте внутренние URL)
USER_PROFILE_SERVICE_URL=http://user-profile:3001
CONVERSATION_SERVICE_URL=http://conversation:3002
AI_SERVICE_URL=http://ai-nlp:3003
JOB_MATCHING_SERVICE_URL=http://job-matching:3004
EMAIL_SERVICE_URL=http://email:3005

# CORS
CORS_ORIGIN=https://yourdomain.com

# Job Scraping
USE_MOCK_JOBS=false
HH_API_KEY=your_hh_api_key

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

**Важно:**

- `JWT_SECRET` должен быть длинным случайным ключом (минимум 32 символа)
- Используйте разные ключи для разных окружений
- Никогда не коммитьте реальные ключи в Git

### 2.3 Генерация JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Шаг 3: Установка зависимостей

### 3.1 Установка зависимостей для каждого сервиса

```bash
# User Profile Service
cd services/user-profile
npm ci --production

# Conversation Service
cd ../conversation
npm ci --production

# AI/NLP Service
cd ../ai-nlp
npm ci --production

# Job Matching Service
cd ../job-matching
npm ci --production

# Email Notification Service
cd ../email
npm ci --production
```

### 3.2 Сборка TypeScript

```bash
# В каждом сервисе
npm run build
```

## Шаг 4: Инициализация базы данных

### 4.1 Миграции базы данных

```bash
# User Profile Service
cd services/user-profile
npm run migrate

# Job Matching Service
cd ../job-matching
npm run migrate
```

### 4.2 Создание индексов

```sql
-- Индексы для users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Индексы для jobs
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at);
CREATE INDEX idx_jobs_title ON jobs(title);
```

## Шаг 5: Запуск сервисов

### 5.1 Запуск через PM2 (рекомендуется)

Установите PM2:

```bash
npm install -g pm2
```

Создайте `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'user-profile',
      script: './services/user-profile/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 2,
      exec_mode: 'cluster',
      error_file: './logs/user-profile-error.log',
      out_file: './logs/user-profile-out.log',
    },
    {
      name: 'conversation',
      script: './services/conversation/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      instances: 2,
      exec_mode: 'cluster',
      error_file: './logs/conversation-error.log',
      out_file: './logs/conversation-out.log',
    },
    {
      name: 'ai-nlp',
      script: './services/ai-nlp/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      instances: 2,
      exec_mode: 'cluster',
      error_file: './logs/ai-nlp-error.log',
      out_file: './logs/ai-nlp-out.log',
    },
    {
      name: 'job-matching',
      script: './services/job-matching/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
      },
      instances: 1, // Один экземпляр для job scraping
      error_file: './logs/job-matching-error.log',
      out_file: './logs/job-matching-out.log',
    },
    {
      name: 'email',
      script: './services/email/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      instances: 2,
      exec_mode: 'cluster',
      error_file: './logs/email-error.log',
      out_file: './logs/email-out.log',
    },
  ],
};
```

Запустите сервисы:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5.2 Запуск через Docker

См. `infrastructure/DOCKER_GUIDE.md` для инструкций по Docker Compose.

### 5.3 API Gateway

Для production рекомендуется использовать API Gateway для маршрутизации запросов и аутентификации.

#### Запуск через Docker:

```bash
# Запуск с профилем gateway
docker-compose --profile gateway up -d gateway

# Или в docker-compose.override.yml добавить gateway в profiles по умолчанию
```

#### Конфигурация:

API Gateway слушает порт 8080 и маршрутизирует запросы к соответствующим сервисам:

- `http://localhost:8080/` - Frontend (Next.js)
- `http://localhost:8080/socket.io/` - WebSocket для Conversation Service
- `http://localhost:8080/api/*` - API endpoints с JWT аутентификацией
- `http://localhost:8080/health` - Health check gateway

#### JWT Аутентификация:

Gateway автоматически проверяет JWT токены для всех `/api/*` запросов. Токены должны передаваться в заголовке `Authorization: Bearer <token>`.

#### Переменные окружения:

```env
# API Gateway
GATEWAY_PORT=8080
JWT_SECRET=your-jwt-secret-key
```

### 5.4 Запуск через systemd

Создайте service файлы для каждого сервиса в `/etc/systemd/system/`.

Пример для User Profile Service:

```ini
[Unit]
Description=Jack AI User Profile Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=jack
WorkingDirectory=/opt/jack-ai/services/user-profile
Environment="NODE_ENV=production"
EnvironmentFile=/opt/jack-ai/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Шаг 6: Настройка Reverse Proxy

### 6.1 Nginx конфигурация

```nginx
upstream user_profile {
    server localhost:3001;
}

upstream conversation {
    server localhost:3002;
}

upstream ai_nlp {
    server localhost:3003;
}

upstream job_matching {
    server localhost:3004;
}

upstream email {
    server localhost:3005;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # API endpoints
    location /api/users {
        proxy_pass http://user_profile;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/conversation {
        proxy_pass http://conversation;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ai {
        proxy_pass http://ai_nlp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/jobs {
        proxy_pass http://job_matching;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/email {
        proxy_pass http://email;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # REST API для чата (рекомендуется для Serverless)
    location /api/chat {
        proxy_pass http://conversation;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # WebSocket для Conversation Service (для локальной разработки)
    # Примечание: В Yandex Serverless Containers WebSocket не поддерживается
    location /socket.io {
        proxy_pass http://conversation;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## Шаг 7: Мониторинг и логирование

### 7.1 Health Checks

Все сервисы предоставляют `/health` endpoint:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

### 7.2 Мониторинг

Настройте мониторинг через:

- **Sentry** - для отслеживания ошибок
- **Prometheus + Grafana** - для метрик
- **ELK Stack** - для централизованного логирования

### 7.3 Логи

Логи находятся в:

- PM2: `~/.pm2/logs/`
- systemd: `journalctl -u service-name`
- Docker: `docker logs container-name`

## Шаг 8: Проверка развертывания

### 8.1 Проверка сервисов

```bash
# Проверить статус всех сервисов
pm2 status

# Проверить логи
pm2 logs

# Проверить health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
```

### 8.2 Тестирование функциональности

1. Зарегистрируйте тестового пользователя
2. Запустите диалог с Jack
3. Проверьте отправку email
4. Проверьте скрейпинг вакансий

## Шаг 9: Автоматизация (CI/CD)

### 9.1 GitHub Actions пример

Создайте `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy
        run: |
          # Your deployment script
          ./scripts/deploy.sh
```

## CI/CD Pipeline

Проект использует GitHub Actions для автоматической сборки, тестирования и развертывания в **Yandex Cloud**.

### Автоматическое тестирование

При каждом push в main/develop ветки запускаются:

1. **Unit и Integration тесты** - проверка функциональности каждого сервиса
2. **Smoke тесты** - базовые проверки API endpoints
3. **E2E тесты** - полный сценарий пользовательского сценария (опционально)

### Автоматический деплой в Yandex Cloud

При push в main ветку автоматически запускается деплой в production:

1. **Сборка образов** - все сервисы собираются в Docker образы
2. **Push в Yandex Container Registry** - образы публикуются в Yandex Cloud
3. **Deploy в Serverless Containers** - сервисы разворачиваются как serverless-контейнеры
4. **Health checks** - проверка работоспособности после деплоя

**Важно**: Yandex Serverless Containers **не поддерживают WebSocket**. Для чат-функциональности используется REST API:

- `POST /api/chat/session` - создать/получить сессию
- `GET /api/chat/session/:id` - получить сессию с историей
- `POST /api/chat/session/:id/message` - отправить сообщение
- `POST /api/chat/session/:id/command` - выполнить команду

Frontend использует polling (каждые 3 секунды) для получения новых сообщений.

### Ручной деплой

Для ручного запуска деплоя:

```bash
# Через GitHub Actions
gh workflow run deploy-yc.yml -f environment=production

# Или через yc CLI (требует предварительной настройки)
yc serverless container revision deploy \
  --container-name jack-gateway \
  --image cr.yandex/YOUR_REGISTRY/jack-ai/gateway:latest
```

## Секреты и переменные окружения

### GitHub Secrets для Yandex Cloud

Настройте следующие секреты в GitHub repository:

```bash
# Yandex Cloud Service Account
YC_ACCESS_KEY_ID=your_access_key_id_from_service_account
YC_SECRET_ACCESS_KEY=your_secret_access_key_from_service_account
YC_REGISTRY_ID=your_container_registry_id
YC_SERVICE_ACCOUNT_ID=your_service_account_id

# Application Secrets
JWT_SECRET=your_secure_jwt_secret_key
YC_API_KEY=your_yandex_cloud_api_key_for_ai
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com

# Database Secrets (Yandex Managed PostgreSQL)
DB_HOST=your_postgresql_host
DB_NAME=jack_ai
DB_USER=jack_user
DB_PASSWORD=your_database_password

# Redis Secrets (Yandex Managed Redis)
REDIS_HOST=your_redis_host
```

### Настройка Yandex Cloud инфраструктуры

Перед первым деплоем выполните настройку инфраструктуры:

#### 1. Установка YC CLI

```bash
# Установка Yandex Cloud CLI
curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
source ~/.bashrc

# Инициализация
yc init
```

#### 2. Создание инфраструктуры

Используйте подготовленный скрипт:

```bash
# Запуск скрипта создания инфраструктуры
./infrastructure/yandex-cloud/deploy.sh
```

Или создайте компоненты вручную:

```bash
# Создание сервисного аккаунта
yc iam service-account create jack-ai-service \
  --description "Service account for Jack AI"

# Назначение ролей
SERVICE_ACCOUNT_ID=$(yc iam service-account get jack-ai-service --format json | jq -r '.id')
yc resource-manager folder add-access-binding b1gfl9cu32kktuuthcf3 \
  --role serverless.containers.invoker \
  --subject serviceAccount:$SERVICE_ACCOUNT_ID

# Создание статического ключа доступа
yc iam access-key create --service-account-name jack-ai-service

# Создание Container Registry
yc container registry create jack-ai-registry

# Создание Managed PostgreSQL
yc managed-postgresql cluster create jack-ai-postgres \
  --network-name default \
  --environment production \
  --resource-preset s2.micro \
  --disk-type network-ssd \
  --disk-size 10 \
  --database-name jack_ai \
  --user-name jack_user \
  --enable-public-ip

# Создание Managed Redis
yc managed-redis cluster create jack-ai-redis \
  --network-name default \
  --environment production \
  --resource-preset s2.micro \
  --disk-type network-ssd \
  --disk-size 10 \
  --enable-public-ip
```

#### 3. Создание Serverless Containers

```bash
# Создание всех контейнеров
for service in user-profile conversation ai-nlp job-matching email gateway; do
  yc serverless container create jack-$service \
    --description "Jack AI $service service" \
    --memory 512MB \
    --cores 1 \
    --concurrency 4 \
    --execution-timeout 30s \
    --service-account-id $SERVICE_ACCOUNT_ID \
    --image cr.yandex/YOUR_REGISTRY_ID/jack-ai/$service:latest
done
```

### Production переменные окружения

Обязательные секреты для каждого сервиса:

#### Общие переменные

```env
NODE_ENV=production
JWT_SECRET=your_secure_jwt_secret_key
```

#### Database

```env
DB_HOST=your_production_db_host
DB_PORT=5432
DB_NAME=jack_ai
DB_USER=jack_user
DB_PASSWORD=your_secure_db_password
DB_SSL=true
```

#### Redis

```env
REDIS_HOST=your_production_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_redis_password
```

#### External APIs

```env
YC_FOLDER_ID=your_yandex_folder_id
YC_API_KEY=your_yandex_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

#### Service URLs (для gateway)

```env
USER_PROFILE_SERVICE_URL=http://jack-user-profile.fly.dev
CONVERSATION_SERVICE_URL=http://jack-conversation.fly.dev
AI_NLP_SERVICE_URL=http://jack-ai-nlp.fly.dev
JOB_MATCHING_SERVICE_URL=http://jack-job-matching.fly.dev
EMAIL_SERVICE_URL=http://jack-email.fly.dev
```

### Настройка секретов

1. **Fly.io secrets:**

   ```bash
   flyctl secrets set JWT_SECRET="your-secret" --app jack-gateway
   flyctl secrets set DB_PASSWORD="your-db-pass" --app jack-user-profile
   ```

2. **GitHub secrets:**
   - Перейдите в Settings → Secrets and variables → Actions
   - Добавьте `FLY_API_TOKEN`

## Rollback процесс

### Автоматический rollback

При неудачном деплое GitHub Actions автоматически откатывает до предыдущей версии через revision history в Yandex Cloud.

### Ручной rollback

```bash
# Просмотр списка ревизий
yc serverless container revision list --container-name jack-gateway

# Откат до предыдущей ревизии
yc serverless container revision deploy \
  --container-name jack-gateway \
  --revision-id PREVIOUS_REVISION_ID

# Или откат всех сервисов
for service in user-profile conversation ai-nlp job-matching email gateway; do
  # Получить ID предыдущей ревизии
  PREV_REV=$(yc serverless container revision list --container-name jack-$service \
    --format json | jq -r '.[1].id')

  yc serverless container revision deploy \
    --container-name jack-$service \
    --revision-id $PREV_REV
done
```

### Проверка после rollback

```bash
# Проверка health endpoints
curl -f https://jack-gateway.fly.dev/health

# Проверка API
curl -f https://jack-gateway.fly.dev/api/users/profile \
  -H "Authorization: Bearer your-test-token"
```

## Troubleshooting

### Проблема: Сервис не запускается

1. Проверьте логи: `pm2 logs service-name`
2. Проверьте конфигурацию: убедитесь, что все переменные установлены
3. Проверьте зависимости: DB и Redis доступны

### Проблема: 503 ошибки

1. Проверьте health endpoints
2. Проверьте доступность зависимостей
3. Проверьте логи на наличие ошибок

### Проблема: Медленная работа

1. Проверьте нагрузку на БД и Redis
2. Настройте connection pooling
3. Проверьте наличие индексов в БД

## Мониторинг и наблюдение

### Health Checks

Каждый сервис предоставляет health endpoint для проверки состояния:

- **User Profile Service**: `GET /health`
- **Conversation Service**: `GET /health`
- **AI/NLP Service**: `GET /health`
- **Job Matching Service**: `GET /health`
- **Email Service**: `GET /health`
- **API Gateway**: `GET /health`

Health checks проверяют:

- Доступность сервиса
- Подключение к базе данных (для сервисов, использующих БД)
- Подключение к Redis (для сервисов, использующих Redis)
- Доступность зависимых сервисов

### Метрики для мониторинга

#### HTTP метрики

- Response time для всех endpoints
- Error rate (4xx/5xx responses)
- Request rate по сервисам

#### Бизнес метрики

- Количество зарегистрированных пользователей
- Количество активных диалогов
- Количество отправленных вакансий
- Количество отправленных email

#### Системные метрики

- CPU и memory usage
- Database connection pool usage
- Redis memory usage
- Disk space

### Логирование

#### Логи сервисов

Все сервисы логируют в stdout/stderr:

- Request/response логи
- Error логи с stack traces
- Business logic события
- Database queries (в development)

#### Уровни логирования

- `error` - критические ошибки
- `warn` - предупреждения
- `info` - общая информация
- `debug` - детальная отладочная информация

#### Структура логов

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "service": "user-profile",
  "message": "User registered successfully",
  "userId": "user-123",
  "requestId": "req-456"
}
```

### Alerting

#### Автоматические алерты

1. **Health check failures**
   - Сервис недоступен > 5 минут
   - Database connection lost
   - High error rate (>5%)

2. **Performance alerts**
   - Response time > 2 seconds
   - High memory usage (>80%)
   - Database connection pool exhausted

3. **Business alerts**
   - Резкое падение регистраций
   - Высокий процент ошибок в диалогах
   - Проблемы с email доставкой

#### Ручная проверка

```bash
# Проверка всех health endpoints
curl -f https://jack-gateway.fly.dev/health

# Проверка логов сервиса
flyctl logs --app jack-user-profile

# Проверка метрик Fly.io
flyctl status --app jack-gateway
```

### Troubleshooting guide

#### Сервис недоступен

1. Проверить health endpoint: `curl https://jack-service-name.YC_FOLDER_ID.serverless.yandexcloud.net/health`
2. Посмотреть логи: `yc serverless container logs --container-name jack-service-name`
3. Проверить зависимости (DB, Redis)
4. Перезапустить контейнер: `yc serverless container revision deploy --container-name jack-service-name --image cr.yandex/REGISTRY_ID/jack-ai/service-name:latest`

#### Высокая нагрузка

1. Проверить метрики: `yc monitoring metrics get --service serverless-containers --folder-id YC_FOLDER_ID`
2. Посмотреть логи на предмет ошибок
3. Проверить database queries в Yandex Managed PostgreSQL
4. Масштабировать: увеличить `--concurrency` и `--memory` в настройках контейнера

#### Ошибки в API

1. Проверить логи сервиса: `yc serverless container logs --container-name jack-service-name`
2. Проверить входные данные в логах
3. Проверить подключение к зависимостям (PostgreSQL/Redis)
4. Проверить переменные окружения в настройках контейнера

#### Проблемы с YandexGPT

1. Проверить квоты: перейдите в консоль → AI → Foundation Models
2. Проверить API ключ в сервисном аккаунте
3. Проверить роль `ai.languageModels.user` у сервисного аккаунта

## Production Checklist

- [ ] Все сервисы запущены и работают
- [ ] Health checks проходят успешно
- [ ] База данных инициализирована
- [ ] Redis работает и доступен
- [ ] Все API ключи настроены
- [ ] SSL/TLS сертификаты установлены
- [ ] Reverse proxy настроен
- [ ] Мониторинг настроен
- [ ] Логирование настроено
- [ ] Backup базы данных настроен
- [ ] Rate limiting настроен
- [ ] CORS настроен для production домена

## Дополнительная информация

- Конфигурация: см. `docs/CONFIGURATION.md`
- Архитектура: см. `docs/ARCHITECTURE.md`
- Docker: см. `infrastructure/DOCKER_GUIDE.md`
