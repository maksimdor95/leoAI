# MVP 0 Daily Execution Checklist

Этот документ — твой ежедневный рабочий трекер до завершения MVP 0.  
Формат: открываешь нужный день, выполняешь пункты, ставишь отметки, фиксируешь результат.

---

## Как пользоваться (каждый день)

1. Выполни блок `Do`.
2. Заполни блок `Done`.
3. Если день не закрыт — перенеси только 1–2 незавершенных пункта на завтра.

---

## Неделя 1 — Scope + Security Foundation

### Day 1 — Freeze scope
**Do**
- [x] Зафиксировать `Primary MVP0 flow(s)`: co-primary — `Jack` + `WannaNew` (2026-04-18).
- [x] Вместо шаблона «второй сценарий = support»: явно зафиксировано, что **оба** пути в релизе MVP0 (без downgrading одного в «только support»).
- [x] Внести это одной строкой в `docs/IMPROVEMENT_PLAN.md`.

**Done**
- [x] Primary flow(s) зафиксированы: co-primary 2026-04-18.
- [x] Нет «висящего» выбора Jack vs WannaNew: решение записано, спор снят.

### Day 2 — Единая картина статусов
**Do**
- [x] Проверить, что ключевые docs используют статусы `Implemented / Partial / Planned`.
- [x] Убрать противоречия по текущему статусу MVP 0 (если найдешь).

**Done**
- [x] Статусы в docs согласованы (2026-04-18).

### Day 3 — Secrets/Auth baseline
*Ревью кода/репо: **сервер и полный стек не обязательны**; сравнить фактические значения `JWT_SECRET` в локальных `services/*/.env` / секретах деплоя — **вручную** (секреты в git не коммитим). E2E: поднять сервисы и при необходимости `npm run smoke:mvp0`.*

**Do**
- [x] Проверить, что `JWT_SECRET` одинаков во всех сервисах (требование в `docs/CONFIGURATION.md`; на машине — сверка одного и того же значения во всех `services/*/.env` для данного окружения).
- [x] Проверить, что нет небезопасного fallback для `JWT_SECRET` в auth-пути: убраны default в `authService` у `email` и `job-matching`; `ai-nlp` / `report` / `conversation` — без дев-секрета в рантайме.
- [x] Проверить, что `ai-nlp` критичные `POST /api/ai/*` идут через `requireAuth` (кроме публичного `/health`).

**Done**
- [x] Auth-контур в коде согласован; операционная сверка `JWT_SECRET` в `.env` — вне репо (2026-04-18).

### Day 4 — Rate limit + TLS
**Do**
- [x] Проверить rate-limit для AI-heavy маршрутов: `ai-nlp` — `app.use('/api/ai', aiRateLimit)` (`services/ai-nlp/src/index.ts`), параметры `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX_REQUESTS` (см. `docs/CONFIGURATION.md`).
- [x] Проверить Redis TLS: `rejectUnauthorized` при `REDIS_SSL=true` теперь **не** принудительно `false` в `conversation` и `job-matching` (как в `ai-nlp`): учитывается `REDIS_TLS_ALLOW_INSECURE` (`false` по умолчанию для staging/prod); описано в `docs/CONFIGURATION.md`.

**Done**
- [x] Rate-limit на `/api/ai/*` и единая политика Redis TLS зафиксированы в коде и доке (2026-04-18).

### Day 5 — Sensitive logging cleanup
_Статус: завершено (2026-04-22)_

**Do**
- [x] Проверить логи на утечки (token, raw body, персональные данные).
- [x] Убедиться, что debug-вставки не используются в рабочем контуре.

**Done**
- [x] Логи безопасны для staging/prod.(2026-04-22).

### Day 6 — Security regression check 
**Do**
- [x] Пройти auth happy-path и invalid-token path вручную. 
- [x] Убедиться, что ошибки возвращаются корректно (401/403/500 по смыслу).

**Done**
- [x] Security floor подтвержден.(2026-04-22).

### Day 7 — Weekly review #1
**Do**
- [x] Обновить `docs/IMPROVEMENT_PLAN.md`: что закрыто за неделю.
- [x] Зафиксировать 3 главных фокуса на Неделю 2.

**Done**
- [x] Неделя 1 закрыта.

---

## Неделя 2 — Core Flow Hardening (часть 1)

### Day 8
**Do**
- [x] Пройти primary flow от старта до середины.
- [x] Зафиксировать 3 главных точки падения/нестабильности.

**Done**
- [x] Top-3 точки нестабильности зафиксированы:
  1) Зависимость от порядка старта инфраструктуры (`postgres`/`redis`) — при недоступности на старте сервисы дают `ECONNREFUSED` и требуют ручного рестарта.
  2) Неоднозначность auth/check в ручном контуре — частая ошибка подстановки `JWT_SECRET` вместо user JWT, что ломает happy-path на раннем шаге.
  3) Нестабильность середины flow в интеграции с подбором — при недоступности внешних источников и/или недостаточном профиле подбор уходит в fallback/пустые результаты, что снижает предсказуемость UX.
- [x] Приоритизация для Недели 2 зафиксирована:
  - P0: #1 (инфраструктурный старт и авто-восстановление).
  - P1: #2 (auth/check guardrails и явная валидация токена).
  - P1: #3 (предсказуемый UX для fallback/пустых результатов подбора).
- [x] Решение по этапу: **Day 8 считается пройденным** (цель дня — диагностика и фиксация top-3 проблем — выполнена).
- [ ] Follow-up: прикрепить ссылки на PR/коммиты по закрытию #1/#2/#3 в блоках Day 9–11. (2026-04-22).

### Day 9
**Do**
- [ ] Исправить #1 точку падения.
- [ ] Прогнать повторно участок сценария.

### Day 10
**Do**
- [ ] Исправить #2 точку падения.
- [ ] Проверить, что нет регрессии в соседнем шаге.

### Day 11
**Do**
- [ ] Исправить #3 точку падения.
- [ ] Проверить user-visible ошибки (понятность текста).

### Day 12
**Do**
- [ ] Нормализовать timeout/retry в критичном межсервисном вызове.
- [ ] Зафиксировать настройки в docs (кратко).

### Day 13
**Do**
- [ ] Прогнать primary flow 3 раза подряд.
- [ ] Зафиксировать результат (успех/проблемы).

### Day 14 — Weekly review #2
**Do**
- [ ] Обновить статус недели в `docs/IMPROVEMENT_PLAN.md`.
- [ ] Определить 2–3 задачи на “доведение до 5/5 прогонов”.

---

## Неделя 3 — Core Flow Hardening (часть 2)

### Day 15
- [ ] Закрыть задачу стабильности #1.

### Day 16
- [ ] Закрыть задачу стабильности #2.

### Day 17
- [ ] Закрыть задачу стабильности #3.

### Day 18
- [ ] Проверить UX пустых/слабых результатов (без технического жаргона для пользователя).

### Day 19
- [ ] Прогнать primary flow 5 раз подряд.

### Day 20
- [ ] Разобрать причины каждого fail (если есть).
- [ ] Починить минимум 1 root-cause.

### Day 21 — Weekly review #3
- [ ] Цель недели достигнута: 5/5 успешных прогонов или есть четкий список blockers.

---

## Неделя 4 — Smoke/Test Gate

### Day 22
- [ ] Обновить/проверить `npm run smoke:mvp0`.

### Day 23
- [ ] Добавить/проверить smoke: auth + session creation.

### Day 24
- [ ] Добавить/проверить smoke: chat loop + completion trigger.

### Day 25
- [ ] Добавить/проверить smoke: final artifact delivery.

### Day 26
- [ ] Добавить/проверить negative case (timeout/empty data).

### Day 27
- [ ] Собрать “единый pre-release прогон” и зафиксировать шаги.

### Day 28 — Weekly review #4
- [ ] Smoke gate стабильно проходит.

### Resume extraction hardening (дополнительный трек Week 4-5)
**Do**
- [ ] Убедиться, что `resume-parser` поднят и `GET /health` отвечает `{"status":"ok"}`.
- [ ] Прогнать single smoke: `npm run smoke:resume -- "/path/to/file.pdf"` на минимум 3 реальных PDF.
- [ ] Прогнать batch smoke: `npm run smoke:resume:batch -- "/path/to/folder-with-pdf"` на контрольной выборке (10+ файлов).
- [ ] Зафиксировать итоги в логе дня: `pdfplumber wins`, средний прирост `quality/chars`, изменения latency.
- [ ] При проблемах свериться с `docs/MVP/MVP0_RESUME_EXTRACTION_RUNBOOK.md` и отметить причину/действие.

**Done**
- [ ] Контур `pdf-parse -> pdfplumber` подтвержден на контрольной выборке.
- [ ] Порог `RESUME_QUALITY_THRESHOLD` либо подтвержден, либо скорректирован и задокументирован.
- [ ] Принято решение: держать fallback always-on / ограниченно / временно отключить.

---

## Неделя 5 — Release Engineering + Staging Rehearsal

### Day 29
- [ ] Проверить env-matrix (local/staging/prod) по `docs/CONFIGURATION.md`.

### Day 30
- [ ] Проверить runbook выкладки и rollback по `docs/MVP0_RELEASE_RUNBOOK.md`.

### Day 31
- [ ] Поднять staging с production-like env.

### Day 32
- [ ] Прогнать `npm run smoke:mvp0` на staging.

### Day 33
- [ ] Пройти manual primary flow на staging до финального результата.

### Day 34
- [ ] Закрыть найденные P0/P1 после rehearsal.

### Day 35 — Weekly review #5
- [ ] Staging rehearsal PASS без ручной импровизации.

---

## Неделя 6 — Launch + Hypercare

### Day 36 (Launch day)
- [ ] Soft launch на ограниченный трафик.
- [ ] Зафиксировать baseline по 3 метрикам.

### Day 37
- [ ] Снять метрики: Activation / Completion / Perceived value.
- [ ] Исправить только P0/P1.

### Day 38
- [ ] Повторить метрики.
- [ ] Проверить, что completion не падает.

### Day 39
- [ ] Повторный smoke + проверка логов на 5xx/ошибки.

### Day 40
- [ ] Только точечные UX-правки в primary flow.

### Day 41
- [ ] Повторный метрик-ревью + очистка хвоста P1.

### Day 42 (Hypercare close)
- [ ] Итог 7 дней: инциденты, тренд метрик, решение (закрываем MVP 0 / продлеваем).

---

## Лог выполнения

### 2026-04-18 (Day 1)
- Primary flow: co-primary — Jack + WannaNew
- Что сделал:
  - Зафиксирован scope: оба сценария co-primary, строка в `docs/IMPROVEMENT_PLAN.md`
- Smoke: —
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: перейти к Day 2 (статусы в docs)

### 2026-04-18 (Day 1)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Согласованы `Implemented/Partial/Planned`: пояснение в `DEVELOPMENT_PLAN.md`, ссылка в `PRODUCT_VISION.md`, релизная цель в `IMPROVEMENT_PLAN.md`
  - Снято противоречие «один primary (A|B) vs co-primary» между `DEVELOPMENT_PLAN` и scope freeze
- Smoke: —
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: Day 3 (secrets/auth baseline)

### 2026-04-18 (Day 1)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Day 3: ревью JWT/`authService`/маршрутов `ai-nlp` без обязательного запуска; правка `email` + `job-matching` `authService` (нет fallback JWT при отсутствии/placeholder секрета)
- Smoke: —
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: Day 4 (rate limit + Redis TLS)

### 2026-04-18 (Day 1)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Подтверждён `aiRateLimit` на префиксе `/api/ai`; TLS Redis: `conversation` + `job-matching` (вкл. `redisTls.ts` / `ioredisTlsOptions`) согласованы с `ai-nlp` и `REDIS_TLS_ALLOW_INSECURE`
- Smoke: —
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: Day 5 (логи / PII)

### 2026-04-22 (Day 5)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Выполнен sensitive logging cleanup: убраны `req.body`/auth-утечки из runtime/error логов, удалены debug-вставки в рабочем контуре, добавлена redaction-политика в middleware
- Smoke: —
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: перейти к Day 6 (security regression check)

### 2026-04-22 (Day 6)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Прогнан ручной auth regression check на `user-profile` (`/api/users/profile`), `conversation` (`/api/conversations`) и `ai-nlp` (`/api/ai/process-message`) по сценариям valid/missing/invalid token
  - Коды ответов подтверждены по смыслу: valid auth на защищённых read-эндпоинтах даёт `200`; missing/invalid token стабильно даёт `401/403`; для valid token на `ai-nlp` получен `400` по валидации body (auth пройден, отклонение на уровне payload)
- Smoke: PASS (security-auth subset)
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: перейти к Day 7 (weekly review #1)

### 2026-04-22 (Day 7)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Обновлён `docs/IMPROVEMENT_PLAN.md`: зафиксировано закрытие Недели 1 (Day 1–6), статус `Security floor` переведён в `Implemented`
  - Зафиксированы 3 фокуса на Неделю 2: пройти flow до середины и собрать топ-3 точки нестабильности; поэтапно закрыть 3 причины падений; нормализовать timeout/retry в критичном межсервисном вызове с фиксацией в docs
- Smoke: —
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: перейти к Day 8 (Core Flow Hardening, часть 1)

### 2026-04-22 (Day 8)
- Primary flow: co-primary (без изменений)
- Что сделал:
  - Пройден участок primary flow от старта до середины (auth + вход в диалоговый контур + проверка середины пути на интеграциях)
  - Зафиксирован Top-3 нестабильностей: порядок старта зависимостей; человеческая ошибка с типом токена в ручных проверках; нестабильность середины пути при слабом/неполном профиле и внешних источниках вакансий
- Smoke: PASS (flow start-to-mid subset)
- Метрики: —
- Инциденты P0/P1: —
- Решение на завтра: Day 9 — исправить точку падения #1 (порядок старта/готовность зависимостей)

---

## Ежедневный лог (копируй блок на каждый день)

```md
### YYYY-MM-DD (Day N)
- Primary flow: Jack/WannaNew
- Что сделал:
  - ...
- Smoke: PASS/FAIL
- Метрики:
  - Activation:
  - Completion:
  - Perceived value:
- Инциденты P0/P1:
  - ...
- Решение на завтра (до 3 пунктов):
  1) ...
  2) ...
  3) ...
```
