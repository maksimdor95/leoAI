# MVP 1 — Product + Platform Plan (event-driven + AI scale)

Документ фиксирует план перехода после MVP0 к MVP1: от стабильного core-flow к масштабируемому продукту с event-driven архитектурой, предсказуемой себестоимостью и управляемым качеством AI-ответов.

---

## 1) Цель MVP 1

Собрать production-ready контур, в котором:
- пользователь получает более персонализированный и устойчивый результат (чат, вакансии, отчеты, email);
- тяжелые шаги обрабатываются асинхронно и не ломают UX;
- стоимость inference и инфраструктуры контролируется на уровне SLO и бюджета;
- команда может развивать продукт без роста ручных операций.

---

## 2) Definition of Success (MVP1 Exit Criteria)

MVP1 считается завершенным, когда одновременно выполнены условия:
- `Reliability`: 14 дней подряд без критических инцидентов P0/P1 по core user flow.
- `Speed`: p95 по критичным endpoint не деградирует относительно MVP0 baseline; асинхронные задачи завершаются в целевой SLA.
- `Quality`: измеримая стабильность AI-ответов на регрессионном наборе (не ниже согласованного порога).
- `Cost`: есть еженедельный cost-report и контроль стоимости за 1 успешный user-flow.
- `Operations`: запуск/recovery/redeploy выполняются по runbook без импровизации.

---

## 3) Архитектурная рамка MVP1

Переход к гибридной модели:
- синхронно оставляем только user-critical online-path (auth, чтение профиля, chat turn);
- тяжелые/долгие шаги переводим в event-driven pipeline;
- вводим сквозной `correlationId` для трассировки от фронта до воркеров;
- вводим слой продуктовых событий (доменные события), не завязанный на внутренние структуры отдельных сервисов.

Базовые события MVP1:
- `profile.updated`
- `chat.session.completed`
- `job.match.requested`
- `job.match.completed`
- `report.generation.requested`
- `report.generation.completed`
- `email.digest.requested`
- `email.digest.sent`

---

## 4) Декомпозиция по эпикам и задачам

### Epic A — Event Backbone
Цель: убрать хрупкость межсервисной синхронщины.

Задачи:
- A1. Проектировать event contracts (JSON schema, версия, обязательные поля, idempotency key).
- A2. Ввести publisher слой в `conversation` и `user-profile`.
- A3. Реализовать consumers/worker-процессы для `job-matching`, `report`, `email`.
- A4. Добавить retry policy + DLQ + replay-runbook.
- A5. Ввести outbox pattern в сервисах-источниках событий.

Критерии готовности:
- ключевые async-флоу работают без прямой синхронной зависимости сервисов;
- повтор события не приводит к дублям артефактов (идемпотентность подтверждена тестом);
- есть операционный сценарий: “упало в DLQ -> разобрать -> переиграть”.

---

### Epic B — AI Quality and Guardrails
Цель: повысить стабильность и полезность генераций.

Задачи:
- B1. Собрать регрессионный набор диалогов (минимум 100 кейсов: happy-path, edge, failure).
- B2. Ввести оффлайн-оценку ответов (структура, точность, полезность, safety-red flags).
- B3. Добавить prompt/version registry и A/B стратегию.
- B4. Нормализовать fallback-механику (не молчать при частичных сбоях, давать понятный следующий шаг).
- B5. Добавить контур budget-aware inference (ограничение дорогих моделей по сценариям).

Критерии готовности:
- регресс AI-качества ловится до выката;
- есть прозрачная схема “какой сценарий -> какая модель -> какой лимит”.

---

### Epic C — Search and Matching Upgrade
Цель: улучшить качество подбора и объяснимость результата.

Задачи:
- C1. Ввести слой retrieval (vector + lexical fallback).
- C2. Нормализовать профильные признаки в единый match-profile.
- C3. Ввести explainability блока “почему вакансия в выдаче”.
- C4. Улучшить стратегию слабых совпадений (tiering + рекомендация следующего шага).
- C5. Добавить metrics: CTR/engagement по рекомендованным позициям.

Критерии готовности:
- пользователь получает объяснение качества совпадения;
- снижение “пустых” или нерелевантных выдач.

---

### Epic D — Platform Reliability and Observability
Цель: сделать систему наблюдаемой и предсказуемой в эксплуатации.

Задачи:
- D1. Сквозные structured logs с `correlationId`, `userId`, `sessionId`, `eventId`.
- D2. Дашборды: latency, error rate, queue lag, DLQ count, success ratio per flow.
- D3. Алерты по SLO (ошибки, деградация latency, рост очередей).
- D4. Инцидентный шаблон и postmortem-процесс.
- D5. Автоматический smoke gate в CI/CD.

Критерии готовности:
- любой инцидент диагностируется через дашборды/логи за минуты, а не часы;
- релиз блокируется автоматически при провале smoke/slo-gate.

---

### Epic E — Security and Compliance Baseline+
Цель: убрать операционные риски с секретами и доступами.

Задачи:
- E1. Перевести prod/staging секреты в управляемое хранилище секретов.
- E2. Ввести per-service accounts с минимальными правами.
- E3. Ротация ключей/токенов + проверка lifecycle.
- E4. Лог-политика по PII/маскированию.
- E5. Security checklist в релизный gate.

Критерии готовности:
- секреты не живут в runtime-конфиге в открытом виде;
- права сервисов ограничены по принципу least privilege.

---

## 5) Что использовать из Yandex Cloud, а что воссоздать самим дешевле

Ниже практичный принцип: сначала считаем TCO (инженерные часы + эксплуатация + риски), потом выбираем managed vs self.

### 5.1 Что рационально брать как managed (почти всегда)

- Message bus / streaming:
  - Почему: надежность, отказоустойчивость, меньше DevOps-риска.
  - Рекомендация: managed потоковый сервис (Data Streams / Managed Kafka) для production.

- Secret management + KMS:
  - Почему: безопасность и аудит “из коробки”.
  - Рекомендация: не воссоздавать самостоятельно.

- Monitoring/alerting (базовый контур):
  - Почему: быстрее получить рабочий NOC-минимум.
  - Рекомендация: managed наблюдаемость + ваши custom-метрики.

- Object storage:
  - Почему: дешево, надежно, стандартно.
  - Рекомендация: хранить PDF/артефакты/вложения в managed storage.

### 5.2 Что можно воссоздать самим дешевле (на этапе MVP1)

- AI Gateway слой (router + policy):
  - Что это: ваш сервис-обертка над моделями (выбор модели, ретраи, фоллбеки, лимиты).
  - Почему выгодно: бизнес-логика уникальная, легко оптимизировать cost/quality.
  - Границы: не строить свой model-hosting; только orchestration.

- Evaluation framework:
  - Что это: собственный регрессионный прогон промптов/ответов.
  - Почему выгодно: специфично под ваш домен (карьера, профиль, вакансии).
  - Границы: хранить только нужные вам метрики и golden-cases.

- Product analytics schema:
  - Что это: события продукта и воронки (chat steps, match outcomes, report completion).
  - Почему выгодно: уникальная продуктовая телеметрия.

- Rule-based pre/post processors:
  - Что это: локальные парсеры и валидации до/после LLM.
  - Почему выгодно: дешево и сильно снижает токен-расход.

### 5.3 Что не стоит воссоздавать в MVP1

- Свой Kafka-кластер/оркестрация брокеров;
- Свой секрет-менеджер и криптография;
- Своя полнофункциональная observability-платформа;
- Свой object storage.

---

## 6) Проверка “можно воссоздать самим дешевле” (методика)

Для каждого кандидата на self-host/self-build применяем 4 теста:

- Test 1: Engineering Cost
  - Если реализация + поддержка > 2 инженеронедель в квартал, managed обычно выгоднее.

- Test 2: Operational Risk
  - Если отказ компонента блокирует core-flow и нет зрелого on-call, managed предпочтительнее.

- Test 3: Strategic Differentiation
  - Если компонент не дает продуктового преимущества, не строим сами.

- Test 4: Cost Delta
  - Если ожидаемая экономия < 20% от total cost сценария, не усложняем архитектуру.

Решение:
- `Build` — только если проходят все 4 теста.
- `Buy/Managed` — во всех остальных случаях.

---

## 7) План реализации MVP1 по неделям (10 недель)

### Weeks 1-2: Foundation
- Утвердить MVP1 scope, SLO, бюджетные лимиты.
- Зафиксировать event contracts v1.
- Ввести correlationId во все сервисы.
- Подготовить базовые дашборды и алерты.

### Weeks 3-4: Event Pipeline v1
- Подключить event bus.
- Перенести `report` и `email` в async через события.
- Ввести DLQ/retry/replay runbook.

### Weeks 5-6: Matching + Retrieval
- Добавить retrieval layer и explainability.
- Прогнать quality baseline на реальных кейсах.
- Настроить weak-match стратегию и UX-ответы.

### Weeks 7-8: AI Quality Gate
- Внедрить eval pipeline и prompt versioning.
- Запустить A/B на ограниченном трафике.
- Применить budget-aware routing моделей.

### Weeks 9-10: Hardening + Release
- Полный rehearsal (incident drills, replay, rollback).
- 5/5 pre-release gates.
- Go/No-Go и запуск hypercare.

---

## 8) Backlog MVP1 (ready-to-execute)

### BKL-01 Event Contract Registry
- Output: `docs/architecture/events-v1.md` + JSON schema files.
- Owner: backend lead.
- Estimate: 3-4 days.

### BKL-02 Outbox + Publisher in conversation/user-profile
- Output: гарантированная доставка событий при локальных сбоях.
- Owner: backend.
- Estimate: 5-7 days.

### BKL-03 Async Workers for report/email
- Output: воркеры + retry/DLQ.
- Owner: backend/platform.
- Estimate: 5-7 days.

### BKL-04 Correlation ID End-to-End
- Output: единая трассировка во всех логах/метриках.
- Owner: platform.
- Estimate: 2-3 days.

### BKL-05 AI Eval Harness
- Output: скрипты прогона + baseline отчёт.
- Owner: AI/backend.
- Estimate: 5 days.

### BKL-06 Prompt Registry + A/B Switch
- Output: версионирование промптов + feature-flag rollout.
- Owner: AI.
- Estimate: 4-5 days.

### BKL-07 Retrieval Layer v1
- Output: гибридный retrieval для match/report contexts.
- Owner: AI/search.
- Estimate: 7-10 days.

### BKL-08 Security Baseline+
- Output: секреты/доступы/ротация по runbook.
- Owner: platform/security.
- Estimate: 3-5 days.

### BKL-09 CI/CD Quality Gates
- Output: обязательные smoke + eval + schema checks перед релизом.
- Owner: platform.
- Estimate: 3-4 days.

### BKL-10 Cost Dashboard
- Output: weekly unit economics (`cost per successful flow`).
- Owner: platform/product.
- Estimate: 2-3 days.

---

## 9) Риски MVP1 и mitigation

- Риск: рост сложности из-за event-driven.
  - Mitigation: начать с 2 async-контуров (`report`, `email`) и не переводить все сразу.

- Риск: деградация UX из-за задержек async.
  - Mitigation: статусные ответы пользователю + polling/notification паттерн.

- Риск: cost blow-up на AI вызовах.
  - Mitigation: budget-aware router, лимиты, кеширование и pre/post processing.

- Риск: расхождение схем событий.
  - Mitigation: schema registry + compatibility checks в CI.

---

## 10) Артефакты, которые должны появиться в репо

- `docs/MVP/MVP1_PRODUCT_PLATFORM_PLAN.md` (этот документ).
- `docs/architecture/events-v1.md`.
- `docs/runbooks/event-replay-dlq.md`.
- `docs/runbooks/mvp1-hypercare.md`.
- `docs/metrics/mvp1-slo-sli.md`.

---

## 11) Go/No-Go Checklist для старта MVP1

- [ ] Утвержден scope MVP1 и owner по каждому эпику.
- [ ] Приняты SLO и cost-лимиты.
- [ ] Согласован список managed сервисов и self-build компонентов.
- [ ] Подготовлен backlog первого спринта (не менее 2 недель).
- [ ] Назначен ритуал weekly review по MVP1 (прогресс + риски + cost + quality).

---

## 12) Краткое решение по “что делать уже сейчас”

Начать с трех задач, которые дают максимальный эффект за минимальный риск:
- внедрить event pipeline для `report` и `email`;
- внедрить correlation/observability baseline;
- внедрить AI eval + prompt versioning.

Это даст быстрый прирост надежности, управляемости и качества без дорогого “big bang” рефакторинга.
