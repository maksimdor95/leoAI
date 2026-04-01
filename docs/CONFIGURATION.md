# Руководство по конфигурации Jack AI

Это руководство описывает все переменные окружения, используемые в Jack AI, и их назначение.

## Быстрая настройка

1. Скопируйте `env.example` в `.env`:

   ```bash
   cp env.example .env
   ```

2. Заполните обязательные переменные (см. разделы ниже)

3. Перезапустите сервисы после изменения конфигурации

## Общие настройки

### Application Settings

| Переменная    | Описание                           | Значение по умолчанию | Обязательно |
| ------------- | ---------------------------------- | --------------------- | ----------- |
| `NODE_ENV`    | Окружение (development/production) | `development`         | Нет         |
| `APP_NAME`    | Название приложения                | `Jack AI Service`     | Нет         |
| `APP_VERSION` | Версия приложения                  | `0.1.0`               | Нет         |

### Ports (по сервисам)

Каждый сервис может использовать свою переменную `PORT`, но можно задать индивидуально:

| Переменная          | Сервис                     | Значение по умолчанию |
| ------------------- | -------------------------- | --------------------- |
| `USER_PROFILE_PORT` | User Profile Service       | `3001`                |
| `CONVERSATION_PORT` | Conversation Service       | `3002`                |
| `AI_NLP_PORT`       | AI/NLP Service             | `3003`                |
| `JOB_MATCHING_PORT` | Job Matching Service       | `3004`                |
| `EMAIL_PORT`        | Email Notification Service | `3005`                |
| `FRONTEND_PORT`     | Frontend                   | `3000`                |

## База данных

### PostgreSQL

**Все сервисы, использующие PostgreSQL, требуют эти переменные:**

| Переменная    | Описание         | Значение по умолчанию | Обязательно |
| ------------- | ---------------- | --------------------- | ----------- |
| `DB_HOST`     | Хост PostgreSQL  | `localhost`           | Да          |
| `DB_PORT`     | Порт PostgreSQL  | `5432`                | Да          |
| `DB_NAME`     | Имя базы данных  | `jack_ai`             | Да          |
| `DB_USER`     | Имя пользователя | `postgres`            | Да          |
| `DB_PASSWORD` | Пароль           | -                     | Да          |
| `DB_SSL`      | Использовать SSL | `false`               | Нет         |

**Пример для Docker:**

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jack_ai
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_SSL=false
```

### Redis

**Все сервисы, использующие Redis, требуют эти переменные:**

| Переменная       | Описание             | Значение по умолчанию | Обязательно |
| ---------------- | -------------------- | --------------------- | ----------- |
| `REDIS_HOST`     | Хост Redis           | `localhost`           | Да          |
| `REDIS_PORT`     | Порт Redis           | `6379`                | Да          |
| `REDIS_PASSWORD` | Пароль (опционально) | -                     | Нет         |
| `REDIS_DB`       | Номер базы данных    | `0`                   | Нет         |
| `REDIS_PREFIX`   | Префикс для ключей   | -                     | Нет         |

**Пример:**

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## AI/NLP Service

### YandexGPT (Yandex Cloud)

**Обязательно для работы AI/NLP Service:**

| Переменная     | Описание                | Обязательно       |
| -------------- | ----------------------- | ----------------- |
| `YC_FOLDER_ID` | ID папки в Yandex Cloud | Да (в production) |
| `YC_API_KEY`   | API ключ Yandex Cloud   | Да (в production) |
| `YC_MODEL_ID`  | ID модели               | Нет               |

**Опциональные параметры модели:**

| Переменная       | Описание                        | Значение по умолчанию |
| ---------------- | ------------------------------- | --------------------- |
| `YC_TEMPERATURE` | Температура генерации           | `0.6`                 |
| `YC_MAX_TOKENS`  | Максимальное количество токенов | `800`                 |
| `YC_TOP_P`       | Top-p параметр                  | `0.9`                 |

**Как получить ключи:**

1. Зарегистрируйтесь в [Yandex Cloud](https://cloud.yandex.ru/)
2. Создайте каталог (folder)
3. Получите `YC_FOLDER_ID` из URL или настроек каталога
4. Создайте сервисный аккаунт и получите API ключ

**Пример:**

```env
YC_FOLDER_ID=b1g2v3c4d5e6f7g8h9i0j1
YC_API_KEY=AQVNxxxxxxxxxxxxxxxxxxxxxxxxx
YC_MODEL_ID=foundation-models/yandexgpt-lite
```

## Email Notification Service

Сервис поддерживает отправку email через SMTP (Яндекс почта) или SendGrid. **Приоритет: SMTP > SendGrid**

### SMTP (Яндекс почта) - РЕКОМЕНДУЕТСЯ

**Обязательно для отправки email через Яндекс почту:**

| Переменная      | Описание                    | Обязательно         |
| --------------- | --------------------------- | ------------------- |
| `SMTP_HOST`     | SMTP сервер                 | Да (для production) |
| `SMTP_PORT`     | Порт SMTP                   | Нет (по умолчанию 465) |
| `SMTP_SECURE`   | Использовать SSL/TLS        | Нет (по умолчанию true) |
| `SMTP_USER`     | Email адрес для авторизации | Да (для production) |
| `SMTP_PASSWORD` | Пароль приложения           | Да (для production) |
| `FROM_EMAIL`    | Email отправителя           | Нет                 |
| `FROM_NAME`     | Имя отправителя             | Нет                 |

**Как настроить Яндекс почту:**

1. **Создайте пароль приложения:**
   - Перейдите в [настройки безопасности Яндекс](https://id.yandex.ru/security)
   - В разделе «Доступ к вашим данным» выберите «Пароли приложений»
   - Создайте новый пароль для почтового клиента
   - **Важно:** Используйте пароль приложения, а не основной пароль аккаунта!

2. **Настройте переменные окружения:**

```env
# Яндекс почта SMTP
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@yandex.ru
SMTP_PASSWORD=your_app_password_here

# Email отправителя
FROM_EMAIL=your-email@yandex.ru
FROM_NAME=Jack AI
```

**Параметры SMTP для Яндекс почты:**

- **SMTP-сервер:** `smtp.yandex.ru`
- **Порт:** `465` (SSL/TLS) или `587` (STARTTLS)
- **Шифрование:** SSL/TLS (для порта 465) или STARTTLS (для порта 587)
- **Логин:** полный email адрес (например, `user@yandex.ru`)
- **Пароль:** пароль приложения (не основной пароль!)

**Пример для порта 587 (STARTTLS):**

```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yandex.ru
SMTP_PASSWORD=your_app_password_here
```

### SendGrid (альтернатива)

Если SMTP не настроен, сервис может использовать SendGrid как fallback:

| Переменная         | Описание          | Обязательно |
| ------------------ | ----------------- | ----------- |
| `SENDGRID_API_KEY` | API ключ SendGrid | Нет         |

**Как получить API ключ:**

1. Зарегистрируйтесь на [SendGrid](https://sendgrid.com/)
2. Создайте API ключ в Settings → API Keys
3. Скопируйте ключ в `.env`

**Пример:**

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxx
```

**Примечание:** 
- Если настроен SMTP, он будет использоваться в первую очередь
- Если SMTP не настроен или произошла ошибка, будет использован SendGrid (если настроен)
- Если ни SMTP, ни SendGrid не настроены, email будут только логироваться, но не отправляться

### Base URL

| Переменная | Описание                       | Значение по умолчанию   |
| ---------- | ------------------------------ | ----------------------- |
| `BASE_URL` | Базовый URL для ссылок в email | `http://localhost:3000` |

## Аутентификация

### JWT

**Критически важно:** `JWT_SECRET` должен быть одинаковым во всех сервисах!

| Переменная               | Описание                           | Значение по умолчанию | Обязательно |
| ------------------------ | ---------------------------------- | --------------------- | ----------- |
| `JWT_SECRET`             | Секретный ключ для JWT             | -                     | Да          |
| `JWT_EXPIRES_IN`         | Время жизни токена                 | `7d`                  | Нет         |
| `JWT_REFRESH_SECRET`     | Секретный ключ для refresh токенов | -                     | Нет         |
| `JWT_REFRESH_EXPIRES_IN` | Время жизни refresh токена         | `30d`                 | Нет         |

**Важно для production:**

- Используйте длинный случайный ключ (минимум 32 символа)
- Генерируйте разные ключи для разных окружений
- Никогда не коммитьте реальные ключи в Git

**Генерация ключа:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Job Matching Service

### Job Scraping

| Переменная      | Описание                 | Обязательно |
| --------------- | ------------------------ | ----------- |
| `HH_API_KEY`    | API ключ HeadHunter.ru   | Нет         |
| `HH_API_URL`    | URL API HH.ru            | Нет         |
| `USE_MOCK_JOBS` | Использовать mock данные | Нет         |

**USE_MOCK_JOBS:**

- `true` - всегда использовать mock данные (только для тестирования)
- `false` - пытаться использовать реальный скрейпинг (по умолчанию)

**Пример:**

```env
HH_API_KEY=your_hh_api_key_here
HH_API_URL=https://api.hh.ru
USE_MOCK_JOBS=false
```

**Примечание:** Если `HH_API_KEY` не задан, и `USE_MOCK_JOBS=false`, в development режиме будут использоваться mock данные как fallback. В production без API ключа скрейпинг не будет работать.

## Service URLs

**Для межсервисного взаимодействия:**

| Переменная                 | Описание                          | Значение по умолчанию   |
| -------------------------- | --------------------------------- | ----------------------- |
| `USER_PROFILE_SERVICE_URL` | URL User Profile Service          | `http://localhost:3001` |
| `CONVERSATION_SERVICE_URL` | URL Conversation Service          | `http://localhost:3002` |
| `AI_SERVICE_URL`           | URL AI/NLP Service                | `http://localhost:3003` |
| `AI_NLP_SERVICE_URL`       | Альтернативное имя для AI Service | `http://localhost:3003` |
| `JOB_MATCHING_SERVICE_URL` | URL Job Matching Service          | `http://localhost:3004` |
| `EMAIL_SERVICE_URL`        | URL Email Notification Service    | `http://localhost:3005` |

**Для production:** Используйте внутренние URL или service discovery.

## Frontend

### Environment Variables

Переменные с префиксом `NEXT_PUBLIC_` доступны в браузере:

| Переменная                             | Описание                           | Значение по умолчанию   |
| -------------------------------------- | ---------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`                  | URL User Profile Service           | `http://localhost:3001` |
| `NEXT_PUBLIC_CONVERSATION_API_URL`     | URL Conversation Service API       | `http://localhost:3002` |
| `NEXT_PUBLIC_CONVERSATION_SERVICE_URL` | URL Conversation Service WebSocket | `http://localhost:3002` |

**Для production:** Используйте публичные URL или CDN.

### CORS

| Переменная    | Описание                    | Значение по умолчанию   |
| ------------- | --------------------------- | ----------------------- |
| `CORS_ORIGIN` | Разрешенный origin для CORS | `http://localhost:3000` |

**Для production:** Укажите реальный домен вашего frontend.

## Логирование

| Переменная   | Описание                                    | Значение по умолчанию |
| ------------ | ------------------------------------------- | --------------------- |
| `LOG_LEVEL`  | Уровень логирования (debug/info/warn/error) | `info`                |
| `LOG_FORMAT` | Формат логов (json/text)                    | `json`                |

## Мониторинг

### Sentry

| Переменная   | Описание       | Обязательно |
| ------------ | -------------- | ----------- |
| `SENTRY_DSN` | DSN для Sentry | Нет         |

**Как получить DSN:**

1. Зарегистрируйтесь на [Sentry](https://sentry.io/)
2. Создайте проект
3. Скопируйте DSN в `.env`

### DataDog

| Переменная   | Описание         | Обязательно |
| ------------ | ---------------- | ----------- |
| `DD_API_KEY` | API ключ DataDog | Нет         |
| `DD_APP_KEY` | App ключ DataDog | Нет         |

## Rate Limiting

| Переменная                | Описание                           | Значение по умолчанию |
| ------------------------- | ---------------------------------- | --------------------- |
| `RATE_LIMIT_WINDOW_MS`    | Окно rate limiting в миллисекундах | `900000` (15 минут)   |
| `RATE_LIMIT_MAX_REQUESTS` | Максимальное количество запросов   | `100`                 |

## Проверка конфигурации

Все сервисы автоматически проверяют конфигурацию при запуске. Если обнаружены проблемы:

1. Проверьте логи сервиса
2. Убедитесь, что все обязательные переменные установлены
3. Проверьте формат значений (особенно для портов и URL)

**Пример ошибки конфигурации:**

```
❌ Configuration errors found:
   ❌ DB_PASSWORD is required but not set or using default value

Please set the required environment variables and restart the service.
See env.example for reference.
```

## Production Checklist

Перед развертыванием в production:

- [ ] Все обязательные переменные установлены
- [ ] `JWT_SECRET` - длинный случайный ключ (минимум 32 символа)
- [ ] `NODE_ENV=production`
- [ ] Настроены реальные API ключи (YandexGPT, HH.ru)
- [ ] Настроен SMTP для Email Service (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) или SendGrid API ключ
- [ ] `USE_MOCK_JOBS=false`
- [ ] Настроены реальные URL для межсервисного взаимодействия
- [ ] Настроен `CORS_ORIGIN` для production домена
- [ ] Настроено логирование (Sentry, DataDog)
- [ ] Используются безопасные пароли для БД
- [ ] SSL включен для подключения к БД (если требуется)

## Troubleshooting

### Проблема: Сервис не запускается

1. Проверьте логи запуска
2. Убедитесь, что все обязательные переменные установлены
3. Проверьте доступность зависимостей (DB, Redis)

### Проблема: Email не отправляются

**Если используете SMTP (Яндекс почта):**

1. Проверьте, что все SMTP переменные установлены (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`)
2. Убедитесь, что используете **пароль приложения**, а не основной пароль аккаунта
3. Проверьте логи Email Service на наличие ошибок SMTP
4. Убедитесь, что порт и настройки безопасности корректны:
   - Порт 465: `SMTP_SECURE=true`
   - Порт 587: `SMTP_SECURE=false`
5. Проверьте, что email адрес в `SMTP_USER` и `FROM_EMAIL` совпадают

**Если используете SendGrid:**

1. Проверьте, что `SENDGRID_API_KEY` установлен
2. Проверьте логи Email Service
3. Убедитесь, что email адрес отправителя верифицирован в SendGrid

**Общие проблемы:**

- Если настроены и SMTP, и SendGrid, приоритет у SMTP
- Если SMTP не работает, сервис автоматически попробует SendGrid (если настроен)
- Проверьте логи для деталей ошибок

### Проблема: AI не отвечает

1. Проверьте, что `YC_FOLDER_ID` и `YC_API_KEY` установлены
2. Проверьте логи AI/NLP Service
3. Убедитесь, что баланс Yandex Cloud положительный

### Проблема: Jobs не скрейпятся

1. Проверьте, что `HH_API_KEY` установлен или `USE_MOCK_JOBS=true`
2. Проверьте логи Job Matching Service
3. Убедитесь, что Redis доступен для очередей

## Дополнительная информация

- Полный список переменных: см. `env.example`
- Настройка Docker: см. `infrastructure/DOCKER_GUIDE.md`
- Архитектура: см. `docs/ARCHITECTURE.md`
