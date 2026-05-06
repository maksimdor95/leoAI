# MVP0 Day 29 - Env Matrix (local/staging/prod)

Дата проверки: 2026-04-26

Источник требований: `docs/CONFIGURATION.md`

## 1) Local

- Источник: `/.env` (используется сервисами через shared env).
- Проверка обязательного минимума (`DB_*`, `REDIS_*`, `JWT_SECRET`, `*_SERVICE_URL`, `CORS_ORIGIN`): **OK**.
- Проверка production-critical ключей в локальном файле:
  - отсутствуют: `USE_MOCK_JOBS`, `JOB_CATALOG_TOKEN`;
  - присутствуют: `YC_*`, `SMTP_*`.

Вывод: для local dev конфигурация рабочая; для production policy нужны отдельные значения/секреты и явные флаги.

## 2) Staging

- Отдельный файл окружения (`.env.staging` / аналогичный шаблон) в репозитории **не найден**.
- Matrix для staging на текущем этапе: **Not provisioned in repo**.

Минимум к Day 31:
- `NODE_ENV=production`
- отдельный `JWT_SECRET` (не local)
- явный `USE_MOCK_JOBS=false`
- задать `JOB_CATALOG_TOKEN`
- актуальные `*_SERVICE_URL` и `CORS_ORIGIN`
- production-like Redis policy (`REDIS_SSL=true`, без `REDIS_TLS_ALLOW_INSECURE=true`)

## 3) Production

- Отдельный файл окружения (`.env.production` / аналогичный шаблон) в репозитории **не найден**.
- Matrix для production на текущем этапе: **Not provisioned in repo**.

Минимум к release:
- все пункты production checklist из `docs/CONFIGURATION.md`
- секреты только через secure storage/CI variables
- `USE_MOCK_JOBS=false`, `JOB_CATALOG_TOKEN` обязателен для admin/debug endpoints

## 4) Риски и решение

- Риск: отсутствие формализованной staging/prod matrix повышает шанс config-drift между окружениями.
- Решение: перед Day 31 завести и согласовать staging/prod env-шаблоны (без реальных секретов), затем заполнить через secret manager/CI.
