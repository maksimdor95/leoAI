# MVP 1 Daily Execution Checklist

Этот документ вынесен из `MVP0_DAILY_EXECUTION_CHECKLIST.md`, чтобы рабочий контур MVP0 был короче и проще.

Фокус MVP1: event-driven контур, управляемое качество AI, cost control, observability и безопасная эксплуатация.

## Как пользоваться (каждый день)

1. Выполни блок `Do`.
2. Заполни блок `Done` с evidence (команды, логи, URL дашбордов, артефакты).
3. Отметь `PASS/FAIL` по дневному критерию.
4. Если день не закрыт — перенеси только 1-2 незавершенных пункта.

---

## Week 1 — MVP1 Foundation (scope, SLO, contracts)

### Day 1 — Scope freeze + KPI baseline
**Do**
- [ ] Зафиксировать scope MVP1 (что точно входит/не входит).
- [ ] Назначить owner по эпикам: Event Backbone, AI Quality, Matching, Platform, Security.
- [ ] Зафиксировать baseline метрики MVP0 (latency, error rate, smoke stability, cost estimate).

**Done**
- [ ] ...

### Day 2 — SLO/SLI + release gates
**Do**
- [ ] Определить SLO/SLI для core-flow (chat, matching, report, email).
- [ ] Зафиксировать release gates (smoke, schema checks, AI regression, rollback triggers).
- [ ] Согласовать инцидентные приоритеты P0/P1/P2 и SLA реакции.

**Done**
- [ ] ...

### Day 3 — Event contract v1 (design)
**Do**
- [ ] Зафиксировать доменные события v1 и обязательные поля (`eventId`, `eventType`, `occurredAt`, `correlationId`, `version`).
- [ ] Определить idempotency strategy для consumers.
- [ ] Ввести правило версионирования контрактов (`v1`, backward compatibility).

**Done**
- [ ] ...

---

## Week 2-6 — Execution skeleton

Используйте тот же формат `Do -> Pass criteria -> Done` для следующих недель:
- Week 2: Event Pipeline v1 (report/email async)
- Week 3: AI Quality Gate (eval + prompt versioning)
- Week 4: Retrieval + Matching explainability
- Week 5: Platform hardening + Security+
- Week 6: Pre-release + MVP1 Exit

---

## MVP1 Ежедневный лог (копируй блок)

```md
### YYYY-MM-DD (MVP1 Day N)
- Фокус дня: ...
- Что сделал:
  - ...
- Артефакты/evidence:
  - ...
- Gates:
  - Smoke:
  - Async flow:
  - AI eval:
  - Schema checks:
- Метрики:
  - Reliability:
  - Speed:
  - Quality:
  - Cost:
- Инциденты P0/P1:
  - ...
- Решение на завтра (до 3 пунктов):
  1) ...
  2) ...
  3) ...
```
