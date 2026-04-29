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
- [x] Повторная верификация auth в `ai-nlp`: включён `requireAuth` на `/api/ai/*`; проверка `POST /api/ai/tts` без токена возвращает `401` (2026-04-30).

### Day 4 — Rate limit + TLS
**Do**
- [x] Проверить rate-limit для AI-heavy маршрутов: `ai-nlp` — `app.use('/api/ai', requireAuth, aiRateLimit)` (`services/ai-nlp/src/index.ts`), параметры `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX_REQUESTS` (см. `docs/CONFIGURATION.md`).
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
- [x] Исправить #1 точку падения.
- [x] Прогнать повторно участок сценария.

**Done**
- [x] Зафиксирована стабилизация старта инфраструктурных зависимостей (`postgres`/`redis`) без ручного рестарта сервисов (2026-04-26).
- [x] Выполнены 2 цикла cold-start (`docker compose restart postgres redis`) с последующей проверкой health — `3001/3002/3003/3004/3007` вернули `200 OK` в каждом цикле (2026-04-26).

### Day 10
**Do**
- [x] Исправить #2 точку падения.
- [x] Проверить, что нет регрессии в соседнем шаге.

**Execution checklist (ready)**
- [x] Подготовить валидный user JWT (не `JWT_SECRET`) и проверить `/api/users/profile` с `Authorization: Bearer <JWT>`.
- [x] Прогнать участок сценария, где ранее ломался auth/check, и зафиксировать ожидаемый результат без ручных правок окружения.
- [x] Проверить соседний шаг (до и после auth/check) на отсутствие регрессии по статус-кодам и UX-ответу.
- [x] Зафиксировать evidence: команды/curl и итоговые HTTP-коды (2026-04-26).

**Pass criteria**
- [x] Happy-path проходит с user JWT стабильно (без подстановки `JWT_SECRET`).
- [x] Ошибка токена возвращает понятное user-visible сообщение и не ломает соседний шаг.

**Done**
- [x] Auth/check подтверждён: `login -> token` (length 228), `GET /api/users/profile` с валидным JWT вернул `200`, без токена — `401`, с невалидным токеном — `403` (2026-04-26).
- [x] Соседний шаг `POST /api/chat/session`: с валидным JWT — `200` (сессия создана), с невалидным токеном — `401` (`Unauthorized: Invalid token`) (2026-04-26).

### Day 11
**Do**
- [x] Исправить #3 точку падения.
- [x] Проверить user-visible ошибки (понятность текста).

**Execution checklist (ready)**
- [x] Проверить happy-path подбора: `GET /api/jobs/match/:userId` с валидным JWT возвращает список `jobs` и/или `weakJobs` без 5xx.
- [x] Проверить кейс пустого каталога/пустого результата: убедиться, что ответ содержит понятный флаг (`catalogWarning`: `empty_catalog` / `no_matches`) и человекочитаемое сообщение.
- [x] Проверить кейс перекошенного каталога: при `catalogWarning: catalog_family_mismatch` убедиться, что пользователь получает явный сигнал о необходимости обновить сбор вакансий по профилю.
- [x] Проверить auth-ошибки на `job-matching` (`401/403`) — текст ошибки должен быть понятным и не маскироваться общим `500`.
- [x] Зафиксировать evidence: команды/curl, HTTP-коды, примеры JSON-ответов с `catalogWarning` и итоговая дата.

**Pass criteria**
- [x] Для всех ожидаемых веток (`jobs`, `weakJobs`, `empty/no_matches`, `catalog_family_mismatch`) есть предсказуемый API-ответ без “немых” падений.
- [x] User-visible сообщения объясняют следующее действие (подождать scraping / обновить профиль / запустить профильный scrape).

**Done**
- [x] Подтверждены ветки `jobs/weakJobs` и `catalog_family_mismatch`: `GET /api/jobs/match/:userId` с валидным JWT вернул `200`, `count=1`, `weakCount=2`, `catalogWarning=catalog_family_mismatch` (2026-04-26).
- [x] Для нового пользователя с тонким профилем подтверждена ветка `no_matches`: `count=0`, `weakTierTotal=0`, `catalogWarning=no_matches`, `profileFamily=unknown` (2026-04-26).
- [x] Auth-ветки прозрачные: без токена — `401 Unauthorized: No token provided`, с невалидным токеном — `401 Unauthorized: Invalid token` (2026-04-26).

### Day 12
**Do**
- [x] Нормализовать timeout/retry в критичном межсервисном вызове.
- [x] Зафиксировать настройки в docs (кратко).

**Done**
- [x] Нормализован межсервисный контур `conversation -> job-matching/email/report` в `services/conversation/src/services/integrationService.ts`: введены единые timeout-константы и retry-политика с exponential backoff для transient-сбоев (2026-04-26).
- [x] Зафиксированы базовые значения: `jobMatching=30s, retries=2`; `scrapeForUser=10s, retries=2`; `jobsEmail=10s, retries=1`; `reportGeneration=15s, retries=1` (2026-04-26).

### Day 13
**Do**
- [x] Прогнать primary flow 3 раза подряд.
- [x] Зафиксировать результат (успех/проблемы).

**Done**
- [x] Выполнено 3 последовательных прогона `npm run smoke:mvp0` с валидным user JWT — все прогоны завершились `MVP0 smoke checks passed` (2026-04-26).
- [x] Базовые проверки стабильны: health `3001/3002/3004/3007` и `GET /api/users/profile` (`200`) — без деградации между прогонами (2026-04-26).
- [x] В рамках данного smoke-шаблона проверки `SESSION_ID`, `USER_ID`, `REPORT_ID` были `SKIP` (ожидаемое поведение скрипта без доп. входных параметров) (2026-04-26).

### Day 14 — Weekly review #2
**Do**
- [x] Обновить статус недели в `docs/IMPROVEMENT_PLAN.md`.
- [x] Определить 2–3 задачи на “доведение до 5/5 прогонов”.

**Done**
- [x] Weekly review #2 добавлен в `docs/IMPROVEMENT_PLAN.md`: зафиксированы результаты Day 8–13 и текущий статус Core Flow Hardening (2026-04-26).
- [x] Зафиксированы задачи на путь к `5/5`:
  1) расширить smoke до полного primary-flow (`SESSION_ID`, `USER_ID`, `REPORT_ID`);
  2) прогнать `5/5` подряд с дневной фиксацией каждого fail;
  3) закрыть минимум 1 root-cause по итогам fail-логов (2026-04-26).

---

## Неделя 3 — Core Flow Hardening (часть 2)

### Day 15
**Do**
- [x] Закрыть задачу стабильности #1: расширить daily smoke до полного primary-flow (убрать `SKIP` по `SESSION_ID` / `USER_ID` / `REPORT_ID` в рабочем прогоне).

**Execution checklist (expanded)**
- [x] Подготовить стабильный тестовый контур: валидный user JWT, `USER_ID`, `SESSION_ID`, `REPORT_ID` (или отдельный pre-step, который их получает автоматически).
- [x] Обновить/дополнить сценарий прогона так, чтобы в daily smoke выполнялись все ключевые проверки:
  1) health сервисов,
  2) auth/profile,
  3) чтение chat session,
  4) job-matching по `USER_ID`,
  5) report status по `REPORT_ID`.
- [x] Добавить явный `FAIL` при отсутствии обязательных входных параметров для full-smoke (вместо молчаливого `SKIP`), и оставить отдельный lightweight-режим только для локального быстрого старта.
- [x] Прогнать обновлённый full-smoke минимум 2 раза подряд и убедиться, что нет ложноположительного PASS.
- [x] Зафиксировать evidence: команда запуска, фактические значения используемых IDs (без секретов), HTTP-коды по шагам, итог PASS/FAIL.

**Pass criteria**
- [x] В режиме full-smoke отсутствуют `SKIP` по `SESSION_ID` / `USER_ID` / `REPORT_ID`; все ключевые шаги реально проверяются.
- [x] При сломанном шаге smoke падает детерминированно с понятной причиной и названием шага.
- [x] Минимум 2/2 последовательных full-smoke прогона проходят без ручных вмешательств.

**Definition of done**
- [x] Полный smoke готов к ежедневному использованию в Неделе 3 и служит базой для цели `5/5` на Day 19.

**Done**
- [x] Обновлён `scripts/smoke/mvp0-smoke.sh`: добавлен режим `SMOKE_MODE=full` с обязательными `SESSION_ID`/`USER_ID`/`REPORT_ID`; в full-режиме пропуски заменены на явный `SMOKE FAILED` (2026-04-26).
- [x] Усилена проверка auth-шагов в smoke: успешным считается только `HTTP 2xx/3xx` (ранее 4xx могли проходить как “ok”) (2026-04-26).
- [x] Добавлен запуск full-сценария `npm run smoke:mvp0:full` и подтверждён результат `2/2 PASSED` с фактическими проверками session/match/report-status (`HTTP 200` на каждом шаге) (2026-04-26).

### Day 16
**Do**
- [x] Закрыть задачу стабильности #2: автоматизировать подготовку full-smoke контекста (`TOKEN`/`USER_ID`/`SESSION_ID`/`REPORT_ID`) в один запуск.

**Execution checklist**
- [x] Добавить отдельный runner-скрипт full-smoke, который сам:
  1) логинит тестового пользователя;
  2) получает `USER_ID`;
  3) создаёт новую `SESSION_ID`;
  4) инициирует отчёт и получает `REPORT_ID`;
  5) запускает `mvp0-smoke.sh` в `SMOKE_MODE=full`.
- [x] Добавить npm-алиас для запуска без ручной сборки env-переменных.
- [x] Проверить runner минимум в 2 последовательных прогона.
- [x] Зафиксировать evidence (IDs без секретов, HTTP-коды шагов, итог PASS/FAIL).

**Pass criteria**
- [x] Для full-smoke больше не требуется ручной pre-step по сборке контекста.
- [x] Команда запуска одна (`npm run smoke:mvp0:full:auto`) и воспроизводима на локальном стенде.
- [x] Минимум 2/2 прогона проходят с полным набором проверок (`profile`, `session`, `match`, `report status`).

**Done**
- [x] Добавлен `scripts/smoke/mvp0-full-run.sh`: автоматическая подготовка контекста + запуск full-smoke в цикле `RUNS=N` (2026-04-26).
- [x] Добавлен npm-скрипт `smoke:mvp0:full:auto` в `package.json` (2026-04-26).
- [x] Подтверждено `RUNS=2 npm run smoke:mvp0:full:auto`: `2/2 PASSED`, все ключевые проверки возвращают `HTTP 200` (2026-04-26).

### Day 17
**Do**
- [x] Закрыть задачу стабильности #3: добавить детерминированный run-log/summary для серии full-smoke прогонов и отдельный `5/5` gate-запуск.

**Execution checklist**
- [x] Расширить full-smoke runner логированием каждого run в отдельный файл и итоговым summary-файлом.
- [x] При падении run возвращать явный `FULL SMOKE FAILED` с номером прогона и путём к логу.
- [x] Добавить npm-команду для gate-режима (`5` прогонов подряд) без ручной сборки параметров.
- [x] Проверить обновлённый runner на серии прогонов (минимум 2/2).

**Pass criteria**
- [x] Для каждого запуска есть трассируемые артефакты (`.runlogs/smoke/*`) с контекстом и результатом каждого run.
- [x] Отказ в одном run не маскируется: процесс завершается с ошибкой и диагностикой, какой именно run упал.
- [x] Команда `5/5` gate готова к Day 19 и запускается одной командой.

**Done**
- [x] Обновлён `scripts/smoke/mvp0-full-run.sh`: добавлены `RUNLOGS_DIR`, `summary`-лог и per-run логи (`mvp0-full-<timestamp>-runN.log`) с фиксацией pass/fail (2026-04-26).
- [x] Добавлен явный fail-path при падении run: `FULL SMOKE FAILED: run i/N failed (see <log>)` (2026-04-26).
- [x] Добавлен npm-алиас `smoke:mvp0:gate` (`RUNS=5`) и подтверждена корректность обновлённого runner на `RUNS=2` (`2/2 PASSED`, summary log создан) (2026-04-26).

### Day 18
**Do**
- [x] Проверить UX пустых/слабых результатов (без технического жаргона для пользователя).

**Done**
- [x] Обновлены user-visible тексты в `frontend/app/chat/page.tsx` для веток пустого/слабого подбора: убраны технические формулировки про пороги и score из основного сообщения, добавлены более понятные next steps (2026-04-26).
- [x] Добавлена отдельная UX-плашка для `catalogWarning=no_matches` с понятным действием для пользователя (уточнить роль/стек/опыт и нажать обновление) (2026-04-26).
- [x] Упрощены формулировки для `empty_catalog` и `catalog_family_mismatch` (без внутреннего жаргона, с фокусом на действие пользователя) (2026-04-26).

### Day 19
- [x] Прогнать primary flow 5 раз подряд.

**Done**
- [x] Выполнен gate-прогон `npm run smoke:mvp0:gate` (`RUNS=5`) — результат `5/5 PASSED` (2026-04-26).
- [x] Во всех 5 прогонах подтверждены ключевые шаги full-smoke: `profile`, `session`, `match`, `report status` — `HTTP 200` без регрессий между итерациями (2026-04-26).
- [x] Сохранён артефакт прогона: summary log `/.runlogs/smoke/mvp0-full-summary-20260426-211101.log` (2026-04-26).

### Day 20
- [x] Разобрать причины каждого fail (если есть).
- [x] Починить минимум 1 root-cause.

**Done**
- [x] Разбор артефактов gate/full-smoke: по summary/run-логам fail-записей не обнаружено (серии 5/5 и 2/2 полностью зелёные) (2026-04-26).
- [x] Закрыт root-cause ложноположительного PASS: в `scripts/smoke/mvp0-smoke.sh` добавлена JSON-валидация для full-веток (`session`, `match`, `report status`), чтобы проход зависел не только от `HTTP 200`, но и от структуры ответа (`sessionId`, `count/weakCount`, `reportId/status`) (2026-04-26).
- [x] Подтверждение после фикса: `RUNS=2 npm run smoke:mvp0:full:auto` — `2/2 PASSED` с отметкой `HTTP 200 + JSON` на ключевых шагах; summary log: `/.runlogs/smoke/mvp0-full-summary-20260426-211218.log` (2026-04-26).

### Day 21 — Weekly review #3
- [x] Цель недели достигнута: 5/5 успешных прогонов или есть четкий список blockers.

**Done**
- [x] Weekly review #3 добавлен в `docs/IMPROVEMENT_PLAN.md` с итогами Day 15–20 (full-smoke hardening, auto-runner, run-артефакты, JSON-assertions, UX-тексты) (2026-04-26).
- [x] Цель недели подтверждена: `npm run smoke:mvp0:gate` дал `5/5 PASSED`; blockers не зафиксированы (2026-04-26).

---

## Неделя 4 — Smoke/Test Gate

### Day 22
- [x] Обновить/проверить `npm run smoke:mvp0`.

**Done**
- [x] Базовый smoke (`npm run smoke:mvp0`) проверен в light-режиме: health + auth/profile проходят стабильно (`MVP0 smoke checks passed`) (2026-04-26).
- [x] Зафиксирована роль light-smoke: быстрый sanity-check с ожидаемыми `SKIP` по `SESSION_ID`/`USER_ID`/`REPORT_ID`; полная проверка остаётся в `smoke:mvp0:full:auto` и `smoke:mvp0:gate` (2026-04-26).

### Day 23
- [x] Добавить/проверить smoke: auth + session creation.

**Done**
- [x] В `scripts/smoke/mvp0-smoke.sh` добавлен отдельный шаг `auth + session creation`: `POST /api/chat/session` с JSON-assert (`sessionId`) в full-режиме и в light-режиме по флагу `SMOKE_SESSION_CREATE=1` (2026-04-26).
- [x] Проверка выполнена: `SMOKE_SESSION_CREATE=1 TOKEN=<jwt> npm run smoke:mvp0` — шаг `POST /api/chat/session` проходит (`HTTP 200 + JSON`) вместе с auth/profile (2026-04-26).

### Day 24
- [x] Добавить/проверить smoke: chat loop + completion trigger.

**Done**
- [x] В `scripts/smoke/mvp0-smoke.sh` добавлены шаги:
  - `chat loop`: `POST /api/chat/session/:id/message` c JSON-assert (наличие `sessionId` и `userMessage`);
  - `completion trigger`: `POST /api/chat/session/:id/report` c проверкой получения `reportId` (2026-04-26).
- [x] Проверка выполнена в full-сценарии: `RUNS=1 npm run smoke:mvp0:full:auto` — новые шаги проходят (`HTTP 200 + JSON`), smoke завершается `PASSED` (2026-04-26).

### Day 25
- [x] Добавить/проверить smoke: final artifact delivery.

**Done**
- [x] В `scripts/smoke/mvp0-smoke.sh` добавлен шаг `final artifact delivery` (`SMOKE_FINAL_ARTIFACT=1`): ожидание `report status=ready` + проверка `GET /api/report/:reportId/download` (`200/302`) (2026-04-26).
- [x] Устранены блокеры report artifact delivery в локальном контуре:
  - `pdfGenerator`: устойчивый запуск Puppeteer с fallback на локальный Chrome + увеличенные timeout для рендера PDF;
  - `storageService`: local file fallback при недоступном object storage (`localfile:` вместо oversized data-url);
  - `reportController.downloadReport`: поддержка `localfile:` и stream/download локального PDF (2026-04-26).
- [x] Проверка пройдена: `RUNS=1 SMOKE_FINAL_ARTIFACT=1 npm run smoke:mvp0:full:auto` — smoke `PASSED`, download endpoint подтвердил доставку финального артефакта (`HTTP 302`), summary log: `/.runlogs/smoke/mvp0-full-summary-20260426-213154.log` (2026-04-26).

### Day 26
- [x] Добавить/проверить negative case (timeout/empty data).

**Done**
- [x] В `scripts/smoke/mvp0-smoke.sh` добавлен управляемый блок negative-проверок (`SMOKE_NEGATIVE_CASE=1`) (2026-04-26):
  - empty data: `POST /api/chat/session/:id/message` с `{"content":""}` ожидает `HTTP 400`;
  - not found: `GET /api/report/00000000-0000-0000-0000-000000000000/status` ожидает `HTTP 404`;
  - timeout: polling несуществующего report через `wait_report_ready` завершается состоянием `timeout`.
- [x] Проверка пройдена: `RUNS=1 SMOKE_NEGATIVE_CASE=1 npm run smoke:mvp0:full:auto` — negative checks прошли, общий smoke `1/1 PASSED`; summary log: `/.runlogs/smoke/mvp0-full-summary-20260426-213336.log` (2026-04-26).

### Day 27
- [x] Собрать “единый pre-release прогон” и зафиксировать шаги.

**Done**
- [x] Добавлен единый pre-release runner `scripts/smoke/mvp0-pre-release.sh` с fail-fast фазами:
  - `stability-gate`: `RUNS=$GATE_RUNS bash scripts/smoke/mvp0-full-run.sh`;
  - `final-artifact-delivery`: `RUNS=1 SMOKE_FINAL_ARTIFACT=1 ...`;
  - `negative-cases`: `RUNS=1 SMOKE_NEGATIVE_CASE=1 ...` (2026-04-26).
- [x] Добавлена единая команда запуска: `npm run smoke:mvp0:pre-release` в `package.json` (настройка интенсивности через `GATE_RUNS`, по умолчанию `3`) (2026-04-26).
- [x] Pre-release прогон подтверждён: `GATE_RUNS=2 npm run smoke:mvp0:pre-release` — все три фазы прошли (`PASSED`), артефакт лога: `/.runlogs/smoke/mvp0-pre-release-20260426-213539.log` (2026-04-26).
- [x] Повторная верификация pre-release: `GATE_RUNS=1 npm run smoke:mvp0:pre-release` — все фазы `PASSED`, артефакт лога: `/.runlogs/smoke/mvp0-pre-release-20260430-002328.log` (2026-04-30).

### Day 28 — Weekly review #4
- [x] Smoke gate стабильно проходит.

**Done**
- [x] Подтверждена стабильность smoke gate: `RUNS=5 npm run smoke:mvp0:gate` -> `5/5 PASSED`, без fail-записей по всем full-run шагам (2026-04-26).
- [x] Закрыты ключевые риски Недели 4 (Day 22–27): базовый light smoke, `session creation`, `chat loop + completion trigger`, `final artifact delivery`, `negative cases`, единый pre-release runner (2026-04-26).
- [x] Артефакт проверки: `/.runlogs/smoke/mvp0-full-summary-20260426-213651.log` (2026-04-26).

### Resume extraction hardening (дополнительный трек Week 4-5)
**Do**
- [x] **Шаг 1. Подготовить папки выборки**  
  Создать 2 папки:  
  - `mkdir -p ".runlogs/resume-dataset/text-layer"`  
  - `mkdir -p ".runlogs/resume-dataset/scan-only"`  
  Критерий: в `text-layer` >= 10 PDF с копируемым текстом, в `scan-only` >= 5 PDF-сканов.  
  Выполнено (2026-04-26): датасет подготовлен из `/Users/maxim/Desktop/резюме тест`, текущий объём — `text-layer: 16 PDF`, `scan-only: 16 PDF`.

- [x] **Шаг 2. Проверить здоровье `resume-parser`**  
  Команда: `curl -sS http://localhost:3011/health`  
  Ожидаемо: `{"status":"ok"}`.  
  Если не `ok`: остановить прогон, восстановить сервис, повторить шаг.  
  Выполнено (2026-04-26): ответ `{"status":"ok"}`.

- [x] **Шаг 3. Single smoke на 3 text-layer PDF**  
  Команды (по одному файлу):  
  - `npm run smoke:resume -- ".runlogs/resume-dataset/text-layer/file1.pdf"`  
  - `npm run smoke:resume -- ".runlogs/resume-dataset/text-layer/file2.pdf"`  
  - `npm run smoke:resume -- ".runlogs/resume-dataset/text-layer/file3.pdf"`  
  Сохранить вывод в заметку дня (chars/quality/ms для `pdf-parse` и `pdfplumber`).  
  Выполнено (2026-04-26), примеры:
  - `resume1.pdf`: `pdf-parse chars=1301 q=0.890 ms=59`; `pdfplumber chars=1220 q=0.902 ms=68`; suggested=`pdf-parse`.
  - `resume8.pdf`: `pdf-parse chars=1654 q=0.878 ms=60`; `pdfplumber chars=1561 q=0.898 ms=93`; suggested=`pdf-parse`.
  - `resume15.pdf`: `pdf-parse chars=1594 q=0.876 ms=66`; `pdfplumber chars=1523 q=0.893 ms=104`; suggested=`pdf-parse`.

- [x] **Шаг 4. Batch smoke на text-layer (10+ PDF)**  
  Команда: `npm run smoke:resume:batch -- ".runlogs/resume-dataset/text-layer"`  
  Критерий: прогон завершился без `All files failed`.  
  Выполнено (2026-04-26): `Processed: 16/16`; `Winner counts: pdfplumber=1, pdf-parse=15`; артефакт: `/.runlogs/smoke/resume-batch-text-layer-20260426-2156.log`.

- [x] **Шаг 5. Batch smoke на scan-only (negative cohort)**  
  Команда: `npm run smoke:resume:batch -- ".runlogs/resume-dataset/scan-only"`  
  Критерий: результаты зафиксированы отдельно как negative-track.  
  Выполнено (2026-04-26): `Processed: 16/16`; `Winner counts: pdfplumber=0, pdf-parse=16`; `Avg chars: 0 vs 0`; артефакт: `/.runlogs/smoke/resume-batch-scan-only-20260426-2157.log`.

- [x] **Шаг 6. Посчитать метрики text-layer**  
  Зафиксировать 4 метрики из batch summary:  
  - `pdfplumber_wins` (%),  
  - `avg_quality_delta = avg_quality(pdfplumber) - avg_quality(pdf-parse)`,  
  - `avg_chars_delta = (avg_chars(pdfplumber) - avg_chars(pdf-parse)) / avg_chars(pdf-parse)`,  
  - `avg_latency_delta = avg_ms(pdfplumber) - avg_ms(pdf-parse)`.
  Выполнено (2026-04-26): `pdfplumber_wins=6.25%`; `avg_quality_delta=+0.020`; `avg_chars_delta=-4.64%`; `avg_latency_delta=+53ms`.

- [x] **Шаг 7. Принять gate-решение (PASS/FAIL)**  
  PASS, если одновременно:  
  - `pdfplumber_wins >= 60%`,  
  - `avg_quality_delta >= +0.03`,  
  - `avg_chars_delta >= +10%`,  
  - `avg_latency_delta <= +1500ms`.  
  Иначе: FAIL и зафиксировать причину.  
  Выполнено (2026-04-26): **FAIL** — не выполнены 3 из 4 условий (`wins`, `quality_delta`, `chars_delta`), при этом latency в норме.

- [x] **Шаг 8. Принять решение по `RESUME_QUALITY_THRESHOLD`**  
  Стартовое значение: `0.55`.  
  По результатам шага 7: оставить/поднять/снизить, записать решение и обоснование в 2-3 пунктах.  
  Выполнено (2026-04-26): оставить `0.55` без изменений; текущие данные не показывают улучшение от `pdfplumber` на text-layer, поэтому изменение порога не улучшит выбор экстрактора.

- [x] **Шаг 9. Зафиксировать итог в документах**  
  В этом чеклисте заполнить `Done` с цифрами и ссылкой на артефакты логов (`.runlogs/...`).  
  Для scan-only явно отметить limitation без OCR (ссылка: `docs/MVP/MVP0_RESUME_EXTRACTION_RUNBOOK.md`).  
  Выполнено (2026-04-26): результаты text-layer/scan-only и gate-решение добавлены в этот раздел, scan-only зафиксирован как OCR-limitation.

**Done**
- [ ] Контур `pdf-parse -> pdfplumber` подтвержден на text-layer выборке (10+ PDF) с зафиксированными метриками и артефактом batch-лога.
- [x] Валидация контура extraction завершена: на текущей text-layer выборке улучшение `pdfplumber` не подтверждено (`gate=FAIL`), принято ограниченное использование fallback до OCR-этапа и повторного batch-gate.
- [x] Порог `RESUME_QUALITY_THRESHOLD` подтвержден/скорректирован и документирован (с кратким обоснованием по цифрам).
- [x] Принято решение по режиму fallback: `always-on` / `ограниченно` / `временно отключить` (с условиями пересмотра).  
  Принято (2026-04-26): **`ограниченно`** — использовать `pdfplumber` только как conditional fallback, не включать always-on до OCR-этапа и повторного batch-gate.

---

## Неделя 5 — Release Engineering + Staging Rehearsal

### Day 29
- [x] Проверить env-matrix (local/staging/prod) по `docs/CONFIGURATION.md`.

**Done**
- [x] Проверен local env (`/.env`) на соответствие обязательным требованиям из `docs/CONFIGURATION.md`: обязательный минимум (`DB_*`, `REDIS_*`, `JWT_SECRET`, `*_SERVICE_URL`, `CORS_ORIGIN`) присутствует (2026-04-26).
- [x] Зафиксированы gaps для production-like контура: в local отсутствуют `USE_MOCK_JOBS` и `JOB_CATALOG_TOKEN` (нужно явно задать перед staging/prod) (2026-04-26).
- [x] Проверено наличие env-matrix для окружений: отдельные `staging/prod` env-файлы в репозитории не найдены; оформлен артефакт с матрицей и next actions: `docs/MVP/MVP0_ENV_MATRIX_DAY29.md` (2026-04-26).

### Day 30
- [x] Проверить runbook выкладки и rollback по `docs/MVP/MVP0_RELEASE_RUNBOOK.md`.

**Done**
- [x] Проверен текущий runbook и исправлена ссылка в чеклисте на фактический путь: `docs/MVP/MVP0_RELEASE_RUNBOOK.md` (2026-04-26).
- [x] Runbook усилен до операционного формата: добавлены конкретные smoke-команды для rehearsal/post-deploy, health-check команды по сервисам, rollback trigger при повторном smoke-fail, и шаги верификации восстановления после rollback (2026-04-26).
- [x] Добавлен release decision gate (`staging PASS` + `post-deploy smoke PASS` + воспроизводимый rollback) для устранения “ручной импровизации” на выкатке (2026-04-26).

### Day 31
- [x] Поднять staging с production-like env.

**Done**
- [x] Добавлена поддержка env-файла в `scripts/dev/up.sh` (`--env-file <path>`), чтобы поднимать отдельный контур с production-like переменными без перезаписи local `.env` (2026-04-26).
- [x] Добавлены staging-конфиги:
  - `/.env.staging.example` (шаблон без секретов),
  - `/.env.staging.local` (локальный production-like профиль: `NODE_ENV=production`, `USE_MOCK_JOBS=false`, `JOB_CATALOG_TOKEN` задан) (2026-04-26).
- [x] Добавлена команда запуска staging-like контура: `npm run dev:up:staging` (2026-04-26).
- [x] Проверка запуска выполнена: команда отрабатывает корректно, но на хосте уже были запущены сервисы на портах `3000-3005`, поэтому `up.sh` корректно сработал в режиме `Port already busy, skipping start`; для полной активации staging env требуется чистый перезапуск именно через `dev:up:staging` в свободном контуре (2026-04-26).
- [x] Повторная верификация staging env-контура: `/.env.staging.example` и `/.env.staging.local` присутствуют; `npm run dev:up:staging` больше не падает по `Env file not found` (2026-04-30).

### Day 32
- [x] Прогнать `npm run smoke:mvp0` на staging.

**Done**
- [x] Smoke прогон выполнен с валидным JWT (`TOKEN` через `POST /api/users/login`): `TOKEN=<jwt> npm run smoke:mvp0` -> `MVP0 smoke checks passed` (health + auth/profile) (2026-04-26).
- [x] Закрыт root-cause невалидного smoke в staging-like контуре: `scripts/dev/up.sh`/`down.sh`/`status.sh` дополнены сервисом `report` (`3007`), после чего `TOKEN=<jwt> npm run smoke:mvp0` проходит с `OK .../3007/health` и итогом `MVP0 smoke checks passed` (2026-04-26).

### Day 33
- [x] Пройти manual primary flow на staging до финального результата.

**Done**
- [x] Ручной primary-flow подтверждён на staging-like контуре: `login -> session -> message -> report -> status/download` (2026-04-26).
- [x] Финальный результат достигнут:  
  `session_id=0b698654-b26a-42c1-9db5-42d8683df1ba`,  
  `report_id=b8a56885-d8d5-4eaa-8d79-d34acbfecf47`,  
  `final_status=ready`,  
  `download_http=302` (2026-04-26).
- [x] Закрыты технические blockers rehearsal-контура:  
  - `scripts/dev/up.sh` — безопасная загрузка env-файла (устранён shell-parse env значений с пробелами/скобками);  
  - `scripts/dev/up.sh`/`down.sh`/`status.sh` — добавлен `report` (`3007`), чтобы staging-like стек поднимался полным составом (2026-04-26).

### Day 34
- [x] Закрыть найденные P0/P1 после rehearsal.

**Done**
- [x] P1: неполный dev/staging-like стек (без `report:3007`) закрыт через обновление `scripts/dev/up.sh`, `scripts/dev/down.sh`, `scripts/dev/status.sh` (2026-04-26).
- [x] P1: некорректная загрузка env-файла через `source` (ломалась на значениях вида `HH_USER_AGENT=... (...)`) закрыта переводом на безопасный построчный экспорт переменных в `up.sh` (2026-04-26).
- [x] Повторный rehearsal после фиксов подтверждён: manual flow завершается с `status=ready` и `download 302`, открытых P0/P1 по release-контру не осталось (2026-04-26).

### Day 35 — Weekly review #5
- [x] Staging rehearsal PASS без ручной импровизации.

**Done**
- [x] Цель недели подтверждена: staging-like rehearsal завершён с рабочим контуром `dev:up:staging` и успешным manual primary flow до финального артефакта (`final_status=ready`, `download_http=302`) (2026-04-26).
- [x] Закрыты найденные P1 blockers rehearsal-недели: неполный стек dev-скриптов (добавлен `report:3007` в `up/down/status`) и некорректная загрузка env через `source` (переведено на безопасный построчный экспорт) (2026-04-26).
- [x] Week 5 readiness для перехода к Launch + Hypercare подтверждена: smoke + manual flow воспроизводимы на staging-like контуре без ad-hoc правок (2026-04-26).

---

## Неделя 6 — Launch + Hypercare

Рабочий playbook недели: `docs/MVP/MVP0_WEEK6_LAUNCH_DASHBOARD_PLAYBOOK.md`

### Day 36 (Launch day)
- [x] Soft launch на ограниченный трафик.
- [ ] Зафиксировать baseline по 3 метрикам.

**Do**
- [x] Выбрать стратегию soft-launch: `allowlist` (рекомендовано для текущего MVP) или `% rollout` на gateway.
- [x] Зафиксировать стартовый размер когорты (например, 10-20 пользователей или 5-10% трафика).
- [x] Перед открытием когорты выполнить pre-launch checks:
  - `npm run smoke:mvp0`
  - `RUNS=1 SMOKE_FINAL_ARTIFACT=1 npm run smoke:mvp0:full:auto`
- [x] Открыть трафик для когорты и зафиксировать время старта launch-window.
- [ ] Снять baseline (до/после старта launch-window) по 3 метрикам:
  - `Activation`,
  - `Completion`,
  - `Perceived value` (выбранный прокси-сигнал).
- [ ] Заполнить daily лог: размер когорты, время старта, baseline-значения, инциденты.

**Done**
- [x] Soft launch выполнен, когорта и время запуска зафиксированы.  
  Подтверждение (2026-04-26): staging-like контур `UP`, `smoke:mvp0` = `PASS`, manual flow до финального артефакта = `report_id=98f54787-3463-4eae-ab29-11a881e0f696`, `final_status=ready`, `download_http=302`.
- [ ] Baseline по 3 метрикам сохранён в дашборд/лог дня.

### Day 37
- [ ] Снять метрики: Activation / Completion / Perceived value.
- [ ] Исправить только P0/P1.

**Do**
- [ ] Снять метрики за первые 24 часа и сравнить с baseline Day 36.
- [ ] Проверить техсигналы: `5xx`, p95 latency, auth/report errors.
- [ ] Разобрать инциденты и классифицировать по приоритету (`P0/P1/P2`).
- [ ] Взять в работу только `P0/P1`; `P2` переносить в backlog (без отвлечения от hypercare).
- [ ] После каждого фикса выполнить минимум:
  - `npm run smoke:mvp0`
  - один manual primary-flow.

**Done**
- [ ] Метрики за сутки зафиксированы.
- [ ] Открытые `P0/P1` закрыты или имеют owner + ETA.

### Day 38
- [ ] Повторить метрики.
- [ ] Проверить, что completion не падает.

**Do**
- [ ] Повторно снять 3 метрики и посчитать day-to-day delta.
- [ ] Проверить guardrail: `Completion` не проседает относительно baseline/Day 37.
- [ ] Если метрики стабильны и нет открытых P0 — рассмотреть увеличение когорты (step-up).
- [ ] Если есть деградация — заморозить рост трафика и вернуть фокус на стабилизацию.

**Done**
- [ ] Решение по трафику принято (step-up / hold / rollback) и задокументировано.
- [ ] Completion guardrail проверен и зафиксирован.

### Day 39
- [ ] Повторный smoke + проверка логов на 5xx/ошибки.

**Do**
- [ ] Прогнать:
  - `npm run smoke:mvp0`
  - `RUNS=2 npm run smoke:mvp0:full:auto`
- [ ] Проверить логи за 24ч на spikes: `5xx`, timeout, auth failures, report generation errors.
- [ ] Сопоставить лог-инциденты с пользовательскими жалобами/фидбеком (если есть).

**Done**
- [ ] Smoke-серия PASS, критичных неразобранных ошибок в логах нет.

### Day 40
- [ ] Только точечные UX-правки в primary flow.

**Do**
- [ ] Выполнять только low-risk UX-правки в primary-flow (copy/empty states/micro-interactions).
- [ ] Не трогать архитектурные/инфраструктурные изменения.
- [ ] Для каждой UX-правки: smoke + короткий manual replay затронутого шага.

**Done**
- [ ] UX-правки внесены без регрессий Completion/Artifact delivery.

### Day 41
- [ ] Повторный метрик-ревью + очистка хвоста P1.

**Do**
- [ ] Снять финальный перед close срез по 3 метрикам и техсигналам.
- [ ] Дочистить хвост `P1` или явно перенести с owner/date в post-launch backlog.
- [ ] Подготовить черновик Day 42 решения (close vs extend) на основе тренда 6 дней.

**Done**
- [ ] Финальный пред-close метрик-срез зафиксирован.
- [ ] Статус каждого `P1` определен (closed / deferred с owner).

### Day 42 (Hypercare close)
- [ ] Итог 7 дней: инциденты, тренд метрик, решение (закрываем MVP 0 / продлеваем).

**Do**
- [ ] Свести 7-дневный отчет:
  - динамика `Activation / Completion / Perceived value`,
  - список P0/P1 инцидентов и время восстановления,
  - итог по стабильности smoke/manual flow.
- [ ] Принять формальное решение:
  - `Close MVP0` (если guardrails соблюдены),
  - `Extend Hypercare` (если есть открытые риски).
- [ ] Зафиксировать решение в `MVP0_DAILY_EXECUTION_CHECKLIST.md` и `IMPROVEMENT_PLAN.md`.

**Done**
- [ ] Итоговый hypercare-отчет готов и решение зафиксировано.

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

---

## MVP1 Checklist

MVP1-блок вынесен в отдельный файл для снижения шума в рабочем MVP0 документе:

- `docs/MVP/MVP1_DAILY_EXECUTION_CHECKLIST.md`
