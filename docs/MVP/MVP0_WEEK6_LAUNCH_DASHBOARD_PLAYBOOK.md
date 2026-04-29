# MVP0 Week 6 - Launch + Dashboard Playbook

Этот playbook нужен для исполнения Week 6 (`Day 36-42`) без импровизации:
- как запускать ограниченный трафик;
- где и как вести метрики;
- когда увеличивать когорту / замораживать / откатываться.

## 1) Soft launch модель

## Рекомендуемый режим (текущий контур)
- `allowlist` cohort rollout: запуск на ограниченной группе пользователей.
- Размер стартовой когорты: 10-20 пользователей (или эквивалент 5-10%).

## Step-up политика
- Day 36: cohort `L1`
- Day 38: при стабильности -> cohort `L2` (x2 от `L1`)
- Day 41: при стабильности -> cohort `L3` (до целевого launch-window)

## Guardrails для step-up
- нет открытых `P0`;
- `Completion` не проседает относительно baseline более чем на 10%;
- 5xx/timeout не показывают устойчивый рост 2 замера подряд.

Если guardrail нарушен -> `hold`/`rollback` и фиксы только `P0/P1`.

---

## 2) Где вести дашборд

Минимально-достаточно (solo-founder friendly):
- Продуктовый dashboard: Google Sheets / Notion table.
- Технический dashboard: логи + существующие smoke/runlogs.

Файл-источник в репозитории для weekly summary: `docs/MVP/MVP0_DAILY_EXECUTION_CHECKLIST.md` (раздел "Лог выполнения").

---

## 3) Каркас продуктового дашборда

Создать 3 вкладки:

1. `daily_kpi`
2. `incidents`
3. `decision_log`

## 3.1 Вкладка `daily_kpi` (основная)

Рекомендуемые колонки:
- `date`
- `cohort_size`
- `new_users`
- `session_started`
- `final_artifact_ready`
- `final_artifact_downloaded`
- `positive_feedback_count` (или выбранный value-proxy)
- `activation_rate` = `session_started / new_users`
- `completion_rate` = `final_artifact_ready / session_started`
- `perceived_value_rate` = `positive_feedback_count / session_started`
- `smoke_status` (`PASS`/`FAIL`)
- `notes`

## 3.2 Вкладка `incidents`

Колонки:
- `date_time`
- `severity` (`P0`/`P1`/`P2`)
- `service`
- `symptom`
- `root_cause`
- `mitigation`
- `status` (`open`/`monitoring`/`closed`)
- `owner`

## 3.3 Вкладка `decision_log`

Колонки:
- `date`
- `decision` (`step-up`/`hold`/`rollback`)
- `reason`
- `next_action`

---

## 4) Определения 3 метрик Week 6

- `Activation` = доля пользователей, начавших primary-flow:
  - `session_started / new_users`

- `Completion` = доля пользователей, дошедших до финального результата:
  - `final_artifact_ready / session_started`

- `Perceived value` = прокси ценности (выбрать один и не менять в течение недели):
  - вариант A: `positive_feedback_count / session_started`
  - вариант B: `final_artifact_downloaded / final_artifact_ready`

Важно: фиксируйте выбранную формулу один раз в Day 36 и не меняйте до Day 42.

---

## 5) Ежедневный operational ритуал (Day 36-42)

Утро:
1. `npm run smoke:mvp0`
2. при необходимости: `RUNS=1 SMOKE_FINAL_ARTIFACT=1 npm run smoke:mvp0:full:auto`
3. обновить `daily_kpi` за предыдущие 24ч

Вечер:
1. ревью `incidents`
2. решение `step-up/hold/rollback`
3. запись решения и причин в `decision_log`

---

## 6) Rollback триггеры

Откат/заморозка rollout обязательны, если:
- открытый `P0`;
- `Completion` падает >10% от baseline два замера подряд;
- устойчивый рост 5xx/timeout без стабилизации.

После rollback:
1. устранить root-cause;
2. перепроверить smoke + manual flow;
3. только после этого возвращаться к step-up.

---

## 7) Definition of Done для Week 6

Week 6 считается закрытой, если:
- Day 36-42 заполнены фактами;
- есть 7-дневный тренд по `Activation / Completion / Perceived value`;
- `P0` отсутствуют, `P1` закрыты или с явным post-launch owner;
- принято и задокументировано решение `close MVP0` или `extend hypercare`.
