# Руководство по конфигурации LEO AI

Это руководство описывает все переменные окружения, используемые в Jack AI, и их назначение.

## Быстрая настройка

1. Убедитесь, что в корне проекта есть файл `.env` (локальный, не коммитится в Git).

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

Сервисы слушают **`process.env.PORT`** (иначе дефолт в коде, часто `8080`). В локальной разработке порт задаётся в **`package.json` → `scripts.dev`** (`PORT=3001` … `PORT=3007` для report). Общий корневой `.env` через symlink не может задать разный `PORT` на процесс — URL сервисов друг на друга задаются через `*_SERVICE_URL`.

| Сервис              | Типичный порт при `npm run dev` |
| ------------------- | ------------------------------- |
| User Profile        | `3001`                          |
| Conversation        | `3002`                          |
| AI/NLP              | `3003`                          |
| Job Matching        | `3004`                          |
| Email               | `3005`                          |
| Report              | `3007`                          |
| Frontend (`next`)   | `3000`                          |

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
| `REDIS_SSL`      | TLS к Redis (`true` / `false`) | `false`        | Нет         |
| `REDIS_TLS_ALLOW_INSECURE` | При `REDIS_SSL=true`: не проверять сертификат (только dev, self-signed) | `false` | Нет |

`conversation`, `job-matching` и `ai-nlp` используют одну политику: при `REDIS_SSL=true` по умолчанию `rejectUnauthorized: true`; в staging/prod **не** выставлять `REDIS_TLS_ALLOW_INSECURE` (остаётся `false`).

**Пример:**

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
# REDIS_SSL=true
# REDIS_TLS_ALLOW_INSECURE=true   # только локально при self-signed
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

**Опциональные параметры SpeechKit TTS (голос ассистента):**

| Переменная   | Описание                                  | Значение по умолчанию |
| ------------ | ----------------------------------------- | --------------------- |
| `TTS_VOICE`  | Голос SpeechKit (напр. `ermil`, `filipp`) | `ermil`               |
| `TTS_SPEED`  | Скорость речи (0.1 - 3.0)                 | `1.0`                 |
| `TTS_FORMAT` | Формат аудио (`oggopus` или `mp3`)        | `oggopus`             |
| `TTS_PRESET` | Готовый пресет голоса                     | `ermil_normal`        |

Доступные `TTS_PRESET`:
- `ermil_normal` — Ермил, стандартная скорость (`1.0`), `oggopus`
- `ermil_soft` — Ермил, мягче/медленнее (`0.92`), `oggopus`
- `filipp_fast` — Филипп, быстрее (`1.08`), `oggopus`

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
TTS_VOICE=ermil
TTS_SPEED=1.0
TTS_FORMAT=oggopus
TTS_PRESET=ermil_normal
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
- В `conversation` и `report` больше нет безопасного fallback секрета: при отсутствии `JWT_SECRET` сервис вернёт ошибку конфигурации.

**Генерация ключа:**

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Job Matching Service

### Job Scraping

Скрейпер поддерживает два источника вакансий: **HeadHunter** и **SuperJob**.  
Достаточно настроить хотя бы один из них; оба могут работать одновременно.

| Переменная            | Описание                                | Обязательно |
| --------------------- | --------------------------------------- | ----------- |
| `HH_API_KEY`          | API ключ HeadHunter.ru                  | Нет*        |
| `HH_API_URL`          | URL API HH.ru                           | Нет         |
| `HH_TOKEN_URL`        | URL OAuth token endpoint HH             | Нет (`https://api.hh.ru/token`) |
| `HH_USER_AGENT`       | User-Agent для HH API (обязателен для запросов к HH) | Да** |
| `HH_CLIENT_ID`        | OAuth Client ID HH (salary API)         | Нет***      |
| `HH_CLIENT_SECRET`    | OAuth Client Secret HH (salary API)     | Нет***      |
| `HH_ACCESS_TOKEN`     | Готовый Bearer token HH (если не хотите OAuth-обмен в сервисе) | Нет |
| `HH_REFRESH_TOKEN`    | Refresh token HH для автообновления токена | Нет |
| `SUPERJOB_API_KEY`    | Secret key приложения SuperJob          | Нет*        |
| `SUPERJOB_APP_ID`     | ID приложения SuperJob (для справки)    | Нет         |
| `SUPERJOB_API_URL`    | URL API SuperJob                        | Нет         |
| `SUPERJOB_TOWN`       | ID одного города SuperJob (по умолчанию **4** = Москва; не смешивать с area id HH) | Нет         |
| `SUPERJOB_TOWN_IDS`   | Несколько городов через запятую, напр. `4,14` — в API уходит массив `t[]` | Нет         |
| `SUPERJOB_KEYWORD_LIMIT` | Сколько ключевых слов из списка скрейпера обработать (1–50, по умолчанию **10**) | Нет      |
| `SUPERJOB_PAGE_SIZE`  | `count` на страницу (1–100, по умолчанию **100**) | Нет         |
| `SUPERJOB_MAX_PAGES`  | Макс. номер страницы +1 на ключевое слово (1–500, по умолчанию **5**) | Нет         |
| `SUPERJOB_MAX_VACANCIES_PER_KEYWORD` | Жёсткий потолок вакансий с ключа; `0` = `maxPages × pageSize` | Нет         |
| `SUPERJOB_REQUEST_DELAY_MS` | Пауза между запросами страниц (мс), по умолчанию **550** (~лимит 120 запросов/мин с IP) | Нет         |
| `SUPERJOB_ACCESS_TOKEN` | OAuth Bearer, если нужны расширенные поля | Нет         |
| `USE_MOCK_JOBS`       | Использовать mock данные                | Нет         |
| `JOB_CATALOG_TOKEN`   | Токен доступа к debug/admin endpoint-ам `GET /api/jobs/catalog` и `GET /api/jobs/hh/salary-evaluation/:areaId` | Да в production |

> \* Должен быть задан хотя бы один из `HH_API_KEY` или `SUPERJOB_API_KEY` для получения реальных вакансий.
>
> \** Для HH API требуется корректный `User-Agent` заголовок.
>
> \*** Для salary endpoint используйте либо `HH_ACCESS_TOKEN`, либо пару `HH_CLIENT_ID` + `HH_CLIENT_SECRET` (и при необходимости `HH_REFRESH_TOKEN`).

**USE_MOCK_JOBS:**

- `true` - всегда использовать mock данные (только для тестирования)
- `false` - пытаться использовать реальный скрейпинг (по умолчанию)

**Пример (SuperJob):**

```env
SUPERJOB_API_KEY=v3.r.XXXXX.YYYYY.ZZZZZ
SUPERJOB_APP_ID=4262
USE_MOCK_JOBS=false
```

**Пример (HeadHunter):**

```env
HH_API_KEY=your_hh_api_key_here
HH_API_URL=https://api.hh.ru
USE_MOCK_JOBS=false
```

**Как получить ключ SuperJob:**

1. Зарегистрируйтесь на [SuperJob](https://www.superjob.ru/)
2. Перейдите на [api.superjob.ru](https://api.superjob.ru/) → «Зарегистрировать приложение»
3. Скопируйте **Secret key** в `SUPERJOB_API_KEY`
4. Авторизация для поиска вакансий не требуется — достаточно `X-Api-App-Id`

**Логика работы:**

1. Если есть `HH_API_KEY` — скрейпит HH.ru
2. Если есть `SUPERJOB_API_KEY` — скрейпит SuperJob
3. Если оба настроены — вакансии объединяются
4. Если ни один не настроен и `USE_MOCK_JOBS=false` — в development используются mock-данные как fallback; в production скрейпинг не будет работать

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
| `NEXT_PUBLIC_JOB_MATCHING_URL`         | URL Job Matching (подбор вакансий в браузере); если не задан — из `NEXT_PUBLIC_API_URL` с заменой порта `3001`→`3004`, иначе `http://localhost:3004` | — |
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

### Security policy for logs (staging/prod)

- Не логировать сырые payload-ы запросов (`req.body`) в runtime и error middleware.
- Не логировать `Authorization` заголовок, JWT/token (даже частично), пароли и PII (`email`, `phone`, `resume`).
- Для ошибок логировать безопасный минимум: `method`, `path`, `statusCode`, код/сообщение ошибки без чувствительных полей.
- В `development` допускается расширенная диагностика только через redaction/маскирование чувствительных ключей.
- Любые временные debug-вставки (в т.ч. file-write hooks) должны быть удалены до staging/prod.

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
| `AI_RATE_LIMIT_WINDOW_MS` | Окно rate limiting для `/api/ai/*` | `60000`               |
| `AI_RATE_LIMIT_MAX_REQUESTS` | Лимит запросов на клиент/минуту для AI | `120`         |

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
```

## Production Checklist

Перед развертыванием в production:

- [ ] Все обязательные переменные установлены
- [ ] `JWT_SECRET` - длинный случайный ключ (минимум 32 символа)
- [ ] `NODE_ENV=production`
- [ ] Настроены реальные API ключи (YandexGPT, HH.ru и/или SuperJob)
- [ ] Для production задан `JOB_CATALOG_TOKEN` (если используются admin/debug endpoints job-catalog)
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

1. Проверьте, что хотя бы один из `HH_API_KEY` / `SUPERJOB_API_KEY` установлен, или `USE_MOCK_JOBS=true`
2. Проверьте логи Job Matching Service — там указано, какие источники использовались
3. Убедитесь, что Redis доступен для очередей
4. SuperJob: лимит 120 запросов/мин с одного IP; HH.ru: rate-limit зависит от типа ключа

## Дополнительная информация

- Полный список переменных: см. этот документ и `.env` в локальной среде
- Настройка Docker: см. `infrastructure/DOCKER_GUIDE.md`
- Архитектура: см. `docs/ARCHITECTURE.md`
